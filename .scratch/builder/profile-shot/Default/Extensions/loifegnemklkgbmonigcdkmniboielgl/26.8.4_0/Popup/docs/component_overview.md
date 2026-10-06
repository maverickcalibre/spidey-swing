# Popup - Component Overview

## Purpose

The browser-action popup UI displayed from the extension toolbar icon, offering quick-launch tool buttons, a session-recording notice, and a policy-sync panel. It is a thin presentation layer that opens Citrix tool tabs and delegates policy sync to the service worker.

## Responsibilities

- Render tool buttons (SSH, Remote Desktop, SMB), gated by feature flags, and open the corresponding Citrix domain in a new tab [[popup.ts#L36-L50]](/src/Popup/popup.ts#L36-L50) [[popup.ts#L112-L174]](/src/Popup/popup.ts#L112-L174)
- Show a session-recording notice driven by session storage state [[popup.ts#L176-L205]](/src/Popup/popup.ts#L176-L205)
- Trigger policy sync via the service worker and display last-attempted / last-success sync timestamps [[popup.ts#L74-L110]](/src/Popup/popup.ts#L74-L110)
- Display the extension version from the manifest [[popup.ts#L24-L34]](/src/Popup/popup.ts#L24-L34)

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Language | TypeScript | ^5.1.6 [[package.json#L78]](/package.json#L78) |
| Platform Target | Chrome extension (Manifest V3) | `minimum_chrome_version` 138 [[manifest.json#L7]](/src/manifest.json#L7) |
| UI | Plain HTML/CSS + DOM APIs (no framework) | [[popup.html#L1-L65]](/src/Popup/popup.html#L1-L65) |
| Testing | Jest | ^29.5.0 [[package.json#L66]](/package.json#L66) |

## Key Libraries

- No third-party UI libraries; the popup uses browser DOM APIs and `chrome.*` extension APIs directly [[popup.ts#L24-L219]](/src/Popup/popup.ts#L24-L219)

## Design Decisions

- **IIFE module scope**: all logic runs inside a single immediately-invoked function to avoid leaking globals [[popup.ts#L13-L249]](/src/Popup/popup.ts#L13-L249)
- **Feature-flag gating**: SSH, RDP, SMB, and the sync-UI panel are each shown/hidden based on feature flags at bind time [[popup.ts#L119-L173]](/src/Popup/popup.ts#L119-L173)
- **Width toggles on `data-sync-enabled`**: the `.popup` element's `dataset.syncEnabled` is set from the sync feature flag to control layout [[popup.ts#L231-L235]](/src/Popup/popup.ts#L231-L235) [[popup.css#L15-L16]](/src/Popup/popup.css#L15-L16)

## Configuration

- **Feature flags**: `SSH`, `RDP`, `SMB`, `SPA_POLICY_SYNC_UI` via `getFeatureFlag` [[popup.ts#L119-L162]](/src/Popup/popup.ts#L119-L162)
- **Localization**: `data-i18n` attributes in markup, initialized by `initializeLocalization` [[popup.html#L21-L60]](/src/Popup/popup.html#L21-L60) [[popup.ts#L226]](/src/Popup/popup.ts#L226)

## Entry Points

- **`popup.html`**: popup document declared as `action.default_popup` in the manifest [[manifest.json#L81-L82]](/src/manifest.json#L81-L82)
- **`popup.ts`** (bundled to `popup.js`): script loaded by the page; `initializePopup()` runs on load [[popup.html#L63]](/src/Popup/popup.html#L63) [[popup.ts#L221-L248]](/src/Popup/popup.ts#L221-L248)

## Testing

- **Test framework**: Jest [[package.json#L66]](/package.json#L66)
- **Test location**: `popup.test.ts` co-located in `src/Popup/`
- **Coverage notes**: test file exists; contents not analyzed
