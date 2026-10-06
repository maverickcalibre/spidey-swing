# Popup

Browser-action popup UI shown when the user clicks the extension toolbar icon. Declared as the action popup in the extension manifest [[manifest.json#L81-L82]](/src/manifest.json#L81-L82).

## Contents

- [component_overview.md](component_overview.md) — purpose, tech stack, entry points
- [architecture.md](architecture.md) — internal structure and data flow
- [dependencies.md](dependencies.md) — imports and Chrome APIs used
- [key-classes.md](key-classes.md) — key functions and handlers
- [interactions.md](interactions.md) — service worker, storage, and cross-component interactions

## Quick Facts

- Component type: application (UI page)
- Entry point: `popup.html` loads `popup.js` (bundled from `popup.ts`) [[popup.html#L63]](/src/Popup/popup.html#L63)
- Runtime logic is a single IIFE in `popup.ts` [[popup.ts#L13-L249]](/src/Popup/popup.ts#L13-L249)
- Files: `popup.html`, `popup.ts`, `popup.css`, `icons/` (SVG assets), `popup.test.ts` (tests)
