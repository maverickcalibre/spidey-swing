// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

/**
 * ErrorOverlay.ts - Popup/Overlay (RTU) Error Display System
 *
 * Handles overlay-based error display on web pages using content script injection.
 * Uses simple state management for tracking active overlays.
 */

import logger from '@logger/Logger';
import { EVENT_TYPES } from '../../constants';
import {
	isAccessBlockedOverlayEnabled,
	isPolicyErrorBlockingOverlayEnabled,
} from '../../FeatureFlag/feature_flags';
import { isUserLoggedOut } from '../../Utils/auth_utils';
import { isUrlHostnameMatched } from '../../Utils/domain_pattern_utils';
import { generateHostnamePatterns as generateRegexPatternsFromHostname } from '../../Utils/url_utils';
import { ErrorActionHandler, type ErrorActionCallback } from '../ErrorActionHandler';
import { OverlayStateStore } from './OverlayStateStore';

// Keep these SW-safe: this module is used from the MV3 service worker.
export const ERROR_MODULE_NAME = 'message-overlay';

interface OverlayCriteria {
	errorId: string;
	transactionId?: string;
	errorCode?: string;
	domainPolicyMap: Record<string, boolean>;
	excludedHostPatterns?: string[];
}

export interface DisplayOverlayOptions {
	trackNewTabs?: boolean;
	excludedHostPatterns?: string[];
}

function isValidNavigationUrl(url: string): boolean {
	return url.startsWith('http://') || url.startsWith('https://');
}

function isOverlayExcludedUrl(url: string, excludedHostPatterns?: string[]): boolean {
	return isUrlHostnameMatched(url, excludedHostPatterns);
}

function shouldDeliverOverlayToTab(
	url: string | undefined,
	criteria: { domainPolicyMap?: Record<string, boolean>; excludedHostPatterns?: string[] }
): boolean {
	if (!url || !isValidNavigationUrl(url)) {
		return false;
	}
	if (isOverlayExcludedUrl(url, criteria.excludedHostPatterns)) {
		return false;
	}
	return criteria.domainPolicyMap ? shouldShowOverlayOnTab(url, criteria.domainPolicyMap) : true;
}

const HOSTNAME_PATTERN_CACHE_MAX_SIZE = 300;
const hostnamePatternCache = new Map<string, string[]>();

