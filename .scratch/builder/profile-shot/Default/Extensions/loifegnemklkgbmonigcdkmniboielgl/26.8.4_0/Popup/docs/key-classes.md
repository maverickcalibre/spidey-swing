# Popup - Key Functions & Handlers

> **Scope**: Popup component. All functions are private helpers inside the `popup.ts` IIFE [[popup.ts#L13-L249]](/src/Popup/popup.ts#L13-L249).

## Overview

`initializePopup()` is the orchestrator run on load; it initializes version and localization, reads feature flags, binds events, and attaches storage listeners. Handlers open tool tabs, drive policy sync, and toggle the recording notice.

## Initialization

### `initializePopup()`
**Source:** `/src/Popup/popup.ts` [[popup.ts#L221-L248]](/src/Popup/popup.ts#L221-L248)
**Purpose:** Entry orchestrator: sets version, localization, sync-enabled layout flag, storage listeners, event bindings, and recording notice.

### `initVersion()`
**Source:** `/src/Popup/popup.ts` [[popup.ts#L24-L34]](/src/Popup/popup.ts#L24-L34)
**Purpose:** Reads `chrome.runtime.getManifest().version` and writes it into `#productVersion`.

### `bindEvents()`
**Source:** `/src/Popup/popup.ts` [[popup.ts#L112-L174]](/src/Popup/popup.ts#L112-L174)
**Purpose:** Feature-flag-gates the SSH/RDP/SMB buttons and sync UI, attaches click handlers, and toggles the tools section (including a single-item layout class).

## Action Handlers

| Name | Parameters | Returns | Description |
|------|------------|---------|-------------|
| `onSSHClientClick()` | none | `void` | Opens `CITRIXSSH_DOMAIN` in a new tab and logs `SSH_BUTTON_CLICK` [[popup.ts#L36-L40]](/src/Popup/popup.ts#L36-L40) |
| `onRemoteDesktopClick()` | none | `void` | Opens `CITRIXRDP_DOMAIN` in a new tab and logs `RDP_BUTTON_CLICK` [[popup.ts#L42-L46]](/src/Popup/popup.ts#L42-L46) |
| `onSMBClientClick()` | none | `void` | Opens `CITRIXSMB_DOMAIN` in a new tab [[popup.ts#L48-L50]](/src/Popup/popup.ts#L48-L50) |
| `onSyncPoliciesClick()` | none | `Promise<void>` | Sends `SYNC_POLICIES` to the service worker, logs analytics, and records success/failure timestamps [[popup.ts#L90-L110]](/src/Popup/popup.ts#L90-L110) |

## Sync Timestamp Helpers

| Name | Parameters | Returns | Description |
|------|------------|---------|-------------|
| `recordSyncSuccessTimestamp()` | none | `Promise<void>` | Records attempted + success timestamps and refreshes UI [[popup.ts#L53-L62]](/src/Popup/popup.ts#L53-L62) |
| `recordSyncFailureTimestamp()` | none | `Promise<void>` | Records only the attempted timestamp and refreshes UI [[popup.ts#L65-L71]](/src/Popup/popup.ts#L65-L71) |
| `refreshSyncTimestampsUI()` | none | `Promise<void>` | Reads `SYNC_UI_STORAGE_KEYS` from localStorage into `#lastAttemptedSyncValue` and `#lastSyncValue` [[popup.ts#L74-L88]](/src/Popup/popup.ts#L74-L88) |
| `bindSyncTimestampListener()` | none | `void` | Listens on the `local` storage area and refreshes timestamps on change [[popup.ts#L207-L219]](/src/Popup/popup.ts#L207-L219) |

## Recording Notice Helpers

| Name | Parameters | Returns | Description |
|------|------------|---------|-------------|
| `applyRecordingNotice()` | `isActive: boolean` | `void` | Shows/hides `#recordingNotice` [[popup.ts#L176-L181]](/src/Popup/popup.ts#L176-L181) |
| `loadRecordingNotice()` | none | `Promise<void>` | Reads `SessionRecordingStatusKey` from sessionStorage and applies notice state [[popup.ts#L183-L193]](/src/Popup/popup.ts#L183-L193) |
| `bindRecordingNoticeListener()` | none | `void` | Listens on the `session` storage area for recording-status changes [[popup.ts#L195-L205]](/src/Popup/popup.ts#L195-L205) |

## Utility

| Name | Parameters | Returns | Description |
|------|------------|---------|-------------|
| `getErrorMessage()` | `error: unknown` | `string` | Normalizes an error/string/unknown into a message string [[popup.ts#L14-L22]](/src/Popup/popup.ts#L14-L22) |
