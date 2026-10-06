# ErrorHandling - Component Overview

## Purpose
Provides a shared error taxonomy (IDs + shareable codes), a config-driven error-metadata registry, and the UI + service-worker machinery to display and act on user-facing errors across the extension [[index.ts#L1-L36]](/src/ErrorHandling/index.ts#L1-L36) [[errorConfig.json#L1-L106]](/src/ErrorHandling/errorConfig.json#L1-L106).

## Responsibilities
- Define canonical error IDs and precise per-throw-site error codes [[errorIds.ts#L8-L22]](/src/ErrorHandling/errorIds.ts#L8-L22) [[policyErrorCodes.ts#L37-L92]](/src/ErrorHandling/policyErrorCodes.ts#L37-L92)
- Map Native Messaging Host numeric codes to an errorId/errorCode pair [[nmhErrorCodeMapping.ts#L37-L84]](/src/ErrorHandling/nmhErrorCodeMapping.ts#L37-L84)
- Render error popups over web pages and route user actions (retry/download-logs/sign-in) [[ErrorOverlay/ErrorOverlay.ts#L595-L614]](/src/ErrorHandling/ErrorOverlay/ErrorOverlay.ts#L595-L614) [[ErrorActionHandler.ts#L31-L99]](/src/ErrorHandling/ErrorActionHandler.ts#L31-L99)
- Present a policy-loading / policy-error page with F5 auto-retry [[PolicyLoadingPage/PolicyLoadingPage.ts#L81-L118]](/src/ErrorHandling/PolicyLoadingPage/PolicyLoadingPage.ts#L81-L118)

## Error Taxonomy
- **Error IDs** (user-facing categories): 11 IDs incl. `POLICY_RETRIEVE_FAILED`, `POLICY_ENFORCE_FAILED`, `EPA_NOT_INSTALLED`, `WORKSPACE_APP_ERROR`, session-recording IDs, `UNKNOWN_ERROR`, `FORCE_LOGOUT`/`FORCE_LOGOUT_WARNING` [[errorIds.ts#L8-L22]](/src/ErrorHandling/errorIds.ts#L8-L22).
- **Config entries**: `errorConfig.json` adds display metadata per ID (`titleKey`, `messageKey`, `icon`, `actionable`, `retryable`, optional `possibleFixes`/`signInButton`) plus `BLOCK_URL_ERROR` and `defaultError: UNKNOWN_ERROR` [[errorConfig.json#L1-L106]](/src/ErrorHandling/errorConfig.json#L1-L106).
- **Shareable sub-codes**: `CSA_ERROR_0000xx` for retrieve failures and `CSA_ERROR_0001xx` for enforce failures, assigned at throw sites [[policyErrorCodes.ts#L1-L92]](/src/ErrorHandling/policyErrorCodes.ts#L1-L92).
- **NMH numeric codes**: `1/11/12/13/21/22/91` mapped to the taxonomy above [[nmhErrorCodeMapping.ts#L13-L84]](/src/ErrorHandling/nmhErrorCodeMapping.ts#L13-L84).

## Tech Stack
| Category | Technology | Version |
|----------|-----------|---------|
| Language | TypeScript | ^5.1.6 [[package.json]](/package.json) |
| UI | React + react-dom (content-script overlay host) | ^19.1.0 [[package.json]](/package.json) |
| Platform | Chrome Extension Manifest V3 (service worker + content scripts) | [[ErrorOverlay/ErrorOverlay.ts#L22-L23]](/src/ErrorHandling/ErrorOverlay/ErrorOverlay.ts#L22-L23) |
| Build | webpack | ^5.99.7 [[package.json]](/package.json) |
| Test | Jest | ^29.5.0 [[package.json]](/package.json) |

## Design Decisions
- **Config-driven popup**: display text/behavior lives in `errorConfig.json` fetched at runtime, so most errors need no code change [[ErrorOverlay/ErrorPopup.ts#L74-L105]](/src/ErrorHandling/ErrorOverlay/ErrorPopup.ts#L74-L105).
- **Codes at throw sites**: sub-codes are defined centrally but assigned by throwers, giving users a precise shareable ID without hard-coding in config [[policyErrorCodes.ts#L3-L32]](/src/ErrorHandling/policyErrorCodes.ts#L3-L32).
- **SW-safe overlay module**: `ErrorOverlay.ts` avoids DOM/React so it can run in the MV3 service worker; DOM rendering is delegated to the injected content-script component [[ErrorOverlay/ErrorOverlay.ts#L22-L23]](/src/ErrorHandling/ErrorOverlay/ErrorOverlay.ts#L22-L23) [[ErrorOverlay/ErrorOverlayComponent.tsx#L251-L267]](/src/ErrorHandling/ErrorOverlay/ErrorOverlayComponent.tsx#L251-L267).
- **iframe-isolated popup**: popup UI renders in a sandboxed extension iframe and communicates via `postMessage` with strict origin/source/extension-ID checks [[ErrorOverlay/ErrorOverlayComponent.tsx#L346-L379]](/src/ErrorHandling/ErrorOverlay/ErrorOverlayComponent.tsx#L346-L379).

## Configuration
- **Config file**: `errorConfig.json` — error registry loaded via `chrome.runtime.getURL('ErrorHandling/errorConfig.json')` [[ErrorOverlay/ErrorPopup.ts#L49-L82]](/src/ErrorHandling/ErrorOverlay/ErrorPopup.ts#L49-L82).
- **Feature flags**: overlay display gated by `isAccessBlockedOverlayEnabled` / `isPolicyErrorBlockingOverlayEnabled` [[ErrorOverlay/ErrorOverlay.ts#L460-L471]](/src/ErrorHandling/ErrorOverlay/ErrorOverlay.ts#L460-L471).
- **Manifest exposure**: `ErrorHandling/*` and `SSHRDPFeatureDisabled.html` are web-accessible for `<all_urls>` [[manifest.json#L115-L122]](/src/manifest.json#L115-L122).

## Entry Points
- **ErrorOverlay/ErrorPopup.html** + `ErrorPopup.js` (built from ErrorPopup.ts): the popup shown inside the overlay iframe [[ErrorOverlay/ErrorPopup.html#L1-L42]](/src/ErrorHandling/ErrorOverlay/ErrorPopup.html#L1-L42).
- **PolicyLoadingPage/PolicyLoading.html** + `PolicyLoadingPage.js`: the policy-fetch loading/error page [[PolicyLoadingPage/PolicyLoading.html#L1-L45]](/src/ErrorHandling/PolicyLoadingPage/PolicyLoading.html#L1-L45).
- **ErrorOverlayComponent.js** (built from .tsx): injected content script that hosts the overlay iframe [[ErrorOverlay/ErrorOverlay.ts#L218-L229]](/src/ErrorHandling/ErrorOverlay/ErrorOverlay.ts#L218-L229).

## Testing
- **Framework**: Jest ^29.5.0 [[package.json]](/package.json).
- **Location**: co-located `*.test.ts` / `*.test.tsx` beside each source file.
- **Coverage**: handler, overlay orchestration, overlay component, popup, overlay state store, policy-loading page, NMH mapping, and barrel index all have tests.
