# Popup - Dependencies Documentation

> **Scope**: Popup component

## Internal Dependencies

Modules imported by `popup.ts` from other parts of the workspace [[popup.ts#L3-L11]](/src/Popup/popup.ts#L3-L11):

| Import Path | Provides | Purpose |
|-------------|----------|---------|
| `@logger/Logger` | `logger` | Info/error logging |
| `../Analytics/AnalyticsEventClient` | `logAnalyticsUserInteractionEvent` | Report tap/click analytics events |
| `../Analytics/AnalyticsEventNames` | `TAP_ACTION_EVENTS` | Analytics event name constants |
| `../FeatureFlag/FeatureFlagTypes` | `FeatureFlagKey`, `getFeatureFlag` | Feature-flag gating |
| `../Localization/localization` | `initializeLocalization` | Localize `data-i18n` markup |
| `../Storage` | `localStorage`, `sessionStorage` | Read persisted sync/recording state |
| `../Utils/SSHRDPCommonTypes` | `CITRIXRDP_DOMAIN`, `CITRIXSMB_DOMAIN`, `CITRIXSSH_DOMAIN` | Tool tab target URLs |
| `../Utils/utils` | `recordAttemptedSyncTimestamp`, `recordSuccessSyncTimestamp` | Persist sync timestamps |
| `../constants` | `EVENT_TYPES`, `SYNC_UI_STORAGE_KEYS`, `SessionRecordingStatusKey` | Message type and storage-key constants |

## Runtime Dependencies

| Dependency | Purpose |
|------------|---------|
| Chrome extension APIs (`chrome.runtime`, `chrome.tabs`, `chrome.storage`) | Manifest access, tab creation, service-worker messaging, storage change events [[popup.ts#L26-L208]](/src/Popup/popup.ts#L26-L208) |
| Font asset `../fonts/PublicSans-Regular.otf` | Popup typography via `@font-face` [[popup.css#L1-L7]](/src/Popup/popup.css#L1-L7) |
| SVG icon assets in `icons/` | Header logo and tool-button images [[popup.html#L12-L33]](/src/Popup/popup.html#L12-L33) |

### Chrome APIs Used

- `chrome.runtime.getManifest()` — read extension version [[popup.ts#L26]](/src/Popup/popup.ts#L26)
- `chrome.tabs.create()` — open Citrix tool tabs [[popup.ts#L37-L49]](/src/Popup/popup.ts#L37-L49)
- `chrome.runtime.sendMessage()` — request policy sync from the service worker [[popup.ts#L93-L95]](/src/Popup/popup.ts#L93-L95)
- `chrome.storage.onChanged` — react to session/local storage updates [[popup.ts#L199-L208]](/src/Popup/popup.ts#L199-L208)
