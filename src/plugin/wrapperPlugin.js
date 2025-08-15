import { Plugin, PluginKey, TextSelection } from "prosemirror-state";

const pairedCharacters = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
  ["<", ">"],
  ['"', '"'],
  ["'", "'"],
  ["`", "`"],
]);

const closingCharacters = new Map(
  Array.from(pairedCharacters, ([open, close]) => [close, open])
);

const pairedCharPluginKey = new PluginKey("pairedCharPlugin");

function addPair(char, state, dispatch) {
  const closeChar = pairedCharacters.get(char);
  if (!isCharBeforeSpaceOrEmpty(state)) return false;
  if (!closeChar) return false;
  if (!dispatch) return true;

  const { from, to, empty } = state.selection;
  const tr = state.tr;

  const selectionText = state.doc.textBetween(from, to, "", "");
  const newText = empty ? char + closeChar : char + selectionText + closeChar;

  tr.insertText(newText, from, to);
  tr.setSelection(
    empty
      ? TextSelection.create(tr.doc, from + 1) 
      : TextSelection.create(tr.doc, from + 1, from + 1 + selectionText.length)
  );

  tr.setMeta(pairedCharPluginKey, {
    start: from,
    end: from + newText.length,
    char,
  });

  dispatch(tr.scrollIntoView());
  return true;
}

function skipPairing(char, state, dispatch, pluginState) {
  if (!pluginState.length) return false;

  const { from } = state.selection;
  const foundPair = pluginState.find((p) => {
    const sameChar = p.char === closingCharacters.get(char);
    const sameEnd = p.end === from + 1;
    return sameEnd && sameChar;
  });

  if (foundPair) {
    const tr = state.tr;
    tr.setSelection(TextSelection.create(tr.doc, from + 1));
    dispatch(tr.scrollIntoView());
    return true;
  }
  return false;
}

function removePairing(state, dispatch, pluginState) {
  if (!pluginState) return false;

  const { from } = state.selection;
  const foundPair = pluginState.find((p) => {
    return p.start === from - 1;
  });

  if (foundPair && foundPair.start === foundPair.end - 2) {
    const tr = state.tr;
    tr.insertText("", foundPair.start, foundPair.end);
    dispatch(tr.scrollIntoView());
    return true;
  }
  return false;
}

export const pairedCharPlugin = new Plugin({
  key: pairedCharPluginKey,
  state: {
    init() {
      return [];
    },
    apply(tr, oldState) {
      let newState = oldState.map((p) => ({
        ...p,
        start: tr.mapping.map(p.start, 1),
        end: tr.mapping.map(p.end, -1),
      }));

      newState = newState.filter((p) => {
        const startChar = tr.doc.textBetween(p.start,p.start + 1, undefined, "");
        const endChar = tr.doc.textBetween(p.end - 1, p.end, undefined, "");
        const stillValid = startChar === p.char && endChar === pairedCharacters.get(p.char);
        const caretInside = tr.selection.from > p.start && tr.selection.from < p.end;
        return stillValid && caretInside;
      });

      const meta = tr.getMeta(pairedCharPluginKey);
      if (meta) newState.push(meta);
      return newState;
    },
  },
  props: {
    handleKeyDown(view, event) {
      const char = event.key;
      const { selection } = view.state;
      const pluginState = pairedCharPluginKey.getState(view.state);

      if (!(selection instanceof TextSelection)) return false;

      if (pairedCharacters.has(char) && pairedCharacters.get(char) === char) {
        if (shouldSkipInsteadOfAdd(char, view.state, pluginState)) {
          return skipPairing(char, view.state, view.dispatch, pluginState);
        } else {
          return addPair(char, view.state, view.dispatch);
        }
      }

      if (pairedCharacters.has(char)) {
        return addPair(char, view.state, view.dispatch);
      } else if (closingCharacters.has(char)) {
        return skipPairing(char, view.state, view.dispatch, pluginState);
      } else if (event.key === "Backspace") {
        return removePairing(view.state, view.dispatch, pluginState);
      } else return false;
    },
  },
});

function shouldSkipInsteadOfAdd(char, state, pluginState) {
  const isSymmetric = pairedCharacters.get(char) === char;

  console.log(isSymmetric)
  if (!isSymmetric) return false;

  const { from } = state.selection;
  const filtered = pluginState.find((p) => {
    return p.char === char && from === p.end - 1;
  });

  if (filtered && from === filtered.end - 1) return true; // Utiliser skipPairing
  return false; // Utiliser addPair
}

function isCharBeforeSpaceOrEmpty(state) {
  const { selection, doc } = state;
  if (!(selection instanceof TextSelection)) return false;
  const pos = selection.from;
  if (pos === 0) return true;
  const $pos = doc.resolve(pos);
  const nodeBefore = $pos.nodeBefore;
  if (!nodeBefore) return true;
  if (nodeBefore.isText) {
    const lastChar = nodeBefore.text.charAt(nodeBefore.text.length - 1);
    if (lastChar === " " || pairedCharacters.get(lastChar)) return true;
  }
  return false;
}
