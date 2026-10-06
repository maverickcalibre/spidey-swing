# ErrorHandling - Dependencies Documentation

> **Scope**: ErrorHandling component only.

## External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.1.0 | Overlay host component + hooks [[ErrorOverlay/ErrorOverlayComponent.tsx#L3-L4]](/src/ErrorHandling/ErrorOverlay/ErrorOverlayComponent.tsx#L3-L4) |
| react-dom | ^19.1.0 | `createRoot` rendering of the injected overlay [[ErrorOverlay/ErrorOverlayComponent.tsx#L4-L4]](/src/ErrorHandling/ErrorOverlay/ErrorOverlayComponent.tsx#L4-L4) |
| Chrome Extension APIs | MV3 | `chrome.tabs`, `chrome.runtime`, `chrome.scripting`, session storage [[ErrorOverlay/ErrorOverlay.ts#L218-L229]](/src/ErrorHandling/ErrorOverlay/ErrorOverlay.ts#L218-L229) |

Versions from [[package.json]](/package.json).

## Internal Dependencies

Modules imported from other components in the workspace:

| Import Path | Source Component | Purpose |
|-------------|-----------------|---------|
| `../constants` / `../../constants` (`EVENT_TYPES`, `PolicyFetchState`) | constants | Action/event type strings and policy-fetch state enum [[ErrorActionHandler.ts#L4-L4]](/src/ErrorHandling/ErrorActionHandler.ts#L4-L4) [[PolicyLoadingPage/PolicyLoadingPage.ts#L3-L3]](/src/ErrorHandling/PolicyLoadingPage/PolicyLoadingPage.ts#L3-L3) |
| `@logger/Logger` / `../../Logger/Logger` | Logger | Structured logging [[ErrorActionHandler.ts#L3-L3]](/src/ErrorHandling/ErrorActionHandler.ts#L3-L3) [[ErrorOverlay/ErrorOverlayComponent.tsx#L5-L5]](/src/ErrorHandling/ErrorOverlay/ErrorOverlayComponent.tsx#L5-L5) |
| `../../FeatureFlag/feature_flags` | FeatureFlag | Gate overlay display by flag [[ErrorOverlay/ErrorOverlay.ts#L13-L16]](/src/ErrorHandling/ErrorOverlay/ErrorOverlay.ts#L13-L16) |
| `../../Utils/auth_utils` (`isUserLoggedOut`) | Utils | Suppress overlays when logged out [[ErrorOverlay/ErrorOverlay.ts#L16-L16]](/src/ErrorHandling/ErrorOverlay/ErrorOverlay.ts#L16-L16) |
| `../../Utils/domain_pattern_utils` (`isUrlHostnameMatched`) | Utils | Exclude host patterns from overlays [[ErrorOverlay/ErrorOverlay.ts#L17-L17]](/src/ErrorHandling/ErrorOverlay/ErrorOverlay.ts#L17-L17) |
| `../../Utils/url_utils` (`generateHostnamePatterns`) | Utils | Build hostname regex patterns for domain-policy matching [[ErrorOverlay/ErrorOverlay.ts#L18-L18]](/src/ErrorHandling/ErrorOverlay/ErrorOverlay.ts#L18-L18) |
| `../../Storage/SessionStorage` (`sessionStorage`) | Storage | Persist overlay state across SW restarts [[ErrorOverlay/OverlayStateStore.ts#L3-L3]](/src/ErrorHandling/ErrorOverlay/OverlayStateStore.ts#L3-L3) |
| `../../Localization/localization` | Localization | Translate popup labels/messages [[ErrorOverlay/ErrorPopup.ts#L5-L5]](/src/ErrorHandling/ErrorOverlay/ErrorPopup.ts#L5-L5) |

## Runtime Dependencies

| Runtime | Purpose |
|---------|---------|
| Chrome (Manifest V3) service worker + content scripts | Hosts orchestration and injected overlay [[ErrorOverlay/ErrorOverlay.ts#L22-L23]](/src/ErrorHandling/ErrorOverlay/ErrorOverlay.ts#L22-L23) |

## Notes
- `PolicyLoadingPage.ts` runs outside the extension module context and uses a global `window.sshRdpLogger` bridge rather than the imported Logger [[PolicyLoadingPage/PolicyLoadingPage.ts#L6-L11]](/src/ErrorHandling/PolicyLoadingPage/PolicyLoadingPage.ts#L6-L11).
