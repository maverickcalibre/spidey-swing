// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

import { EVENT_TYPES, PolicyFetchState } from '../../constants';

// Use logger bridge since PolicyLoadingPage runs outside extension context
declare const window: Window & {
	sshRdpLogger: {
		logInfo: (module: string, message: string) => void;
		logError: (module: string, message: string) => void;
	};
};

const MODULE_NAME = 'policy-loading-page';

// Type definitions for policy state messages
interface PolicyStateMessage {
	type: typeof EVENT_TYPES.POLICY_STATE_CHANGE;
	state: PolicyFetchState;
}

// Listen for state change messages from extension background
chrome.runtime.onMessage.addListener((message: PolicyStateMessage) => {
	if (message.type === EVENT_TYPES.POLICY_STATE_CHANGE) {
		updateState(message.state);
		return false;
	}
});

/**
 * Update the UI state of the loading page
 * @param state - The state to display
 */
function updateState(state: PolicyFetchState): void {
	const loadingView = document.getElementById('loading-view');
	const errorView = document.getElementById('error-view');

	// Hide all views
	loadingView.classList.add('hidden');
	errorView.classList.add('hidden');

	// Show the appropriate view
	switch (state) {
		case PolicyFetchState.IDLE:
		case PolicyFetchState.LOADING:
			loadingView.classList.remove('hidden');
			break;
		case PolicyFetchState.ERROR:
			errorView.classList.remove('hidden');
			break;
		case PolicyFetchState.SUCCESS:
			// Shouldn't happen (blocking disabled, tabs closed)
			// But handle gracefully - show loading
			loadingView.classList.remove('hidden');
			break;
	}
}

/**
 * Request current policy state from background on page load
 */
function requestCurrentState(): void {
	chrome.runtime.sendMessage({ type: EVENT_TYPES.POLICY_STATE_REQUEST }, response => {
		if (response?.success && response.state) {
			handleInitialState(response.state);
		} else {
			// PolicyOrchestrator may not be initialized yet on first load - this is expected
			window.sshRdpLogger.logInfo(
				MODULE_NAME,
				`Policy state not yet available: ${response?.error || 'initializing'}`
			);
			// Default to loading if state query fails
			updateState(PolicyFetchState.LOADING);
		}
	});
}

/**
 * Handle initial state received from background
 * Implements F5 auto-retry: if state is ERROR, automatically trigger retry
 */
function handleInitialState(state: PolicyFetchState): void {
	switch (state) {
		case PolicyFetchState.LOADING:
			// Policy fetch in progress, show loading
			updateState(PolicyFetchState.LOADING);
			break;
		case PolicyFetchState.ERROR:
			// Policy fetch failed, show error briefly then auto-retry (F5 behavior)
			updateState(PolicyFetchState.ERROR);
			// Auto-retry after brief delay to show error state
			setTimeout(() => triggerRetry(), 100);
			break;
		case PolicyFetchState.SUCCESS:
		case PolicyFetchState.IDLE:
			// Shouldn't happen (blocking should be disabled on success/IDLE is transient)
			// But handle gracefully - show loading
			updateState(PolicyFetchState.LOADING);
			break;
	}
}

/**
 * Trigger a policy retry (used by F5 auto-retry and manual retry button)
 */
function triggerRetry(): void {
	updateState(PolicyFetchState.LOADING);
	chrome.runtime.sendMessage(
		{
			action: EVENT_TYPES.ERROR_ACTION_RETRY,
			timestamp: Date.now(),
		},
		response => {
			if (response && !response.success) {
				window.sshRdpLogger.logError(MODULE_NAME, `Policy retry failed: ${response.error}`);
			}
		}
	);
}

/**
 * Setup retry button click handler
 *
 * Error Handling Flow:
 * 1. User clicks retry button
 * 2. Message sent to background with action: ERROR_ACTION_RETRY
 * 3. runtime_message_handler.ts routes to ErrorActionHandler
 * 4. ErrorActionHandler executes registered callback (PolicyOrchestrator.retryPolicyInitialization)
 * 5. If callback throws exception (e.g., 'PolicyOrchestrator not available'):
 *    - ErrorActionHandler catches it (line 62 in ErrorActionHandler.ts)
 *    - Sends response: { success: false, error: errorMessage }
 * 6. This function receives the response and logs it
 *
 * Note: UI state changes are handled by POLICY_STATE_CHANGE messages from background,
 * not by the retry response. This keeps the UI reactive to actual policy fetch state.
 */
function setupRetryButton(): void {
	const retryButton = document.getElementById('retry-button');

	if (retryButton) {
		retryButton.addEventListener('click', () => {
			triggerRetry();
		});
	}
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => {
		requestCurrentState();
		setupRetryButton();
	});
} else {
	requestCurrentState();
	setupRetryButton();
}
