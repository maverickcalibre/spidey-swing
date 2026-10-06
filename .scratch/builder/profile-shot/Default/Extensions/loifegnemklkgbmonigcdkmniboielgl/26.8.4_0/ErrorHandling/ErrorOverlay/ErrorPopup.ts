// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

import logger from '@logger/Logger';
import { EVENT_TYPES } from '../../constants';
import { initializeLocalization, translateWithFallback } from '../../Localization/localization';

const moduleName = 'ErrorHandling/ErrorOverlay/ErrorPopup.ts';

// Core interfaces
interface ErrorInfo {
	id: string;
	titleKey: string;
	messageKey: string;
	icon: string;
	transactionId: string;
	actionable: boolean;
	retryable: boolean;
	possibleFixes?: string[];
	signInButton?: boolean;
}
interface ErrorConfig {
	errors: Record<string, ErrorInfo>;
	defaultError: string;
}

// Message types
type PopupMessage =
	| {
			type: typeof EVENT_TYPES.IFRAME_SIZE_UPDATE;
			contentHeight: number;
			contentWidth: number;
			shouldAnimate: boolean;
			source: string;
			timestamp: number;
	  }
	| {
			type: typeof EVENT_TYPES.IFRAME_ACTION;
			action:
				| typeof EVENT_TYPES.ERROR_ACTION_RETRY
				| typeof EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS
				| typeof EVENT_TYPES.ERROR_ACTION_SIGN_IN;
			source: string;
			timestamp: number;
			errorType?: string;
			transactionId?: string;
	  };

// Constants
const ERROR_CONFIG_PATH = 'ErrorHandling/errorConfig.json';
const UNKNOWN_ERROR_ID = 'UNKNOWN_ERROR';
const MAX_FIXES_DISPLAYED = 3;

// UI dimensions
const UI_DIMENSIONS = {
	MIN_HEIGHT: 210,
	MAX_HEIGHT: 380,
	HEIGHT_PADDING: 35,
	WIDTH_WITH_FIXES: 640,
	WIDTH_WITHOUT_FIXES: 540,
};

// Default error
const DEFAULT_ERROR: ErrorInfo = {
	id: UNKNOWN_ERROR_ID,
	titleKey: 'error.UNKNOWN_ERROR.title',
	messageKey: 'error.UNKNOWN_ERROR.message',
	icon: 'ErrorHandling/Resources/icons/errorIcon.svg',
	transactionId: 'TXN-UNK-999',
	actionable: false,
	retryable: false,
};

// Load error configuration
async function loadErrorConfig(): Promise<ErrorConfig> {
	try {
		// Get extension path
		const configUrl: string = chrome.runtime.getURL(ERROR_CONFIG_PATH);

		const response: Response = await fetch(configUrl);
		const config: ErrorConfig = await response.json();

		return config;
	} catch (error) {
		logger.logError(moduleName, `Failed to load error configuration: ${error}`);

		const fallbackConfig: ErrorConfig = {
			errors: {
				[UNKNOWN_ERROR_ID]: DEFAULT_ERROR,
			},
			defaultError: UNKNOWN_ERROR_ID,
		};

		return fallbackConfig;
	}
}

// Get error information by ID
function getErrorInfoPopup(errorId: string, config: ErrorConfig | null): ErrorInfo {
	if (config?.errors[errorId]) {
		return config.errors[errorId];
	}

	const defaultErrorId: string = config?.defaultError || UNKNOWN_ERROR_ID;
	return config?.errors[defaultErrorId] || DEFAULT_ERROR;
}

// Global state
let errorConfig: ErrorConfig | null = null;

// DOM element cache
let cachedFixesPanel: HTMLElement | null = null;
const getFixesPanel = (): HTMLElement | null => {
	if (!cachedFixesPanel) {
		cachedFixesPanel = document.querySelector('.fixes-panel');
	}
	return cachedFixesPanel;
};

// Type guards for message data validation
function isSizeUpdateData(data: unknown): data is { contentHeight: number; contentWidth: number } {
	return (
		typeof data === 'object' &&
		data !== null &&
		'contentHeight' in data &&
		'contentWidth' in data &&
		typeof (data as { contentHeight: unknown }).contentHeight === 'number' &&
		typeof (data as { contentWidth: unknown }).contentWidth === 'number'
	);
}

