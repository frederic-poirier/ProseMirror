import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { keymap } from "prosemirror-keymap";

const pairedCharacters = new Map([
  ["(", ")"], // Parenthèse
  ["[", "]"], // Crochet
  ["{", "}"], // Accolade
  ["<", ">"], // Chevrons
  ['"', '"'], // Guillemets doubles
  ["'", "'"], // Apostrophe
  ["`", "`"], // Backtick
  ["«", "»"], // Guillemets français
  ["“", "”"], // Guillemets typographiques doubles
  ["‘", "’"], // Guillemets typographiques simples
]);

const closingCharPluginKey = new PluginKey("closingCharPlugin");

function isCharBeforeSpaceOrEmpty(state) {
  const { selection, doc } = state;
  if (!(selection instanceof TextSelection)) return false;

  const pos = selection.from;
  if (pos === 0) return true; // début du doc

  const $pos = doc.resolve(pos);
  const nodeBefore = $pos.nodeBefore;

  if (!nodeBefore) return true;

  if (nodeBefore.isText) {
    const lastChar = nodeBefore.text.charAt(nodeBefore.text.length - 1);
    if (lastChar === " " || pairedCharacters.get(lastChar)) return true;
  }

  return false;
}

function wrapWithPair(openChar, state, dispatch) {
  const closeChar = pairedCharacters.get(openChar);
  if (!closeChar) return false;

  const { from, to, empty } = state.selection;
  if (!dispatch) return true;

  const tr = state.tr; // Une seule transaction pour tout

  if (empty) {
    if (!isCharBeforeSpaceOrEmpty(state)) return false;

    // Insère la paire de caractères
    tr.insertText(openChar + closeChar, from, to);
    tr.setSelection(TextSelection.create(tr.doc, from + 1));

    // Le caractère de fermeture est maintenant à la position from + 1
    const closeCharPosition = from + 1;

    // Ajoute cette information au state du plugin
    const pluginState = closingCharPluginKey.getState(state) || [];
    const newChar = {
      start: from,
      end: closeCharPosition, // Position réelle du caractère de fermeture
      char: closeChar,
    };
    const newState = [...pluginState, newChar];

    // Ajoute les métadonnées à la MÊME transaction
    tr.setMeta(closingCharPluginKey, newState);
  } else {
    const selectedText = state.doc.textBetween(from, to);
    tr.replaceWith(
      from,
      to,
      state.schema.text(openChar + selectedText + closeChar)
    );

    // Calcule la position du caractère de fermeture
    const closeCharPosition = from + 1 + selectedText.length;
    tr.setSelection(
      TextSelection.create(tr.doc, from + 1, from + 1 + selectedText.length)
    );

    const pluginState = closingCharPluginKey.getState(state) || [];
    const newChar = {
      start: from,
      end: closeCharPosition,
      char: closeChar,
    };
    const newState = [...pluginState, newChar];
    tr.setMeta(closingCharPluginKey, newState);
  }

  // Dispatch la transaction complète avec toutes les modifications
  dispatch(tr.scrollIntoView());

  return true;
}

// --- 5️⃣ Skip du closing char ---
function skipClosingChar(typedChar, state, dispatch) {
  const selPos = state.selection.from;
  const nextChar = state.doc.textBetween(selPos, selPos + 1);
  const pluginState = closingCharPluginKey.getState(state) || [];

  console.log("skip step 1");

  const match = pluginState.find(
    (c) => c.end === selPos && c.char === typedChar
  );

  console.log("skip step 2", nextChar, typedChar, selPos, pluginState);
  if (nextChar === typedChar && match) {
    const tr = state.tr.setSelection(
      TextSelection.create(state.doc, selPos + 1)
    );
    console.log("skip step 3");

    dispatch(tr.scrollIntoView());
    return true;
  }

  return false;
}

// --- 6️⃣ Keymap dynamique ---
const dynamicKeymap = {};
for (const open of pairedCharacters.keys()) {
  dynamicKeymap[open] = (state, dispatch) =>
    wrapWithPair(open, state, dispatch);
}
for (const close of pairedCharacters.values()) {
  dynamicKeymap[close] = (state, dispatch) =>
    skipClosingChar(close, state, dispatch);
}

// --- 7️⃣ Plugin complet ---
export const pairedCharPlugin = new Plugin({
  key: closingCharPluginKey,
  state: {
    init() {
      return []; // aucun auto-inserted au début
    },
    apply(tr, autoClosingChars) {
      // Mise à jour des positions via mapping

      console.log(autoClosingChars);
      const newStateFromMeta = tr.getMeta(closingCharPluginKey);

      if (newStateFromMeta !== undefined) {
        return newStateFromMeta;
      }

      const updated = autoClosingChars
        .map((c) => ({
          start: tr.mapping.map(c.start),
          end: tr.mapping.map(c.end),
          char: c.char,
        }))
        // Filtrage des paires supprimées ou dont la sélection est sortie
        .filter((c) => {
          console.log(c);
          const sel = tr.selection.from;
          const inDoc = tr.doc.textBetween(c.end, c.end + 1) === c.char;
          const caretInside = sel >= c.start && sel <= c.end;

          console.log(c, sel, inDoc, caretInside);

          return inDoc || caretInside;
        });

      return updated;
    },
  },
  props: {
    handleKeyDown(view, event) {
      const handler = dynamicKeymap[event.key];
      if (handler) {
        return handler(view.state, view.dispatch);
      }
      return false;
    },
  },
});