let errorActionHandler: ErrorActionHandler | null = null;
let isErrorActionListenerRegistered = false;
let trackedOverlayCriteria: OverlayCriteria | null = null;
let isOverlayTabListenerRegistered = false;
const overlaySendInFlight = new Set<number>();
let overlayTabUpdatedListener:
	| ((tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => void)
	| null = null;
let overlayTabRemovedListener: ((tabId: number) => void) | null = null;

function triggerOverlaySendIfIdle(
	tabId: number,
	errorId: string,
	transactionId?: string,
	errorCode?: string
): void {
	if (overlaySendInFlight.has(tabId)) {
		return;
	}

	overlaySendInFlight.add(tabId);
	void sendOverlayToTab(tabId, errorId, transactionId, errorCode).finally(() => {
		overlaySendInFlight.delete(tabId);
	});
}

function handleOverlayTabUpdated(
	tabId: number,
	changeInfo: chrome.tabs.TabChangeInfo,
	tab: chrome.tabs.Tab
): void {
	if (changeInfo.status !== 'complete') {
		return;
	}

	if (!tab?.url || !isValidNavigationUrl(tab.url)) {
		return;
	}

	const currentCriteria = trackedOverlayCriteria;
	if (isOverlayExcludedUrl(tab.url, currentCriteria?.excludedHostPatterns)) {
		return;
	}

	let overlayState = overlayStore.get(tabId);

	if (overlayState && currentCriteria) {
		const matchesCurrentCriteria = shouldShowOverlayOnTab(tab.url, currentCriteria.domainPolicyMap);
		if (overlayState.errorId !== currentCriteria.errorId || !matchesCurrentCriteria) {
			cleanupRTUOverlayForTab(tabId);
			overlayState = undefined;
		}
	}

	if (overlayState) {
		triggerOverlaySendIfIdle(
			tabId,
			overlayState.errorId,
			overlayState.transactionId,
			overlayState.errorCode
		);
		return;
	}

	if (currentCriteria && shouldShowOverlayOnTab(tab.url, currentCriteria.domainPolicyMap)) {
		triggerOverlaySendIfIdle(
			tabId,
			currentCriteria.errorId,
			currentCriteria.transactionId,
			currentCriteria.errorCode
		);
		return;
	}
}

function ensureOverlayTabListenerRegistered(): void {
	if (isOverlayTabListenerRegistered) {
		return;
	}

	overlayTabUpdatedListener = handleOverlayTabUpdated;
	chrome.tabs.onUpdated.addListener(overlayTabUpdatedListener);

	overlayTabRemovedListener = cleanupRTUOverlayForTab;
	chrome.tabs.onRemoved.addListener(overlayTabRemovedListener);

	isOverlayTabListenerRegistered = true;
}

function unregisterOverlayTabListeners(): void {
	if (!isOverlayTabListenerRegistered) {
		return;
	}

	if (overlayTabUpdatedListener && chrome?.tabs?.onUpdated?.removeListener) {
		chrome.tabs.onUpdated.removeListener(overlayTabUpdatedListener);
	}

	if (overlayTabRemovedListener && chrome?.tabs?.onRemoved?.removeListener) {
		chrome.tabs.onRemoved.removeListener(overlayTabRemovedListener);
	}

	overlayTabUpdatedListener = null;
	overlayTabRemovedListener = null;
	isOverlayTabListenerRegistered = false;
}

function enableOverlayTracking(criteria: OverlayCriteria): void {
	trackedOverlayCriteria = criteria;
	ensureOverlayTabListenerRegistered();
}

function disableOverlayTracking(): void {
	trackedOverlayCriteria = null;
	unregisterOverlayTabListeners();
}

function ensureErrorActionListenerRegistered(): void {
	if (isErrorActionListenerRegistered) {
		return;
	}

	if (!chrome?.runtime?.onMessage?.addListener) {
		return;
	}

	errorActionHandler = new ErrorActionHandler();
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
		if (!errorActionHandler?.canHandle(message)) {
			return false;
		}

		// handleMessage now synchronously returns true and handles async callback execution internally
		return errorActionHandler.handleMessage(message, sender, sendResponse);
	});
	isErrorActionListenerRegistered = true;
}

function toErrorActionCallback(
	callback: (() => void | Promise<void>) | ErrorActionCallback
): ErrorActionCallback {
	// Support three styles:
	// - () => ...
	// - (message) => ...
	// - (message, sender) => ...
	if (callback.length === 0) {
		const noArgCallback = callback as () => void | Promise<void>;
		return async () => {
			await noArgCallback();
		};
	}

	if (callback.length === 1) {
		const messageOnlyCallback = callback as (
			message: Parameters<ErrorActionCallback>[0]
		) => void | Promise<void>;
		return async message => {
			await messageOnlyCallback(message);
		};
	}

	return callback as ErrorActionCallback;
}

async function ensureOverlayContentScriptInjected(tabId: number): Promise<void> {
	// When the extension is (re)loaded, MV3 content scripts may not be present on already-open tabs.
	// Inject the overlay listener script on-demand so the popup shows immediately.
	if (!chrome?.scripting?.executeScript) {
		return;
	}

	await chrome.scripting.executeScript({
		target: { tabId },
		files: ['ErrorOverlayComponent.js'],
	});
}

// Helper function for consistent error logging
function logError(message: string, error: unknown): void {
	const errorMessage = error instanceof Error ? error.message : 'Unknown error';
	logger.logError(ERROR_MODULE_NAME, `${message}: ${errorMessage}`);
}