function isActionData(data: unknown): data is {
	action:
		| typeof EVENT_TYPES.ERROR_ACTION_RETRY
		| typeof EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS
		| typeof EVENT_TYPES.ERROR_ACTION_SIGN_IN;
	errorType?: string | null;
	transactionId?: string | null;
} {
	return (
		typeof data === 'object' &&
		data !== null &&
		'action' in data &&
		typeof (data as { action: unknown }).action === 'string' &&
		[
			EVENT_TYPES.ERROR_ACTION_RETRY,
			EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS,
			EVENT_TYPES.ERROR_ACTION_SIGN_IN,
		].includes(
			(data as { action: string }).action as
				| typeof EVENT_TYPES.ERROR_ACTION_RETRY
				| typeof EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS
				| typeof EVENT_TYPES.ERROR_ACTION_SIGN_IN
		)
	);
}

// Message creation helper
const createMessage = (
	type: typeof EVENT_TYPES.IFRAME_SIZE_UPDATE | typeof EVENT_TYPES.IFRAME_ACTION,
	data: unknown
): PopupMessage => {
	const baseMessage = {
		source: moduleName,
		timestamp: Date.now(),
		extensionId: chrome.runtime.id,
	};

	if (type === EVENT_TYPES.IFRAME_SIZE_UPDATE) {
		if (!isSizeUpdateData(data)) {
			throw new Error('Invalid size update data provided to createMessage');
		}
		return { type, ...data, shouldAnimate: true, ...baseMessage };
	} else {
		if (!isActionData(data)) {
			throw new Error('Invalid action data provided to createMessage');
		}
		return {
			type,
			action: data.action,
			...baseMessage,
			...(data.errorType && { errorType: data.errorType }),
			...(data.transactionId && { transactionId: data.transactionId }),
		};
	}
};

// Helper function to update title and message elements
function updateTitleAndMessage(
	elements: { title: Element | null; message: Element | null },
	errorInfo: ErrorInfo
): void {
	if (elements.title) {
		const translatedTitle = translateWithFallback(errorInfo.titleKey, 'Error');
		if (translatedTitle?.trim()) {
			elements.title.textContent = translatedTitle;
			elements.title.classList.remove('hidden');
		} else {
			elements.title.classList.add('hidden');
		}
	} else {
		logger.logError(moduleName, 'Could not find .main-error element');
	}

	if (elements.message) {
		const translatedMessage = translateWithFallback(
			errorInfo.messageKey,
			'An error occurred. Please contact your administrator.'
		);
		if (translatedMessage?.trim()) {
			// message may contain HTML (e.g. inline <a> tags bundled in translation files)
			(elements.message as HTMLElement).innerHTML = translatedMessage;
			elements.message.classList.remove('hidden');
		} else {
			elements.message.classList.add('hidden');
		}
	} else {
		logger.logError(moduleName, 'Could not find .sub-error element');
	}
}

// Helper function to update fixes panel
function updateFixesPanel(
	elements: { fixesContainer: Element | null; fixesList: Element | null },
	errorInfo: ErrorInfo
): void {
	if (!elements.fixesContainer || !elements.fixesList) {
		return;
	}

	const fixes = Array.isArray(errorInfo.possibleFixes)
		? errorInfo.possibleFixes.filter((fix: string) => fix?.trim()).slice(0, MAX_FIXES_DISPLAYED)
		: [];

	elements.fixesList.innerHTML = '';

	if (fixes.length > 0) {
		for (const fix of fixes) {
			const li = document.createElement('li');
			li.textContent = fix;
			elements.fixesList.appendChild(li);
		}
		elements.fixesContainer.classList.remove('hidden');
	} else {
		elements.fixesContainer.classList.add('hidden');
	}
	// Clear cached fixes panel when content changes
	cachedFixesPanel = null;
}

// Helper function to update error code display
function updateErrorCodeDisplay(
	elements: { message: Element | null },
	errorCode: string | null
): void {
	if (elements.message && errorCode?.trim()) {
		elements.message.appendChild(document.createTextNode(' ' + errorCode));
	}
}

// Helper function to update transaction ID display
function updateTransactionDisplay(
	elements: { transactionRow: Element | null; transactionId: Element | null },
	errorInfo: ErrorInfo,
	transactionId: string | null
): void {
	if (elements.transactionRow && elements.transactionId) {
		const displayTransactionId = transactionId || errorInfo.transactionId;
		if (displayTransactionId) {
			elements.transactionId.textContent = displayTransactionId;
			elements.transactionRow.classList.remove('hidden');
		} else {
			elements.transactionRow.classList.add('hidden');
		}
	} else if (elements.transactionRow) {
		elements.transactionRow.classList.add('hidden');
	}
}

