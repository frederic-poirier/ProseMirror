import { Plugin, PluginKey } from "prosemirror-state";

// Clé du plugin
export const selectionTrackerKey = new PluginKey("selectionTracker");

export const selectionTrackerPlugin = new Plugin({
  key: selectionTrackerKey,

  // Initial state du plugin (optionnel)
  state: {
    init() { return null; },
    apply(tr, value) {
      // On ne stocke rien dans le plugin state pour le moment
      return value;
    }
  },

  // Fonction appelée à chaque update de view
  view(editorView) {
    return {
      update: (view, prevState) => {
        const { from, to } = view.state.selection;

        // Si la sélection a changé
        if (!prevState.selection.eq(view.state.selection)) {
          // Envoi vers l'extérieur
          const event = new CustomEvent("pm-selection-change", {
            detail: { from, to }
          });
          window.dispatchEvent(event);
        }
      }
    };
  }
});



const divChange = document.getElementById('change');
divChange.innerText = `SELECTION: 0`

window.addEventListener('pm-selection-change', (e) => {
    const empty = e.detail.from === e.detail.to ? e.detail.from : `${e.detail.from} -> ${e.detail.to}`
    divChange.innerText = `SELECTION: ${empty}`
})