const overlayStore = new OverlayStateStore('rtu-overlay-state', logError);

function buildOverlayShowMessage(
	tabId: number,
	errorId: string,
	transactionId?: string,
	errorCode?: string
): {
	action: typeof EVENT_TYPES.ERROR_OVERLAY_SHOW;
	errorId: string;
	tabId: number;
	transactionId?: string;
	errorCode?: string;
} {
	return {
		action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
		errorId,
		tabId,
		transactionId,
		errorCode,
	};
}

function generateHostnamePatterns(hostname: string): string[] {
	const cached = hostnamePatternCache.get(hostname);
	if (cached) {
		return cached;
	}

	const patterns = generateRegexPatternsFromHostname(hostname);

	if (hostnamePatternCache.size >= HOSTNAME_PATTERN_CACHE_MAX_SIZE) {
		hostnamePatternCache.delete(hostnamePatternCache.keys().next().value);
	}
	hostnamePatternCache.set(hostname, patterns);
	return patterns;
}

function isHostnameBlocked(hostname: string, domainPolicyMap: Record<string, boolean>): boolean {
	const match = generateHostnamePatterns(hostname).find(pattern => pattern in domainPolicyMap);
	return match !== undefined ? !domainPolicyMap[match] : false;
}

function isTabUrlAccessBlocked(tabUrl: string, domainPolicyMap: Record<string, boolean>): boolean {
	try {
		const url = new URL(tabUrl);
		const hostname = url.hostname.toLowerCase();
		return isHostnameBlocked(hostname, domainPolicyMap);
	} catch {
		return false;
	}
}

function shouldShowOverlayOnTab(tabUrl: string, domainPolicyMap: Record<string, boolean>): boolean {
	if (Object.keys(domainPolicyMap).length === 0) {
		return true;
	}
	return isTabUrlAccessBlocked(tabUrl, domainPolicyMap);
}

async function getTargetTabsForOverlay(
	domainPolicyMap?: Record<string, boolean>,
	excludedHostPatterns?: string[]
): Promise<chrome.tabs.Tab[]> {
	const allTabs = await chrome.tabs.query({});
	return allTabs.filter(tab =>
		shouldDeliverOverlayToTab(tab.url, { domainPolicyMap, excludedHostPatterns })
	);
}

function getOverlayTabIds(targetTabs: chrome.tabs.Tab[]): number[] {
	const targetTabIds: number[] = [];
	for (const tab of targetTabs) {
		if (!tab.id) {
			continue;
		}

		targetTabIds.push(tab.id);
	}

	return targetTabIds;
}

async function sendOverlayToTab(
	tabId: number,
	errorId: string,
	transactionId?: string,
	errorCode?: string
): Promise<boolean> {
	// content.js is always present on every tab, so sendMessage never rejects even when
	// ErrorOverlayComponent.js is absent — it just resolves undefined (no sendResponse called).
	// Treat any non-success response as "overlay listener missing" and inject before retrying.
	const response = await chrome.tabs
		.sendMessage(tabId, buildOverlayShowMessage(tabId, errorId, transactionId, errorCode))
		.catch((): null => null);

	if (response?.success === true) {
		overlayStore.set(tabId, { errorId, transactionId, errorCode });
		return true;
	}

	// response is undefined (content.js present, overlay script absent) or null (rejected — no scripts at all)
	logger.logInfo(
		ERROR_MODULE_NAME,
		`Initial message failed for tab ${tabId}, attempting content script injection`
	);

	try {
		await ensureOverlayContentScriptInjected(tabId);
		await chrome.tabs.sendMessage(
			tabId,
			buildOverlayShowMessage(tabId, errorId, transactionId, errorCode)
		);
		overlayStore.set(tabId, { errorId, transactionId, errorCode });
		return true;
	} catch (retryError) {
		logError(`Failed to inject and send overlay to tab ${tabId}`, retryError);
		return false;
	}
}