// Update error content (refactored to reduce complexity)
function updateErrorContent(
	errorInfo: ErrorInfo,
	transactionId: string | null = null,
	errorCode: string | null = null
): void {
	// Get DOM elements directly (simplified from interface)
	const elements = {
		title: document.querySelector('.main-error'),
		message: document.querySelector('.sub-error'),
		fixesContainer: document.querySelector('.fixes-panel'),
		fixesList: document.querySelector('.fixes-panel ul'),
		transactionRow: document.querySelector('.transaction-row'),
		transactionId: document.querySelector('.transaction-id'),
	};

	updateTitleAndMessage(elements, errorInfo);
	updateFixesPanel(elements, errorInfo);
	updateErrorCodeDisplay(elements, errorCode);
	updateTransactionDisplay(elements, errorInfo, transactionId);

	// Update document title with translated text
	const translatedTitle = translateWithFallback(errorInfo.titleKey, 'Error');
	document.title = translatedTitle?.trim() || 'Error';
}

// Setup ResizeObserver
function setupContentObserver(): void {
	// Check if ResizeObserver already exists to prevent duplicates
	const existingObserver = (window as Window & { contentResizeObserver?: ResizeObserver })
		.contentResizeObserver;
	if (existingObserver) {
		return;
	}

	if (typeof ResizeObserver === 'undefined') {
		return;
	}
	const popupBody: HTMLElement | null = document.querySelector('.popup-body');
	if (!popupBody) {
		logger.logError(moduleName, 'Could not find .popup-body for ResizeObserver');
		return;
	}
	// Cache fixes panel for performance
	const fixesPanel = getFixesPanel();

	// Debounce mechanism to prevent multiple rapid resize events
	let resizeTimeout: number | null = null;

	const resizeObserver: ResizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
		if (entries.length > 0) {
			// Clear existing timeout
			if (resizeTimeout) {
				clearTimeout(resizeTimeout);
			}

			// Debounce resize events - only process after 100ms of no changes
			resizeTimeout = window.setTimeout(() => {
				const entry = entries[0];
				// Inline visible fixes check (consolidated logic)
				const hasFixes =
					fixesPanel && !fixesPanel.classList.contains('hidden') && fixesPanel.children.length > 0;
				const contentHeight = hasFixes
					? Math.max(
							UI_DIMENSIONS.MIN_HEIGHT,
							entry.contentRect.height + UI_DIMENSIONS.HEIGHT_PADDING
						)
					: Math.min(
							UI_DIMENSIONS.MAX_HEIGHT,
							entry.contentRect.height + UI_DIMENSIONS.HEIGHT_PADDING
						);
				const contentWidth = hasFixes
					? UI_DIMENSIONS.WIDTH_WITH_FIXES
					: UI_DIMENSIONS.WIDTH_WITHOUT_FIXES;
				// Send message without verbose logging for performance
				// Get parent origin safely using ancestorOrigins or fallback to '*'
				const parentOrigin = window.location.ancestorOrigins?.[0] || '*';
				window.parent.postMessage(
					createMessage(EVENT_TYPES.IFRAME_SIZE_UPDATE, { contentHeight, contentWidth }),
					parentOrigin
				);
				resizeTimeout = null;
			}, 100);
		}
	});
	resizeObserver.observe(popupBody);
	// Store observer on window for cleanup
	(window as unknown as { contentResizeObserver: ResizeObserver }).contentResizeObserver =
		resizeObserver;
}

// Show error function
function showError(
	errorId: string,
	transactionId: string | null = null,
	errorCode: string | null = null
): void {
	const errorInfo: ErrorInfo = getErrorInfoPopup(errorId, errorConfig);
	updateErrorContent(errorInfo, transactionId, errorCode);
	updateButtonVisibility(errorInfo);
}

// Update button visibility based on error config
function updateButtonVisibility(errorInfo: ErrorInfo): void {
	const retryBtn = document.querySelector('.restart-btn') as HTMLElement | null;
	const downloadLogsBtn = document.querySelector('.download-logs-btn') as HTMLElement | null;
	const signInBtn = document.querySelector('.sign-in-btn') as HTMLElement | null;

	if (errorInfo.signInButton) {
		retryBtn?.classList.add('hidden');
		downloadLogsBtn?.classList.add('hidden');
		signInBtn?.classList.remove('hidden');
	} else {
		retryBtn?.classList.remove('hidden');
		downloadLogsBtn?.classList.remove('hidden');
		signInBtn?.classList.add('hidden');
	}
}

