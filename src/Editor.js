import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser } from "prosemirror-model";
import { schema } from "prosemirror-schema-basic";
import { history } from "prosemirror-history";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";

import placeholderPlugin from "./plugin/placeholderPlugin";
import { pairedCharPlugin } from "./plugin/wrapperPlugin";

const PLACEHOLDER = "Type here";
// Crée l'état initial
const state = EditorState.create({
  doc: DOMParser.fromSchema(schema).parse(document.querySelector("#content")),
  plugins: [history(), keymap(baseKeymap), placeholderPlugin(PLACEHOLDER), pairedCharPlugin],
});

// Monte la vue dans le DOM
new EditorView(document.querySelector("#editor"), {
  state,
});