function buildOverlayDismissMessage(
	tabId: number,
	errorId?: string
): {
	action: typeof EVENT_TYPES.ERROR_OVERLAY_DISMISS;
	tabId: number;
	errorId?: string;
} {
	return {
		action: EVENT_TYPES.ERROR_OVERLAY_DISMISS,
		tabId,
		...(errorId ? { errorId } : {}),
	};
}

async function dismissOverlayOnTab(tabId: number, errorId?: string): Promise<void> {
	try {
		await chrome.tabs.sendMessage(tabId, buildOverlayDismissMessage(tabId, errorId));
		return;
	} catch {
		if (!(await isTabStillAlive(tabId))) {
			return;
		}
	}

	// Listener is missing (e.g., after extension reload) — fall back to direct DOM cleanup.
	try {
		await chrome.scripting.executeScript({
			target: { tabId },
			func: removeInjectedOverlayFromPage,
		});
	} catch (error) {
		logError(`Failed to directly dismiss overlay on tab ${tabId}`, error);
	}
}

async function isTabStillAlive(tabId: number): Promise<boolean> {
	try {
		await chrome.tabs.get(tabId);
		return true;
	} catch {
		// chrome.tabs.get rejects for any non-existent tab regardless of locale
		return false;
	}
}

function removeInjectedOverlayFromPage(): void {
	document.getElementById('ds-error-overlay-style')?.remove();
	document.body.classList.remove('ds-error-overlay-active');
	document.body.style.overflow = '';
	document.body.style.position = '';
	document.body.style.width = '';
	for (const overlay of document.querySelectorAll('#ds-error-react-root')) {
		overlay.remove();
	}
}

function getDismissTargetTabIds(targetTabId?: number): number[] {
	if (targetTabId) {
		return overlayStore.has(targetTabId) ? [targetTabId] : [];
	}

	return Array.from(overlayStore.keys());
}

async function dismissOverlaysOnTabs(tabIds: number[], errorId?: string): Promise<void> {
	await Promise.allSettled(tabIds.map(tabId => dismissOverlayOnTab(tabId, errorId)));
}

function cleanupOverlayTrackingAfterDismiss(targetTabId?: number): void {
	if (targetTabId) {
		overlayStore.delete(targetTabId);
	} else {
		overlayStore.clear();
	}
}

// Export cleanup function for external use (e.g., service worker tab removal)
export function cleanupRTUOverlayForTab(tabId: number): void {
	overlayStore.delete(tabId);
	overlaySendInFlight.delete(tabId);
}

/**
 * FORCE_LOGOUT is already gated upstream by isBrowserSessionReauthFeatureEnabled() plus the
 * browser_session_reauth_v1 customer policy (service_worker.ts, PolicyRelayOrchestrator.ts) —
 * it must display independently of the unrelated policy-error-blocking flag below.
 */
function isOverlayFeatureEnabled(errorId: string): boolean {
	if (errorId === 'BLOCK_URL_ERROR') {
		return isAccessBlockedOverlayEnabled();
	}
	if (errorId === 'FORCE_LOGOUT') {
		return true;
	}
	return isPolicyErrorBlockingOverlayEnabled();
}