// Set popup labels with localized text
function setPopupLabels(): void {
	// Update "Possible fixes:" label
	const fixesLabel = document.querySelector('.fixes-panel strong');
	if (fixesLabel) {
		fixesLabel.textContent = translateWithFallback('errorOverlay.possibleFixes', 'Possible fixes:');
	}

	// Update "Transaction ID:" label
	const transactionLabel = document.querySelector('.transaction-label');
	if (transactionLabel) {
		transactionLabel.textContent = translateWithFallback(
			'errorOverlay.transactionId',
			'Transaction ID:'
		);
	}

	// Update button texts
	const retryButton = document.querySelector('.restart-btn');
	if (retryButton) {
		retryButton.textContent = translateWithFallback('errorOverlay.button.retry', 'Retry');
	}

	const downloadLogsButton = document.querySelector('.download-logs-btn');
	if (downloadLogsButton) {
		downloadLogsButton.textContent = translateWithFallback(
			'errorOverlay.button.downloadLogs',
			'Download Logs'
		);
	}

	const signInButton = document.querySelector('.sign-in-btn');
	if (signInButton) {
		signInButton.textContent = translateWithFallback('errorOverlay.button.signIn', 'Sign In');
	}
}

// Button listener state
let buttonListenersSetup = false;
let buttonCleanupHandlers: Array<{ element: Element; handler: () => void }> = [];

// Show loading state on the retry button
function setRetryButtonLoading(btn: HTMLButtonElement): void {
	btn.disabled = true;
	btn.classList.add('loading');
	btn.setAttribute('aria-busy', 'true');
}

// Setup button listeners
function setupButtonListeners(
	errorId: string | null = null,
	transactionId: string | null = null
): void {
	if (buttonListenersSetup) {
		return;
	}

	const buttons = [
		{ selector: '.restart-btn', action: EVENT_TYPES.ERROR_ACTION_RETRY },
		{ selector: '.download-logs-btn', action: EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS },
		{ selector: '.sign-in-btn', action: EVENT_TYPES.ERROR_ACTION_SIGN_IN },
	];

	for (const { selector, action } of buttons) {
		const btn = document.querySelector(selector);
		if (btn) {
			const clickHandler = (): void => {
				if (action === EVENT_TYPES.ERROR_ACTION_RETRY) {
					setRetryButtonLoading(btn as HTMLButtonElement);
				}
				const messageData = createMessage(EVENT_TYPES.IFRAME_ACTION, {
					action,
					errorType: errorId,
					transactionId,
				});
				// Use parent origin so message reaches content script, but content script validates sender
				const parentOrigin = window.location.ancestorOrigins?.[0] || '*';
				window.parent.postMessage(messageData, parentOrigin);
			};
			btn.addEventListener('click', clickHandler);

			// Store for cleanup
			buttonCleanupHandlers.push({ element: btn, handler: clickHandler });
		}
	}

	buttonListenersSetup = true;
}

// Cleanup button listeners
function cleanupButtonListeners(): void {
	for (const { element, handler } of buttonCleanupHandlers) {
		element.removeEventListener('click', handler);
	}
	buttonCleanupHandlers = [];
	buttonListenersSetup = false;
}

// Cleanup on page unload
window.addEventListener('beforeunload', cleanupButtonListeners);

// Initialize popup
document.addEventListener('DOMContentLoaded', async function () {
	await initializeLocalization();
	setPopupLabels();

	errorConfig = await loadErrorConfig();
	const urlParams = new URLSearchParams(window.location.search);
	const errorId = urlParams.get('ds-error') || urlParams.get('errorId') || 'UNKNOWN_ERROR';
	const transactionId = urlParams.get('transaction-id');
	const errorCode = urlParams.get('error-code');

	showError(errorId, transactionId, errorCode);
	setupButtonListeners(errorId, transactionId);
	setupContentObserver();
});

// Global showError function
(
	window as unknown as {
		showError: (errorId: string, transactionId: string | null, errorCode?: string | null) => void;
	}
).showError = (
	errorId: string,
	transactionId: string | null = null,
	errorCode: string | null = null
): void => {
	const errorInfo = getErrorInfoPopup(errorId, errorConfig);
	updateErrorContent(errorInfo, transactionId, errorCode);
};
