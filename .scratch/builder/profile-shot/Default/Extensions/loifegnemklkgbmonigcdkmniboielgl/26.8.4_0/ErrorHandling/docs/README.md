# ErrorHandling

Centralized error taxonomy, user-facing error pages, and error-action routing for the Citrix Secure Access Chrome extension (Manifest V3).

## What this component provides
- A shared error-ID/error-code taxonomy consumed across the extension [[index.ts#L1-L36]](/src/ErrorHandling/index.ts#L1-L36)
- A metadata registry (titles, messages, icons, actionability) driving the error popup UI [[errorConfig.json#L1-L106]](/src/ErrorHandling/errorConfig.json#L1-L106)
- Service-worker overlay orchestration to show/hide error popups on web pages [[ErrorOverlay/ErrorOverlay.ts#L1-L36]](/src/ErrorHandling/ErrorOverlay/ErrorOverlay.ts#L1-L36)
- Two web-accessible UI surfaces: the RTU error popup and the policy-loading page [[ErrorOverlay/ErrorPopup.html#L1-L42]](/src/ErrorHandling/ErrorOverlay/ErrorPopup.html#L1-L42) [[PolicyLoadingPage/PolicyLoading.html#L1-L45]](/src/ErrorHandling/PolicyLoadingPage/PolicyLoading.html#L1-L45)

## Component type
`library` with bundled UI error pages. It exports an API surface via a barrel module and has no standalone runtime entry point [[index.ts#L1-L36]](/src/ErrorHandling/index.ts#L1-L36). The `ErrorHandling/*` tree is exposed as a web-accessible resource in the manifest [[manifest.json#L115-L122]](/src/manifest.json#L115-L122).

## Docs
- [component_overview.md](component_overview.md) — purpose, tech stack, error taxonomy
- [architecture.md](architecture.md) — layers, diagrams, display flow
- [key-classes.md](key-classes.md) — key types/functions
- [dependencies.md](dependencies.md) — external + internal dependencies
- [interactions.md](interactions.md) — who throws/handles these errors
- [flows/](flows/) — overlay display, user actions, NMH mapping, policy-loading page

## Source layout
- Taxonomy: [errorIds.ts](/src/ErrorHandling/errorIds.ts), [policyErrorCodes.ts](/src/ErrorHandling/policyErrorCodes.ts), [nmhErrorCodeMapping.ts](/src/ErrorHandling/nmhErrorCodeMapping.ts), [errorConfig.json](/src/ErrorHandling/errorConfig.json)
- Action routing: [ErrorActionHandler.ts](/src/ErrorHandling/ErrorActionHandler.ts)
- Overlay: [ErrorOverlay/](/src/ErrorHandling/ErrorOverlay/) (ErrorOverlay.ts, OverlayStateStore.ts, ErrorOverlayComponent.tsx, ErrorPopup.ts/html/css)
- Policy loading page: [PolicyLoadingPage/](/src/ErrorHandling/PolicyLoadingPage/) (PolicyLoadingPage.ts, PolicyLoading.html, PolicyLoadingPage.css)

## Testing
Jest test files exist alongside sources (`*.test.ts` / `*.test.tsx`) for the handler, overlay modules, popup, policy-loading page, NMH mapping, and barrel — not documented here per rules.