async function displayOverlayInternal(
	errorId: string,
	domainPolicyMap: Record<string, boolean>,
	transactionId?: string,
	errorCode?: string,
	onRetry?: (() => void | Promise<void>) | ErrorActionCallback,
	onCancel?: (() => void | Promise<void>) | ErrorActionCallback,
	options?: DisplayOverlayOptions,
	onSignIn?: (() => void | Promise<void>) | ErrorActionCallback,
	excludedHostPatterns?: string[]
): Promise<void> {
	const isAccessBlocked = errorId === 'BLOCK_URL_ERROR';
	const isOverlayEnabled = isOverlayFeatureEnabled(errorId);

	if (!isOverlayEnabled) {
		logger.logInfo(
			ERROR_MODULE_NAME,
			`${isAccessBlocked ? 'Access blocked overlay' : 'Policy error blocking'} is not enabled, skipping overlay display`
		);
		return;
	}

	// Access-blocked overlays must only reach tabs whose URL is in the blocked-domain map.
	// An empty map makes shouldShowOverlayOnTab treat every tab as eligible (empty map ==
	// "all tabs"), which would silently turn BLOCK_URL_ERROR into a deliver-everywhere
	// overlay — the exact spurious "Access Restricted" overlay CTXBR-13845 fixed. Callers
	// are expected to arm this only with a non-empty map; enforce the invariant here so a
	// future caller cannot re-introduce the bug.
	if (isAccessBlocked && Object.keys(domainPolicyMap).length === 0) {
		logger.logInfo(
			ERROR_MODULE_NAME,
			'Access blocked overlay requested with an empty domain policy map; skipping to avoid delivering to all tabs'
		);
		return;
	}

	// FORCE_LOGOUT is the only overlay that must keep rendering while the user is
	// logged out — the logged-out state is precisely the reason to show it (re-auth
	// prompt). All other overlays are still suppressed when there is no session.
	if ((await isUserLoggedOut()) && errorId !== 'FORCE_LOGOUT') {
		disableOverlayTracking();
		logger.logInfo(ERROR_MODULE_NAME, 'User is logged out: skipping overlay display');
		return;
	}

	if (!excludedHostPatterns) {
		excludedHostPatterns = [];
	}

	if (options?.trackNewTabs) {
		enableOverlayTracking({
			errorId,
			transactionId,
			errorCode,
			domainPolicyMap,
			excludedHostPatterns,
		});
	} else {
		disableOverlayTracking();
	}

	if (onRetry || onCancel || onSignIn) {
		ensureErrorActionListenerRegistered();
		if (errorActionHandler) {
			if (onRetry) {
				errorActionHandler.setRetryCallback(toErrorActionCallback(onRetry));
			}
			if (onCancel) {
				errorActionHandler.setCancelCallback(toErrorActionCallback(onCancel));
			}
			if (onSignIn) {
				errorActionHandler.setSignInCallback(toErrorActionCallback(onSignIn));
			}
		}
	}

	try {
		const targetTabs =
			Object.keys(domainPolicyMap).length > 0
				? await getTargetTabsForOverlay(domainPolicyMap, excludedHostPatterns)
				: await getTargetTabsForOverlay(undefined, excludedHostPatterns);
		const newTabIds = getOverlayTabIds(targetTabs);
		if (newTabIds.length === 0) {
			return;
		}

		for (const tabId of newTabIds) {
			await sendOverlayToTab(tabId, errorId, transactionId, errorCode);
		}
	} catch (error) {
		logError('Error in displayErrorOverlay', error);
		throw error;
	}
}

export async function displayAccessBlockedErrorOverlay(
	domainPolicyMap: Record<string, boolean>,
	transactionId?: string,
	onRetry?: (() => void | Promise<void>) | ErrorActionCallback,
	onCancel?: (() => void | Promise<void>) | ErrorActionCallback
): Promise<void> {
	await displayOverlayInternal(
		'BLOCK_URL_ERROR',
		domainPolicyMap,
		transactionId,
		undefined,
		onRetry,
		onCancel,
		{ trackNewTabs: true }
	);
}

/**
 * Show force logout overlay on all tabs matching inclusion domains.
 * Displays a sign-in button instead of retry/download logs.
 */
export async function displayForceLogoutOverlay(
	onSignIn: (() => void | Promise<void>) | ErrorActionCallback,
	options?: DisplayOverlayOptions,
	excludedHostPatterns?: string[]
): Promise<void> {
	await displayOverlayInternal(
		'FORCE_LOGOUT',
		{},
		undefined,
		undefined,
		undefined,
		undefined,
		options,
		onSignIn,
		excludedHostPatterns
	);
}

