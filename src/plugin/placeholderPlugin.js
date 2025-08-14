import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export default function placeholderPlugin(text) {
  return new Plugin({
    props: {
      decorations(state) {
        const decorations = [];
        const { doc } = state;

        if (
          doc.childCount === 1 &&
          doc.firstChild.isTextblock &&
          doc.firstChild.content.size === 0
        ) {
          const deco = Decoration.node(0, doc.content.size, {
            class: "empty",
            "data-placeholder": text,
          });
          decorations.push(deco);
        }

        return DecorationSet.create(doc, decorations);
      },
    },
  });
}