/**
 * Show force logout warning overlay on all tabs matching inclusion domains.
 * Displays a sign-in button instead of retry/download logs.
 */
export async function displayForceLogoutWarningOverlay(
	onSignIn: (() => void | Promise<void>) | ErrorActionCallback,
	options?: DisplayOverlayOptions
): Promise<void> {
	await displayOverlayInternal(
		'FORCE_LOGOUT_WARNING',
		{},
		undefined,
		undefined,
		undefined,
		undefined,
		options,
		onSignIn
	);
}

/**
 * Show popup error overlays on tabs
 * Pure overlay injection approach - no DNR rules
 */
export async function displayErrorOverlay(
	errorId: string,
	transactionId?: string,
	errorCode?: string,
	onRetry?: (() => void | Promise<void>) | ErrorActionCallback,
	onCancel?: (() => void | Promise<void>) | ErrorActionCallback,
	options?: DisplayOverlayOptions
): Promise<void> {
	await displayOverlayInternal(
		errorId,
		{},
		transactionId,
		errorCode,
		onRetry,
		onCancel,
		options,
		undefined,
		options?.excludedHostPatterns
	);
}

/**
 * Retry overlay delivery for a specific tab.
 *
 * @param tabId - the tab to (re)deliver the tracked overlay to
 * @param tabUrl - the tab's current URL if the caller already has it (e.g. the message
 *   sender's tab); when omitted the URL is looked up via chrome.tabs.get.
 */
export async function retryOverlayForTab(tabId: number, tabUrl?: string): Promise<void> {
	// Nothing to retry if tracking is off or the overlay was already delivered here.
	// Snapshot the shared criteria immediately: this handler suspends on the awaits
	// below, and a concurrent overlay-clear (disableOverlayTracking) can null
	// trackedOverlayCriteria while we are suspended. Reading the field after an await
	// would then throw. The captured intent drives this in-flight delivery.
	const criteria = trackedOverlayCriteria;
	if (!criteria || overlayStore.has(tabId)) {
		return;
	}

	const isOverlayEnabled = isOverlayFeatureEnabled(criteria.errorId);
	if (!isOverlayEnabled) {
		return;
	}

	// Mirror the FORCE_LOGOUT exception in displayOverlayInternal: this overlay must still
	// be delivered to newly opened/rewritten tabs (e.g. SSH/RDP) while the user is logged
	// out — the logged-out state is precisely the reason to show the re-auth prompt.
	const isForceLogout = criteria.errorId === 'FORCE_LOGOUT';
	if (!isForceLogout && (await isUserLoggedOut())) {
		return;
	}

	// Gate delivery on the tab URL so a tracked overlay is never delivered to a tab that does
	// not match the criteria (e.g. the SSH gateway page on reconnect, which is not in the
	// blocked-domain map). Prefer the URL the caller already holds (the message sender's tab)
	// and only fall back to a tabs.get lookup when it was not supplied.
	const url = tabUrl ?? (await chrome.tabs.get(tabId).catch((): null => null))?.url;
	if (!shouldDeliverOverlayToTab(url, criteria)) {
		return;
	}

	// Re-check both tracking and delivery state after the awaits above. A concurrent
	// hideOverlayErrors()/disableOverlayTracking() may have cleared or replaced tracking
	// (the criteria this retry captured is no longer the active overlay — deliver nothing),
	// or a concurrent tab-update may have already delivered this overlay
	// (triggerOverlaySendIfIdle only dedupes in-flight sends, not completed ones — avoid a
	// duplicate ERROR_OVERLAY_SHOW).
	if (trackedOverlayCriteria !== criteria || overlayStore.has(tabId)) {
		return;
	}

	triggerOverlaySendIfIdle(tabId, criteria.errorId, criteria.transactionId, criteria.errorCode);
}

/**
 * Hide/dismiss popup error overlays
 * Remove only RTU overlay errors from specific or all tabs
 * Hydrates overlay tracking from session storage on service worker restart before dismissing.
 */
export async function hideOverlayErrors(errorId?: string, targetTabId?: number): Promise<void> {
	// Re-hydrate in-memory state from session storage in case the service worker restarted
	// and lost its in-memory tracking. Tab IDs written to session storage on show are
	// durable across SW idle/restart cycles for the lifetime of the browser session.
	await overlayStore.hydrateIfNeeded();

	if (overlayStore.size === 0) {
		// No overlays tracked — either none were ever shown or all have been dismissed.
		if (!targetTabId) {
			disableOverlayTracking();
		}
		return;
	}

	try {
		const targetTabIds = getDismissTargetTabIds(targetTabId);
		if (targetTabId && targetTabIds.length === 0) {
			return;
		}

		await dismissOverlaysOnTabs(targetTabIds, errorId);
		cleanupOverlayTrackingAfterDismiss(targetTabId);
		if (!targetTabId) {
			disableOverlayTracking();
		}
	} catch (error) {
		logError('Error dismissing overlay errors', error);
		throw error;
	}
}

/**
 * Handle overlay callback actions (retry/download-logs)
 * Processes user actions from overlay UI
 */
export async function handleOverlayCallback(
	action:
		| typeof EVENT_TYPES.ERROR_ACTION_RETRY
		| typeof EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS
		| typeof EVENT_TYPES.ERROR_ACTION_SIGN_IN,
	url: string,
	tabId: number,
	errorType?: string,
	transactionId?: string
): Promise<boolean> {
	const actionLabels: Record<string, string> = {
		[EVENT_TYPES.ERROR_ACTION_RETRY]: 'retry',
		[EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS]: 'download-logs',
		[EVENT_TYPES.ERROR_ACTION_SIGN_IN]: 'sign-in',
	};
	const actionLabel = actionLabels[action] || action;
	// Avoid logging URLs.
	logger.logInfo(ERROR_MODULE_NAME, `Overlay action requested: ${actionLabel} (tabId: ${tabId})`);

	try {
		if (action === EVENT_TYPES.ERROR_ACTION_RETRY) {
			// DIRECT RETRY: Get the tab and reload it

			// Send message to service worker to handle tab reload
			const response = await chrome.runtime.sendMessage({
				action: EVENT_TYPES.ERROR_ACTION_RETRY,
				url: url,
				tabId: tabId,
				errorType,
				transactionId,
			});

			if (response?.success) {
				// success is intentionally not logged
			} else {
				logger.logError(
					ERROR_MODULE_NAME,
					`Tab reload request failed: ${response?.error || 'Unknown error'}`
				);
				return false;
			}
			// Clean up the active overlay tracking for this tab when overlay is dismissed
			overlayStore.delete(tabId);
		} else if (action === EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS) {
			// DOWNLOAD LOGS: Send message to service worker to export logs
			const response = await chrome.runtime.sendMessage({
				action: EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS,
				tabId: tabId,
				errorType,
				transactionId,
			});

			if (response?.success) {
				// success is intentionally not logged
			} else {
				logger.logError(
					ERROR_MODULE_NAME,
					`Logs download failed: ${response?.error || 'Unknown error'}`
				);
				return false;
			}
		} else if (action === EVENT_TYPES.ERROR_ACTION_SIGN_IN) {
			// SIGN IN: Send message to service worker to handle sign-in
			const response = await chrome.runtime.sendMessage({
				action: EVENT_TYPES.ERROR_ACTION_SIGN_IN,
				tabId: tabId,
				errorType,
				transactionId,
			});

			if (response?.success) {
				// success is intentionally not logged
			} else {
				logger.logError(
					ERROR_MODULE_NAME,
					`Sign-in action failed: ${response?.error || 'Unknown error'}`
				);
				return false;
			}
			overlayStore.delete(tabId);
		}

		return true;
	} catch (error) {
		logError(`Error in direct ${actionLabel} handling`, error);
		return false;
	}
}
