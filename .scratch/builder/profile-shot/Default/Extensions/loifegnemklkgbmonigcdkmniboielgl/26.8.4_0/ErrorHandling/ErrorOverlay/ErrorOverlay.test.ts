/**
 * @jest-environment jsdom
 */

// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

/**
 * ErrorOverlay.test.ts - Test file for ErrorOverlay module
 * Tests popup/overlay error display functionality
 */

// Mock logger before importing the module
const mockLogger = {
	logInfo: jest.fn(),
	logError: jest.fn(),
};

jest.mock('@logger/Logger', () => ({
	__esModule: true,
	default: mockLogger,
}));

// Session storage mock — must be defined before jest.mock so the factory closure captures it
const mockSessionStorage = {
	get: jest.fn().mockResolvedValue(null),
	set: jest.fn().mockResolvedValue(undefined),
	clear: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../Storage/SessionStorage', () => ({
	sessionStorage: mockSessionStorage,
}));

const mockLocalStorage = {
	get: jest.fn().mockResolvedValue(null),
	set: jest.fn().mockResolvedValue(undefined),
	remove: jest.fn().mockResolvedValue(undefined),
	clear: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../Storage', () => ({
	localStorage: mockLocalStorage,
}));

// Mock PolicyBlockingRules to ensure no conflicts with error overlay functionality
jest.mock('../../Utils/PolicyBlockingRules', () => ({
	enablePolicyFetchBlocking: jest.fn().mockResolvedValue(undefined),
	disablePolicyFetchBlocking: jest.fn().mockResolvedValue(undefined),
	updateLoadingPageState: jest.fn().mockResolvedValue(undefined),
	closeLoadingPageTabs: jest.fn().mockResolvedValue(undefined),
}));

// Mock feature flags
const mockIsPolicyErrorBlockingEnabled = jest.fn().mockReturnValue(true);
const mockIsAccessBlockedOverlayEnabled = jest.fn().mockReturnValue(true);
jest.mock('../../FeatureFlag/feature_flags', () => ({
	isPolicyErrorBlockingOverlayEnabled: (...args: unknown[]) =>
		mockIsPolicyErrorBlockingEnabled(...args),
	isAccessBlockedOverlayEnabled: (...args: unknown[]) => mockIsAccessBlockedOverlayEnabled(...args),
}));

// Mock auth utils
const mockIsUserLoggedOut = jest.fn().mockResolvedValue(false);
jest.mock('../../Utils/auth_utils', () => ({
	isUserLoggedOut: (...args: unknown[]) => mockIsUserLoggedOut(...args),
}));

// Mock Chrome APIs
const mockChrome = {
	tabs: {
		query: jest.fn(),
		sendMessage: jest.fn(),
		get: jest.fn(),
		reload: jest.fn(),
		onUpdated: {
			addListener: jest.fn(),
			removeListener: jest.fn(),
		},
		onRemoved: {
			addListener: jest.fn(),
			removeListener: jest.fn(),
		},
	},
	runtime: {
		sendMessage: jest.fn(),
		onMessage: {
			addListener: jest.fn(),
		},
	},
	scripting: {
		executeScript: jest.fn(),
	},
};

globalThis.chrome = mockChrome as any;

import { EVENT_TYPES } from '../../constants';

let cleanupRTUOverlayForTab: typeof import('./ErrorOverlay').cleanupRTUOverlayForTab;
let displayAccessBlockedErrorOverlay: typeof import('./ErrorOverlay').displayAccessBlockedErrorOverlay;
let displayErrorOverlay: typeof import('./ErrorOverlay').displayErrorOverlay;
let displayForceLogoutOverlay: typeof import('./ErrorOverlay').displayForceLogoutOverlay;
let handleOverlayCallback: typeof import('./ErrorOverlay').handleOverlayCallback;
let hideOverlayErrors: typeof import('./ErrorOverlay').hideOverlayErrors;
let retryOverlayForTab: typeof import('./ErrorOverlay').retryOverlayForTab;

describe('ErrorOverlay', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.resetModules();
		// Reset mock implementations
		mockIsPolicyErrorBlockingEnabled.mockReturnValue(true);
		mockIsAccessBlockedOverlayEnabled.mockReturnValue(true);
		mockIsUserLoggedOut.mockResolvedValue(false);
		mockChrome.tabs.query.mockResolvedValue([]);
		mockChrome.tabs.sendMessage.mockResolvedValue({ success: true });
		mockChrome.tabs.get.mockResolvedValue({});
		mockChrome.tabs.reload.mockResolvedValue({} as chrome.tabs.Tab);
		mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });
		mockChrome.runtime.onMessage.addListener.mockClear();
		mockChrome.tabs.onUpdated.addListener.mockClear();
		mockChrome.tabs.onUpdated.removeListener.mockClear();
		mockChrome.tabs.onRemoved.addListener.mockClear();
		mockChrome.tabs.onRemoved.removeListener.mockClear();
		mockChrome.scripting.executeScript.mockResolvedValue([]);
		mockLogger.logInfo.mockImplementation((): void => undefined);
		mockLogger.logError.mockImplementation((): void => undefined);
		mockSessionStorage.get.mockResolvedValue(null);
		mockSessionStorage.set.mockResolvedValue(undefined);
		mockSessionStorage.clear.mockResolvedValue(undefined);
		mockLocalStorage.get.mockResolvedValue(null);
		mockLocalStorage.set.mockResolvedValue(undefined);
		mockLocalStorage.remove.mockResolvedValue(undefined);
		mockLocalStorage.clear.mockResolvedValue(undefined);
		globalThis.chrome = mockChrome as any;
		({
			cleanupRTUOverlayForTab,
			displayAccessBlockedErrorOverlay,
			displayErrorOverlay,
			displayForceLogoutOverlay,
			handleOverlayCallback,
			hideOverlayErrors,
			retryOverlayForTab,
		} = require('./ErrorOverlay'));

		// Clear any existing overlays by calling cleanup function
		// This ensures each test starts with a clean state
		cleanupRTUOverlayForTab(123);
		cleanupRTUOverlayForTab(124);
		cleanupRTUOverlayForTab(125);
		cleanupRTUOverlayForTab(126);
	});

	describe('cleanupRTUOverlayForTab', () => {
		it('should call internal cleanup function without throwing', () => {
			const tabId = 123;
			expect(() => cleanupRTUOverlayForTab(tabId)).not.toThrow();
		});
	});

	describe('displayErrorOverlay', () => {
		it('should show overlay on all valid tabs when no patterns provided', async () => {
			const tabs = [
				{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab,
				{ id: 124, url: 'https://google.com' } as chrome.tabs.Tab,
			];

			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayAccessBlockedErrorOverlay({
				'example.com': false,
				'google.com': false,
			});

			expect(mockChrome.tabs.query).toHaveBeenCalledWith({});
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				123,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'BLOCK_URL_ERROR',
					tabId: 123,
				})
			);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				124,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'BLOCK_URL_ERROR',
					tabId: 124,
				})
			);
		});

		it('should show overlay on tabs matching URL patterns', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			expect(mockChrome.tabs.query).toHaveBeenCalledWith({});
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
		});

		it('should re-send overlay to tabs that already have overlays', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);

			// First call to set up overlay
			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			// Clear mocks to test second call
			jest.clearAllMocks();
			mockChrome.tabs.query.mockResolvedValue(tabs);

			// Second call should re-send overlay to the same tab
			await displayAccessBlockedErrorOverlay({ 'example.com': false });
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
		});

		it('should return early when no new tabs are found', async () => {
			mockChrome.tabs.query.mockResolvedValue([]);

			await displayErrorOverlay('test-error');
			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should handle sendMessage errors by injecting script and retrying', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			// First call fails, second call (after injection) succeeds
			mockChrome.tabs.sendMessage
				.mockRejectedValueOnce(new Error('Content script not found'))
				.mockResolvedValueOnce({});

			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			// Should try to send message twice (initial + retry after injection)
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				123,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'BLOCK_URL_ERROR',
					tabId: 123,
				})
			);

			// Should inject content script after first failure
			expect(mockChrome.scripting.executeScript).toHaveBeenCalledWith({
				target: { tabId: 123 },
				files: ['ErrorOverlayComponent.js'],
			});

			// Should log info about injection attempt
			expect(mockLogger.logInfo).toHaveBeenCalledWith(
				'message-overlay',
				'Initial message failed for tab 123, attempting content script injection'
			);
		});

		it('should log error when both initial and retry attempts fail', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			// Both attempts fail
			mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Tab closed'));

			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			// Should try twice (initial + retry)
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);

			// Should attempt injection
			expect(mockChrome.scripting.executeScript).toHaveBeenCalled();

			// Should log error after retry fails
			expect(mockLogger.logError).toHaveBeenCalledWith(
				'message-overlay',
				'Failed to inject and send overlay to tab 123: Tab closed'
			);
		});

		it('should handle errors and re-throw them', async () => {
			const error = new Error('Test error');
			mockChrome.tabs.query.mockRejectedValue(error);

			await expect(displayErrorOverlay('test-error')).rejects.toThrow('Test error');
			expect(mockLogger.logError).toHaveBeenCalledWith(
				'message-overlay',
				'Error in displayErrorOverlay: Test error'
			);
		});

		it('should filter out invalid URLs', async () => {
			const tabs = [
				{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab,
				{ id: 124, url: 'chrome://newtab/' } as chrome.tabs.Tab,
				{ id: 125, url: 'chrome-extension://abc/page.html' } as chrome.tabs.Tab,
				{ id: 126, url: 'http://test.com' } as chrome.tabs.Tab,
			];

			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayAccessBlockedErrorOverlay({ 'example.com': false, 'test.com': false });

			// Should send messages to valid tabs only (123 and 126)
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				123,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'BLOCK_URL_ERROR',
					tabId: 123,
				})
			);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				126,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'BLOCK_URL_ERROR',
					tabId: 126,
				})
			);
		});

		it('should exclude FORCE_LOGOUT overlay on policy-configured idp_domains', async () => {
			const tabs = [
				{ id: 123, url: 'https://accounts.google.com/signin' } as chrome.tabs.Tab,
				{ id: 124, url: 'https://company.okta.com/login' } as chrome.tabs.Tab,
				{ id: 125, url: 'https://example.com' } as chrome.tabs.Tab,
			];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayForceLogoutOverlay(jest.fn(), undefined, ['accounts.google.com', '*.okta.com']);

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				125,
				expect.objectContaining({ errorId: 'FORCE_LOGOUT', tabId: 125 })
			);
		});

		it('should apply policy-configured exclusions for tracked new tabs during FORCE_LOGOUT', async () => {
			mockChrome.tabs.query.mockResolvedValue([
				{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab,
			]);

			await displayForceLogoutOverlay(jest.fn(), { trackNewTabs: true }, ['*.okta.com']);

			mockChrome.tabs.sendMessage.mockClear();
			const listener = (mockChrome.tabs.onUpdated.addListener as jest.Mock).mock.calls[0][0];
			listener(200, { status: 'complete' }, { id: 200, url: 'https://enterprise.okta.com/login' });

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should not apply idp_domains exclusions for non-FORCE_LOGOUT overlays', async () => {
			const tabs = [
				{ id: 123, url: 'https://company.okta.com/login' } as chrome.tabs.Tab,
				{ id: 124, url: 'https://example.com' } as chrome.tabs.Tab,
			];
			mockLocalStorage.get.mockResolvedValue(['*.okta.com']);
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayErrorOverlay('SESSION_RECORDING_ERROR');

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
		});

		it('should register onRetry callback when provided', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			const onRetryCallback = jest.fn();

			mockChrome.tabs.query.mockResolvedValue(tabs);
			const listenerCallsBefore = mockChrome.runtime.onMessage.addListener.mock.calls.length;

			await displayAccessBlockedErrorOverlay({ 'example.com': false }, undefined, onRetryCallback);

			// Should register the message listener (only once across all tests)
			// If already registered, call count stays the same
			expect(mockChrome.runtime.onMessage.addListener.mock.calls.length).toBeGreaterThanOrEqual(
				listenerCallsBefore
			);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
		});

		it('should register onCancel callback when provided', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			const onCancelCallback = jest.fn();

			mockChrome.tabs.query.mockResolvedValue(tabs);
			const listenerCallsBefore = mockChrome.runtime.onMessage.addListener.mock.calls.length;

			await displayAccessBlockedErrorOverlay(
				{ 'example.com': false },
				undefined,
				undefined,
				onCancelCallback
			);

			// Should register the message listener (only once across all tests)
			// If already registered, call count stays the same
			expect(mockChrome.runtime.onMessage.addListener.mock.calls.length).toBeGreaterThanOrEqual(
				listenerCallsBefore
			);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
		});

		it('should register both onRetry and onCancel callbacks when provided', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			const onRetryCallback = jest.fn();
			const onCancelCallback = jest.fn();

			mockChrome.tabs.query.mockResolvedValue(tabs);
			const listenerCallsBefore = mockChrome.runtime.onMessage.addListener.mock.calls.length;

			await displayAccessBlockedErrorOverlay(
				{ 'example.com': false },
				undefined,
				onRetryCallback,
				onCancelCallback
			);

			// Should register the message listener (only once across all tests)
			// If already registered, call count stays the same
			expect(mockChrome.runtime.onMessage.addListener.mock.calls.length).toBeGreaterThanOrEqual(
				listenerCallsBefore
			);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
		});

		it('should register the runtime message listener only once when callbacks are provided repeatedly', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayErrorOverlay('test-error', undefined, undefined, jest.fn());
			await displayErrorOverlay('test-error-2', undefined, undefined, jest.fn());

			expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
		});

		it('should not register listener when no callbacks provided', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			const initialCallCount = mockChrome.runtime.onMessage.addListener.mock.calls.length;

			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			// Should not register listener when no callbacks
			expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(initialCallCount);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
		});

		it('should handle onRetry callback with no arguments', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			const noArgCallback = jest.fn();

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', undefined, undefined, noArgCallback);

			// Verify callback is registered
			expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
		});

		it('should handle onRetry callback with message argument', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			const messageCallback = jest.fn(message => {
				expect(message).toBeDefined();
			});

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', undefined, undefined, messageCallback);

			// Verify callback is registered
			expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
		});

		it('should handle onRetry callback with message and sender arguments', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			const fullCallback = jest.fn((message, sender) => {
				expect(message).toBeDefined();
				expect(sender).toBeDefined();
			});

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', undefined, undefined, fullCallback);

			// Verify callback is registered
			expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
		});

		it('should handle onCancel callback with message argument', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			const cancelCallback = jest.fn(message => {
				expect(message).toBeDefined();
			});

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', undefined, undefined, cancelCallback);

			// Verify callback is registered
			expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
		});

		it('should handle async callbacks', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			const asyncCallback = jest.fn(async () => {
				await Promise.resolve();
			});

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', undefined, undefined, asyncCallback);

			// Verify callback is registered
			expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
		});

		it('should register tab lifecycle listeners when showing access-blocked overlay', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
			expect(mockChrome.tabs.onRemoved.addListener).toHaveBeenCalledTimes(1);
		});

		it('should track newly opened tabs to blocked domains after the initial display', async () => {
			const existingTabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(existingTabs);
			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				123,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'BLOCK_URL_ERROR',
					tabId: 123,
				})
			);
			// Listeners must be registered so refresh and new tabs get the overlay
			expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
			expect(mockChrome.tabs.onRemoved.addListener).toHaveBeenCalledTimes(1);

			// Simulate a new tab navigating to a blocked domain
			mockChrome.tabs.sendMessage.mockClear();
			const listener = (mockChrome.tabs.onUpdated.addListener as jest.Mock).mock.calls[0][0];
			listener(200, { status: 'complete' }, { id: 200, url: 'https://example.com/page' });

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				200,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'BLOCK_URL_ERROR',
					tabId: 200,
				})
			);
		});

		it('should not register tab lifecycle listeners for standard error overlays unless tracking is enabled', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error');

			expect(mockChrome.tabs.onUpdated.addListener).not.toHaveBeenCalled();
			expect(mockChrome.tabs.onRemoved.addListener).not.toHaveBeenCalled();
		});

		it('should register tab lifecycle listeners when new-tab tracking is enabled', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', undefined, undefined, undefined, undefined, {
				trackNewTabs: true,
			});

			expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
			expect(mockChrome.tabs.onRemoved.addListener).toHaveBeenCalledTimes(1);
		});

		it('should register tab lifecycle listeners only once when tracking is enabled repeatedly', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', undefined, undefined, undefined, undefined, {
				trackNewTabs: true,
			});
			await displayErrorOverlay('test-error-2', undefined, undefined, undefined, undefined, {
				trackNewTabs: true,
			});

			expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
			expect(mockChrome.tabs.onRemoved.addListener).toHaveBeenCalledTimes(1);
		});

		it('should ignore tracked tab updates until navigation is complete', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', undefined, undefined, undefined, undefined, {
				trackNewTabs: true,
			});

			mockChrome.tabs.sendMessage.mockClear();
			const listener = (mockChrome.tabs.onUpdated.addListener as jest.Mock).mock.calls[0][0];
			listener(200, { status: 'loading' }, { id: 200, url: 'https://later.example.com' });

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should ignore tracked tab updates for invalid navigation URLs', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', undefined, undefined, undefined, undefined, {
				trackNewTabs: true,
			});

			mockChrome.tabs.sendMessage.mockClear();
			const listener = (mockChrome.tabs.onUpdated.addListener as jest.Mock).mock.calls[0][0];
			listener(200, { status: 'complete' }, { id: 200, url: 'chrome://settings' });

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should show overlay for newly opened tabs when tracking is enabled', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', 'tx-123', 'CSA_ERROR_000101', undefined, undefined, {
				trackNewTabs: true,
			});

			mockChrome.tabs.sendMessage.mockClear();
			const listener = (mockChrome.tabs.onUpdated.addListener as jest.Mock).mock.calls[0][0];
			listener(200, { status: 'complete' }, { id: 200, url: 'https://new-tab.example.com' });

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				200,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'test-error',
					tabId: 200,
					transactionId: 'tx-123',
					errorCode: 'CSA_ERROR_000101',
				})
			);
		});

		it('should re-send the current overlay for tracked tabs that already have overlay state', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', 'tx-123', 'CSA_ERROR_000101', undefined, undefined, {
				trackNewTabs: true,
			});

			mockChrome.tabs.sendMessage.mockClear();
			const listener = (mockChrome.tabs.onUpdated.addListener as jest.Mock).mock.calls[0][0];
			listener(123, { status: 'complete' }, { id: 123, url: 'https://example.com' });

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				123,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'test-error',
					tabId: 123,
					transactionId: 'tx-123',
					errorCode: 'CSA_ERROR_000101',
				})
			);
		});

		it('should replace stale tracked overlay state when the tracked criteria change', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValueOnce(tabs);
			await displayErrorOverlay('old-error', 'tx-old', 'OLD_CODE', undefined, undefined, {
				trackNewTabs: true,
			});

			const listener = (mockChrome.tabs.onUpdated.addListener as jest.Mock).mock.calls[0][0];

			mockChrome.tabs.query.mockResolvedValueOnce([]);
			await displayErrorOverlay('new-error', 'tx-new', 'NEW_CODE', undefined, undefined, {
				trackNewTabs: true,
			});

			mockChrome.tabs.sendMessage.mockClear();
			listener(123, { status: 'complete' }, { id: 123, url: 'https://example.com' });

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				123,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'new-error',
					tabId: 123,
					transactionId: 'tx-new',
					errorCode: 'NEW_CODE',
				})
			);
		});

		it('should suppress duplicate tracked overlay sends while a send is already in flight', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			let resolveSend: ((value: unknown) => void) | undefined;
			const pendingSend = new Promise(resolve => {
				resolveSend = resolve;
			});

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', undefined, undefined, undefined, undefined, {
				trackNewTabs: true,
			});

			mockChrome.tabs.sendMessage.mockClear();
			mockChrome.tabs.sendMessage.mockReturnValueOnce(pendingSend);
			const listener = (mockChrome.tabs.onUpdated.addListener as jest.Mock).mock.calls[0][0];

			listener(200, { status: 'complete' }, { id: 200, url: 'https://new-tab.example.com' });
			listener(200, { status: 'complete' }, { id: 200, url: 'https://new-tab.example.com' });

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);

			resolveSend?.({});
			await pendingSend;
			await Promise.resolve();
		});

		it('should unregister tracked tab lifecycle listeners when all overlays are dismissed', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', undefined, undefined, undefined, undefined, {
				trackNewTabs: true,
			});

			const updatedListener = (mockChrome.tabs.onUpdated.addListener as jest.Mock).mock.calls[0][0];
			const removedListener = (mockChrome.tabs.onRemoved.addListener as jest.Mock).mock.calls[0][0];

			await hideOverlayErrors();

			expect(mockChrome.tabs.onUpdated.removeListener).toHaveBeenCalledWith(updatedListener);
			expect(mockChrome.tabs.onRemoved.removeListener).toHaveBeenCalledWith(removedListener);
		});

		it('should clean up tracked overlay state when a tracked tab is removed', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', undefined, undefined, undefined, undefined, {
				trackNewTabs: true,
			});

			const removedListener = (mockChrome.tabs.onRemoved.addListener as jest.Mock).mock.calls[0][0];
			removedListener(123);

			mockChrome.tabs.sendMessage.mockClear();
			await hideOverlayErrors('test-error', 123);

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should stop new-tab tracking when dismissing after all tracked tabs are already gone', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', undefined, undefined, undefined, undefined, {
				trackNewTabs: true,
			});

			const updatedListener = (mockChrome.tabs.onUpdated.addListener as jest.Mock).mock.calls[0][0];
			const removedListener = (mockChrome.tabs.onRemoved.addListener as jest.Mock).mock.calls[0][0];

			cleanupRTUOverlayForTab(123);
			await hideOverlayErrors();

			expect(mockChrome.tabs.onUpdated.removeListener).toHaveBeenCalledWith(updatedListener);
			expect(mockChrome.tabs.onRemoved.removeListener).toHaveBeenCalledWith(removedListener);

			mockChrome.tabs.sendMessage.mockClear();
			updatedListener(200, { status: 'complete' }, { id: 200, url: 'https://later.example.com' });
			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should re-display overlays on currently open tabs only when called again explicitly', async () => {
			const firstTabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			const secondTabs = [
				{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab,
				{ id: 124, url: 'https://example.com/path' } as chrome.tabs.Tab,
			];

			mockChrome.tabs.query.mockResolvedValueOnce(firstTabs).mockResolvedValueOnce(secondTabs);

			await displayAccessBlockedErrorOverlay({ 'example.com': false });
			mockChrome.tabs.sendMessage.mockClear();

			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				123,
				expect.objectContaining({ tabId: 123 })
			);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				124,
				expect.objectContaining({ tabId: 124 })
			);
		});

		it('should re-send overlay on tab refresh after device posture becomes non-compliant', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayAccessBlockedErrorOverlay({ 'example.com': false }, 'tx-abc');

			// Simulate user refreshing tab — onUpdated fires with status complete
			mockChrome.tabs.sendMessage.mockClear();
			const listener = (mockChrome.tabs.onUpdated.addListener as jest.Mock).mock.calls[0][0];
			listener(123, { status: 'complete' }, { id: 123, url: 'https://example.com' });

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				123,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'BLOCK_URL_ERROR',
					tabId: 123,
					transactionId: 'tx-abc',
				})
			);
		});

		it('should not re-send overlay on refresh if tab navigates away from blocked domain', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			mockChrome.tabs.sendMessage.mockClear();
			const listener = (mockChrome.tabs.onUpdated.addListener as jest.Mock).mock.calls[0][0];
			// Tab navigated away to an allowed domain
			listener(123, { status: 'complete' }, { id: 123, url: 'https://allowed.com' });

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should pass transactionId to overlay when provided', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayAccessBlockedErrorOverlay({ 'example.com': false }, 'tx-123');

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				123,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'BLOCK_URL_ERROR',
					tabId: 123,
					transactionId: 'tx-123',
				})
			);
		});

		describe('allowedHostnamePatterns', () => {
			it('should show overlay on blocked tab but skip allowed tab when wildcard blocked and exact allowed is more specific', async () => {
				const tabs = [
					{ id: 123, url: 'https://www.cnn.com' } as chrome.tabs.Tab, // allowed (exact wins over wildcard)
					{ id: 124, url: 'https://lite.cnn.com' } as chrome.tabs.Tab, // blocked (no exact allowed)
				];
				mockChrome.tabs.query.mockResolvedValue(tabs);

				await displayAccessBlockedErrorOverlay({
					'*.cnn.com': false,
					'www.cnn.com': true,
				});

				// www.cnn.com: exact allowed entry found first → not blocked → no overlay
				expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalledWith(123, expect.anything());
				// lite.cnn.com: *.cnn.com matches → blocked → overlay shown
				expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
					124,
					expect.objectContaining({
						action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
						tabId: 124,
					})
				);
				expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
			});

			it('should show overlay on a tab when exact blocked pattern is more specific than wildcard allowed', async () => {
				const tabs = [{ id: 123, url: 'https://sub.example.com' } as chrome.tabs.Tab];
				mockChrome.tabs.query.mockResolvedValue(tabs);

				// exact blocked entry found first (sub.example.com) → blocked, even though *.example.com is allowed
				await displayAccessBlockedErrorOverlay({
					'sub.example.com': false,
					'*.example.com': true,
				});

				expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
					123,
					expect.objectContaining({
						action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
						tabId: 123,
					})
				);
			});

			it('should show overlay when hostname is blocked with no allowed exception', async () => {
				const tabs = [{ id: 123, url: 'https://www.example.com' } as chrome.tabs.Tab];
				mockChrome.tabs.query.mockResolvedValue(tabs);

				await displayAccessBlockedErrorOverlay({ 'www.example.com': false });

				expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
					123,
					expect.objectContaining({
						action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
						tabId: 123,
					})
				);
			});

			it('should match wildcard pattern against both the apex domain and subdomains', async () => {
				const tabs = [
					{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab, // apex
					{ id: 124, url: 'https://sub.example.com' } as chrome.tabs.Tab, // subdomain
					{ id: 125, url: 'https://other.net' } as chrome.tabs.Tab, // unrelated
				];
				mockChrome.tabs.query.mockResolvedValue(tabs);

				await displayAccessBlockedErrorOverlay({ '*.example.com': false });

				expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
					123,
					expect.objectContaining({ tabId: 123 })
				);
				expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
					124,
					expect.objectContaining({ tabId: 124 })
				);
				expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalledWith(125, expect.anything());
				expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
			});

			it('should show overlay only on matching tab when no allowed exceptions', async () => {
				const tabs = [
					{ id: 123, url: 'https://blocked.com' } as chrome.tabs.Tab,
					{ id: 124, url: 'https://other.com' } as chrome.tabs.Tab,
				];
				mockChrome.tabs.query.mockResolvedValue(tabs);

				await displayAccessBlockedErrorOverlay({ 'blocked.com': false });

				expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
					123,
					expect.objectContaining({ tabId: 123 })
				);
				expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalledWith(124, expect.anything());
				expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
			});
		});
	});

	describe('hideOverlayErrors', () => {
		it('should return early when no active overlays exist', async () => {
			await hideOverlayErrors();
			// Should not send any dismiss messages
			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should dismiss overlay on specific tab when targetTabId is provided', async () => {
			// First set up an active overlay
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			// Clear mocks for the hideOverlayErrors test
			jest.clearAllMocks();

			// Now test hideOverlayErrors with specific tab
			await hideOverlayErrors('test-error', 123);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(123, {
				action: EVENT_TYPES.ERROR_OVERLAY_DISMISS,
				errorId: 'test-error',
				tabId: 123,
			});
		});

		it('should directly remove overlay when dismiss listener is missing but tab is still alive', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			jest.clearAllMocks();
			mockChrome.tabs.get.mockResolvedValue({ id: 123 } as chrome.tabs.Tab);
			mockChrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist'));

			await hideOverlayErrors('test-error', 123);

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
			expect(mockChrome.scripting.executeScript).toHaveBeenCalledWith({
				target: { tabId: 123 },
				func: expect.any(Function),
			});
		});

		it('should cleanup overlay state when tab cleanup is triggered externally', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			cleanupRTUOverlayForTab(123);

			mockChrome.tabs.sendMessage.mockClear();
			await hideOverlayErrors('test-error', 123);

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should return early when targetTabId has no active overlay', async () => {
			await hideOverlayErrors('test-error', 999);
			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should dismiss overlays on all active tabs when no targetTabId provided', async () => {
			// Set up active overlays first
			const tabs = [
				{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab,
				{ id: 124, url: 'https://google.com' } as chrome.tabs.Tab,
			];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayAccessBlockedErrorOverlay({
				'example.com': false,
				'google.com': false,
			});

			// Clear mocks
			jest.clearAllMocks();

			await hideOverlayErrors();

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
		});

		it('should register tab lifecycle listeners on display and unregister them on dismiss', async () => {
			mockChrome.tabs.query.mockResolvedValue([]);

			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			// Listeners registered during display (even with no current matching tabs)
			expect(mockChrome.tabs.onUpdated.addListener).toHaveBeenCalledTimes(1);
			expect(mockChrome.tabs.onRemoved.addListener).toHaveBeenCalledTimes(1);

			const updatedListener = (mockChrome.tabs.onUpdated.addListener as jest.Mock).mock.calls[0][0];
			const removedListener = (mockChrome.tabs.onRemoved.addListener as jest.Mock).mock.calls[0][0];

			await hideOverlayErrors();

			expect(mockChrome.tabs.onUpdated.removeListener).toHaveBeenCalledWith(updatedListener);
			expect(mockChrome.tabs.onRemoved.removeListener).toHaveBeenCalledWith(removedListener);
		});

		it('should handle sendMessage errors gracefully', async () => {
			// Set up active overlays first
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			// Clear mocks and set up error for hideOverlayErrors
			jest.clearAllMocks();
			mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Tab closed'));

			await expect(hideOverlayErrors()).resolves.toBeUndefined();
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();
		});

		it('should handle errors and re-throw them', async () => {
			// Set up active overlays first
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			// Force error in hideOverlayErrors by breaking Array.from
			const originalArray = Array.from;
			try {
				Array.from = jest.fn().mockImplementation(() => {
					throw new Error('Unexpected error');
				});

				await expect(hideOverlayErrors()).rejects.toThrow('Unexpected error');
				expect(mockLogger.logError).toHaveBeenCalledWith(
					'message-overlay',
					'Error dismissing overlay errors: Unexpected error'
				);
			} finally {
				// Restore original function
				Array.from = originalArray;
			}
		});
	});

	describe('handleOverlayCallback', () => {
		it('should handle retry action', async () => {
			const result = await handleOverlayCallback(
				EVENT_TYPES.ERROR_ACTION_RETRY,
				'https://example.com',
				123
			);

			expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
				action: 'error-action-retry',
				url: 'https://example.com',
				tabId: 123,
				errorType: undefined,
				transactionId: undefined,
			});
			expect(result).toBe(true);
		});

		it('should handle service worker failure responses', async () => {
			mockChrome.runtime.sendMessage.mockResolvedValue({ success: false });

			const result = await handleOverlayCallback(
				EVENT_TYPES.ERROR_ACTION_RETRY,
				'https://example.com',
				123
			);

			expect(result).toBe(false);
		});

		it('should handle runtime sendMessage errors', async () => {
			mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Runtime error'));

			const result = await handleOverlayCallback(
				EVENT_TYPES.ERROR_ACTION_RETRY,
				'https://example.com',
				123
			);

			expect(result).toBe(false);
			expect(mockLogger.logError).toHaveBeenCalledWith(
				'message-overlay',
				'Error in direct retry handling: Runtime error'
			);
		});

		it('should pass through optional parameters', async () => {
			await handleOverlayCallback(
				EVENT_TYPES.ERROR_ACTION_RETRY,
				'https://example.com',
				123,
				'connection-error',
				'tx-123'
			);

			expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
				action: 'error-action-retry',
				url: 'https://example.com',
				tabId: 123,
				errorType: 'connection-error',
				transactionId: 'tx-123',
			});
		});

		it('should handle EVENT_TYPES.ERROR_ACTION_RETRY constant', async () => {
			const result = await handleOverlayCallback(
				EVENT_TYPES.ERROR_ACTION_RETRY,
				'https://example.com',
				123
			);

			expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
				action: 'error-action-retry',
				url: 'https://example.com',
				tabId: 123,
				errorType: undefined,
				transactionId: undefined,
			});
			expect(result).toBe(true);
		});

		it('should handle ERROR_ACTION_DOWNLOAD_LOGS action successfully', async () => {
			mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });

			const result = await handleOverlayCallback(
				EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS,
				'https://example.com',
				123,
				'connection-error',
				'tx-123'
			);

			expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
				action: EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS,
				tabId: 123,
				errorType: 'connection-error',
				transactionId: 'tx-123',
			});
			expect(result).toBe(true);
			// Success is intentionally not logged
		});

		it('should handle ERROR_ACTION_DOWNLOAD_LOGS failure response', async () => {
			mockChrome.runtime.sendMessage.mockResolvedValue({
				success: false,
				error: 'Download failed',
			});

			const result = await handleOverlayCallback(
				EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS,
				'https://example.com',
				123
			);

			expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
				action: EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS,
				tabId: 123,
				errorType: undefined,
				transactionId: undefined,
			});
			expect(result).toBe(false);
			expect(mockLogger.logError).toHaveBeenCalledWith(
				'message-overlay',
				'Logs download failed: Download failed'
			);
		});

		it('should handle ERROR_ACTION_DOWNLOAD_LOGS failure without error message', async () => {
			mockChrome.runtime.sendMessage.mockResolvedValue({ success: false });

			const result = await handleOverlayCallback(
				EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS,
				'https://example.com',
				123
			);

			expect(result).toBe(false);
			expect(mockLogger.logError).toHaveBeenCalledWith(
				'message-overlay',
				'Logs download failed: Unknown error'
			);
		});

		it('should handle ERROR_ACTION_DOWNLOAD_LOGS runtime error', async () => {
			mockChrome.runtime.sendMessage.mockRejectedValue(new Error('Runtime error'));

			const result = await handleOverlayCallback(
				EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS,
				'https://example.com',
				123
			);

			expect(result).toBe(false);
			expect(mockLogger.logError).toHaveBeenCalledWith(
				'message-overlay',
				'Error in direct download-logs handling: Runtime error'
			);
		});

		it('should not dismiss overlay after successful download logs action', async () => {
			mockChrome.runtime.sendMessage.mockResolvedValue({ success: true });
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			// First display an overlay to track it
			await displayErrorOverlay('test-error', 'tx-123');
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();

			// Now trigger download logs
			const result = await handleOverlayCallback(
				EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS,
				'https://example.com',
				123,
				'test-error',
				'tx-123'
			);

			expect(result).toBe(true);
			// Overlay should still be tracked after download logs (not cleaned up)
			// This is verified implicitly by the fact that we don't clean up activeRTUOverlayState
		});
	});

	describe('hostnamePatternCache', () => {
		it('should correctly block a hostname on repeated calls using cached patterns', async () => {
			const tabs = [{ id: 123, url: 'https://blocked.example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			// First call — computes and caches patterns for blocked.example.com
			await displayAccessBlockedErrorOverlay({ '*.example.com': false });
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);

			jest.clearAllMocks();
			mockChrome.tabs.query.mockResolvedValue(tabs);
			mockChrome.tabs.sendMessage.mockResolvedValue({ success: true });

			// Second call with same hostname — cached patterns, same result
			await displayAccessBlockedErrorOverlay({ '*.example.com': false });
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
		});

		it('should correctly apply a changed domainPolicyMap even when patterns are cached', async () => {
			const tabs = [{ id: 123, url: 'https://blocked.example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			// First call — hostname is blocked
			await displayAccessBlockedErrorOverlay({ '*.example.com': false });
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);

			jest.clearAllMocks();
			mockChrome.tabs.query.mockResolvedValue(tabs);
			mockChrome.tabs.sendMessage.mockResolvedValue({ success: true });

			// Second call — same hostname but now allowed; cache returns same patterns but map lookup returns allowed
			await displayAccessBlockedErrorOverlay({ '*.example.com': true });
			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should block lite.cnn.com when exact entry overrides wildcard allowed entry', async () => {
			// lite.cnn.com patterns: lite.cnn.com, *.lite.cnn.com, *.cnn.com (not *.com)
			const tabs = [{ id: 123, url: 'https://lite.cnn.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayAccessBlockedErrorOverlay({
				'lite.cnn.com': false,
				'*.cnn.com': true,
			});
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				123,
				expect.objectContaining({ tabId: 123 })
			);
		});

		it('should not use *.com as a hostname pattern', async () => {
			// foo.com patterns: foo.com, *.foo.com — *.com is never generated
			const tabs = [{ id: 123, url: 'https://foo.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayAccessBlockedErrorOverlay({ '*.com': false });
			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should continue displaying overlays when hostname pattern cache exceeds its max size', async () => {
			for (let index = 0; index <= 300; index += 1) {
				mockChrome.tabs.query.mockResolvedValueOnce([
					{
						id: index + 1,
						url: `https://host-${index}.example.com`,
					} as chrome.tabs.Tab,
				]);

				await displayAccessBlockedErrorOverlay({ '*.example.com': false });
			}

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(301);
		});
	});

	describe('retryOverlayForTab', () => {
		it('should return early when the policy error blocking flag is disabled', async () => {
			// Arm generic (policy-error) tracking while the flag is enabled so the retry gets
			// past the `!criteria` guard and actually reaches the flag check.
			mockIsPolicyErrorBlockingEnabled.mockReturnValue(true);
			mockChrome.tabs.query.mockResolvedValue([]);
			await displayErrorOverlay('test-error', 'tx-123', 'CSA_ERROR_000101', undefined, undefined, {
				trackNewTabs: true,
			});
			mockChrome.tabs.sendMessage.mockClear();

			// Now the flag is disabled: the tracked retry must bail at the flag check even though
			// the tab URL would otherwise be eligible.
			mockIsPolicyErrorBlockingEnabled.mockReturnValue(false);
			mockChrome.tabs.get.mockResolvedValue({
				id: 200,
				url: 'https://example.com',
			} as chrome.tabs.Tab);
			await retryOverlayForTab(200);

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should return early for access-blocked overlay when isAccessBlockedOverlayEnabled is disabled', async () => {
			// Arm BLOCK_URL_ERROR tracking while the flag is enabled so the retry reaches the flag check.
			mockIsAccessBlockedOverlayEnabled.mockReturnValue(true);
			mockChrome.tabs.query.mockResolvedValue([]);
			await displayAccessBlockedErrorOverlay({ 'blocked.example.com': false });
			mockChrome.tabs.sendMessage.mockClear();

			// Now the flag is disabled: the tracked retry must bail at the flag check even though
			// the tab URL is in the blocked map.
			mockIsAccessBlockedOverlayEnabled.mockReturnValue(false);
			mockChrome.tabs.get.mockResolvedValue({
				id: 200,
				url: 'https://blocked.example.com/page',
			} as chrome.tabs.Tab);
			await retryOverlayForTab(200);

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should return early when no tracked overlay criteria exist', async () => {
			await retryOverlayForTab(123);

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('delivers using the caller-supplied tabUrl without a chrome.tabs.get round-trip', async () => {
			mockIsAccessBlockedOverlayEnabled.mockReturnValue(true);
			mockChrome.tabs.query.mockResolvedValue([]);
			await displayAccessBlockedErrorOverlay({ 'blocked.example.com': false });
			mockChrome.tabs.sendMessage.mockClear();
			mockChrome.tabs.get.mockClear();

			await retryOverlayForTab(200, 'https://blocked.example.com/page');

			expect(mockChrome.tabs.get).not.toHaveBeenCalled();
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				200,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'BLOCK_URL_ERROR',
					tabId: 200,
				})
			);
		});

		it('drops delivery when the caller-supplied tabUrl is not in the blocked map (SSH gateway)', async () => {
			mockIsAccessBlockedOverlayEnabled.mockReturnValue(true);
			mockChrome.tabs.query.mockResolvedValue([]);
			await displayAccessBlockedErrorOverlay({ 'blocked.example.com': false });
			mockChrome.tabs.sendMessage.mockClear();
			mockChrome.tabs.get.mockClear();

			// The SSH gateway page is not in the blocked-domain map — the exact CTXBR-13845 case.
			await retryOverlayForTab(200, 'https://gateway.example.com/host:22');

			expect(mockChrome.tabs.get).not.toHaveBeenCalled();
			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should return early when the tab already has a tracked overlay', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', 'tx-123', 'CSA_ERROR_000101', undefined, undefined, {
				trackNewTabs: true,
			});

			mockChrome.tabs.sendMessage.mockClear();
			await retryOverlayForTab(123);

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should retry overlay delivery for tracked tabs that do not yet have overlay state', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];

			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error', 'tx-123', 'CSA_ERROR_000101', undefined, undefined, {
				trackNewTabs: true,
			});

			mockChrome.tabs.sendMessage.mockClear();
			// Generic (non access-blocked) overlays track with an empty domainPolicyMap, so any
			// valid http(s) tab is eligible — but retryOverlayForTab now looks up the tab URL.
			mockChrome.tabs.get.mockResolvedValue({
				id: 200,
				url: 'https://example.com',
			} as chrome.tabs.Tab);
			await retryOverlayForTab(200);

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				200,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'test-error',
					tabId: 200,
					transactionId: 'tx-123',
					errorCode: 'CSA_ERROR_000101',
				})
			);
		});

		it('should NOT deliver an access-blocked overlay to a tab whose URL is not in the blocked map', async () => {
			mockIsAccessBlockedOverlayEnabled.mockReturnValue(true);
			// Arm BLOCK_URL_ERROR tracking for an unrelated blocked domain.
			mockChrome.tabs.query.mockResolvedValue([
				{ id: 123, url: 'https://blocked.example.com' } as chrome.tabs.Tab,
			]);
			await displayAccessBlockedErrorOverlay({ 'blocked.example.com': false });
			mockChrome.tabs.sendMessage.mockClear();

			// The SSH gateway page (NOT in the blocked map) fires SSH_RDP_PAGE_READY.
			mockChrome.tabs.get.mockResolvedValue({
				id: 200,
				url: 'https://ssh.netscalergateway.net/host:22',
			} as chrome.tabs.Tab);
			await retryOverlayForTab(200);

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should deliver an access-blocked overlay to a tab whose URL IS in the blocked map', async () => {
			mockIsAccessBlockedOverlayEnabled.mockReturnValue(true);
			mockChrome.tabs.query.mockResolvedValue([
				{ id: 123, url: 'https://blocked.example.com' } as chrome.tabs.Tab,
			]);
			await displayAccessBlockedErrorOverlay({ 'blocked.example.com': false });
			mockChrome.tabs.sendMessage.mockClear();

			mockChrome.tabs.get.mockResolvedValue({
				id: 200,
				url: 'https://blocked.example.com/page',
			} as chrome.tabs.Tab);
			await retryOverlayForTab(200);

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				200,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'BLOCK_URL_ERROR',
					tabId: 200,
				})
			);
		});

		it('F4: does not throw when tracking is cleared concurrently during the tab lookup', async () => {
			// Arm generic overlay tracking with no eligible tabs (query empty) so the
			// overlay store stays empty and a later hideOverlayErrors() disables tracking.
			mockChrome.tabs.query.mockResolvedValue([]);
			await displayErrorOverlay('test-error', 'tx-123', 'CSA_ERROR_000101', undefined, undefined, {
				trackNewTabs: true,
			});
			mockChrome.tabs.sendMessage.mockClear();

			// Simulate a concurrent overlay-clear (policy refresh / dismiss) landing while
			// retryOverlayForTab is suspended on chrome.tabs.get: it nulls the shared
			// trackedOverlayCriteria. The resumed code must read its own snapshot and never
			// dereference the now-null shared field (previously: TypeError -> rejected promise).
			mockChrome.tabs.get.mockImplementation(async () => {
				await hideOverlayErrors();
				return { id: 200, url: 'https://example.com' } as chrome.tabs.Tab;
			});

			await expect(retryOverlayForTab(200)).resolves.toBeUndefined();
			// Tracking was cleared mid-flight by the concurrent hideOverlayErrors(), so the
			// resumed retry must NOT re-deliver the just-dismissed overlay.
			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should not deliver an access-blocked overlay when the domain policy map is empty', async () => {
			// An empty blocked-domain map must not arm or deliver BLOCK_URL_ERROR: an empty map is
			// treated as "all tabs eligible", which would re-introduce the spurious SSH overlay.
			mockIsAccessBlockedOverlayEnabled.mockReturnValue(true);
			mockChrome.tabs.query.mockResolvedValue([
				{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab,
			]);
			await displayAccessBlockedErrorOverlay({});
			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();

			// Tracking was not armed, so a subsequent retry is also a no-op.
			mockChrome.tabs.get.mockResolvedValue({
				id: 200,
				url: 'https://example.com',
			} as chrome.tabs.Tab);
			await retryOverlayForTab(200);
			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should honour excludedHostPatterns when retrying delivery for a tab', async () => {
			// Arm a generic overlay that excludes a host; the retry gate must honour the exclusion.
			mockChrome.tabs.query.mockResolvedValue([]);
			await displayErrorOverlay('test-error', 'tx-123', 'CSA_ERROR_000101', undefined, undefined, {
				trackNewTabs: true,
				excludedHostPatterns: ['excluded.example.com'],
			});
			mockChrome.tabs.sendMessage.mockClear();

			// A tab on the excluded host must NOT receive the overlay on retry.
			mockChrome.tabs.get.mockResolvedValue({
				id: 200,
				url: 'https://excluded.example.com/page',
			} as chrome.tabs.Tab);
			await retryOverlayForTab(200);
			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();

			// A tab on a non-excluded host still receives it (proves the exclusion is what blocked 200).
			mockChrome.tabs.get.mockResolvedValue({
				id: 201,
				url: 'https://allowed.example.com/page',
			} as chrome.tabs.Tab);
			await retryOverlayForTab(201);
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				201,
				expect.objectContaining({
					action: EVENT_TYPES.ERROR_OVERLAY_SHOW,
					errorId: 'test-error',
					tabId: 201,
				})
			);
		});

		it('should not send a duplicate when a concurrent delivery lands during the tab lookup', async () => {
			// Arm generic tracking and capture the onUpdated listener so we can simulate a
			// concurrent delivery to the same tab while retryOverlayForTab is suspended on the
			// chrome.tabs.get lookup.
			mockChrome.tabs.query.mockResolvedValue([]);
			await displayErrorOverlay('test-error', 'tx-123', 'CSA_ERROR_000101', undefined, undefined, {
				trackNewTabs: true,
			});
			const onUpdated = mockChrome.tabs.onUpdated.addListener.mock.calls.at(-1)?.[0] as (
				tabId: number,
				changeInfo: chrome.tabs.TabChangeInfo,
				tab: chrome.tabs.Tab
			) => void;
			mockChrome.tabs.sendMessage.mockClear();

			mockChrome.tabs.get.mockImplementation(async () => {
				// A concurrent tabs.onUpdated 'complete' delivers the overlay to tab 200 first.
				onUpdated(
					200,
					{ status: 'complete' } as chrome.tabs.TabChangeInfo,
					{ id: 200, url: 'https://example.com' } as chrome.tabs.Tab
				);
				// Let the fire-and-forget send settle so overlayStore records tab 200.
				await new Promise(resolve => setTimeout(resolve, 0));
				return { id: 200, url: 'https://example.com' } as chrome.tabs.Tab;
			});

			await retryOverlayForTab(200);

			// Exactly one delivery: the retry re-checked overlayStore and skipped the duplicate.
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
		});
	});

	describe('session storage hydration', () => {
		it('should hydrate overlay state from storage and dismiss tracked tabs on SW restart', async () => {
			mockSessionStorage.get.mockResolvedValue({
				'123': { errorId: 'EPA_NOT_INSTALLED', transactionId: 'tx-1' },
			});
			mockChrome.tabs.sendMessage.mockResolvedValue({});

			await hideOverlayErrors();

			expect(mockSessionStorage.get).toHaveBeenCalled();
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				123,
				expect.objectContaining({ action: EVENT_TYPES.ERROR_OVERLAY_DISMISS, tabId: 123 })
			);
		});

		it('should handle null stored state gracefully during hydration', async () => {
			mockSessionStorage.get.mockResolvedValue(null);
			await hideOverlayErrors();
			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('should not re-read storage on subsequent calls once hydrated', async () => {
			// First call hydrates and dismisses tab 456
			mockSessionStorage.get.mockResolvedValue({ '456': { errorId: 'test' } });
			mockChrome.tabs.sendMessage.mockResolvedValue({});
			await hideOverlayErrors();

			// Second call — add a new tab to in-memory map and dismiss it
			mockSessionStorage.get.mockClear();
			const tabs = [{ id: 789, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error');
			mockChrome.tabs.sendMessage.mockResolvedValue({});

			await hideOverlayErrors(); // already hydrated — should NOT call get again
			expect(mockSessionStorage.get).not.toHaveBeenCalled();
		});

		it('should handle session storage read failure gracefully', async () => {
			mockSessionStorage.get.mockRejectedValue(new Error('IndexedDB unavailable'));
			await expect(hideOverlayErrors()).resolves.toBeUndefined();
			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});
	});

	describe('session storage persistence', () => {
		it('should log error when session storage set fails after showing overlay', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			mockSessionStorage.set.mockRejectedValue(new Error('QuotaExceededError'));

			await displayErrorOverlay('test-error');
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(mockLogger.logError).toHaveBeenCalledWith(
				'message-overlay',
				'Failed to persist overlay state to session storage: QuotaExceededError'
			);
		});

		it('should log error when session storage clear fails', async () => {
			mockSessionStorage.clear.mockRejectedValue(new Error('Storage clear failed'));
			cleanupRTUOverlayForTab(999); // tab 999 not tracked → map stays empty → triggers clear
			await new Promise(resolve => setTimeout(resolve, 0));

			expect(mockLogger.logError).toHaveBeenCalledWith(
				'message-overlay',
				'Failed to clear overlay state from session storage: Storage clear failed'
			);
		});
	});

	describe('isTabStillAlive', () => {
		it('should skip executeScript when tab is closed during dismiss fallback', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error');
			jest.clearAllMocks();
			mockSessionStorage.get.mockResolvedValue(null);

			mockChrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Tab closed'));
			mockChrome.tabs.get.mockRejectedValue(new Error('No tab with id 123'));

			await hideOverlayErrors();
			expect(mockChrome.scripting.executeScript).not.toHaveBeenCalled();
		});
	});

	describe('directDismissOverlayOnTab', () => {
		it('should log error when executeScript fails while tab is still alive', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error');
			jest.clearAllMocks();
			mockSessionStorage.get.mockResolvedValue(null);

			mockChrome.tabs.sendMessage.mockRejectedValueOnce(new Error('No listener'));
			mockChrome.tabs.get.mockResolvedValue({ id: 123 });
			mockChrome.scripting.executeScript.mockRejectedValue(new Error('Script injection failed'));

			await hideOverlayErrors();

			expect(mockLogger.logError).toHaveBeenCalledWith(
				'message-overlay',
				'Failed to directly dismiss overlay on tab 123: Script injection failed'
			);
		});

		it('should execute removeInjectedOverlayFromPage and clean up DOM artifacts', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error');
			jest.clearAllMocks();
			mockSessionStorage.get.mockResolvedValue(null);

			mockChrome.tabs.sendMessage.mockRejectedValueOnce(new Error('No listener'));
			mockChrome.tabs.get.mockResolvedValue({ id: 123 });

			let capturedFunc: (() => boolean) | undefined;
			mockChrome.scripting.executeScript.mockImplementation(
				(params: { target: { tabId: number }; func: () => boolean }) => {
					capturedFunc = params.func;
					return Promise.resolve([]);
				}
			);

			await hideOverlayErrors();
			expect(capturedFunc).toBeDefined();

			// Set up DOM artifacts in jsdom then invoke the cleanup function
			const root = document.createElement('div');
			root.id = 'ds-error-react-root';
			document.body.appendChild(root);
			document.body.classList.add('ds-error-overlay-active');

			capturedFunc!();

			expect(document.querySelector('#ds-error-react-root')).toBeNull();
			expect(document.body.classList.contains('ds-error-overlay-active')).toBe(false);
		});

		it('should return null when chrome.scripting.executeScript is unavailable', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayErrorOverlay('test-error');
			jest.clearAllMocks();
			mockSessionStorage.get.mockResolvedValue(null);
			mockChrome.scripting.executeScript = undefined as any;

			mockChrome.tabs.sendMessage.mockRejectedValueOnce(new Error('No listener'));
			mockChrome.tabs.get.mockResolvedValue({ id: 123 });

			await expect(hideOverlayErrors()).resolves.toBeUndefined();
			mockChrome.scripting.executeScript = jest.fn().mockResolvedValue([]);
		});
	});

	describe('logError with non-Error values', () => {
		it('should use Unknown error message for non-Error thrown values', async () => {
			mockChrome.tabs.query.mockRejectedValue('connection refused');
			await expect(displayErrorOverlay('test-error')).rejects.toEqual('connection refused');
			expect(mockLogger.logError).toHaveBeenCalledWith(
				'message-overlay',
				'Error in displayErrorOverlay: Unknown error'
			);
		});
	});

	describe('message listener canHandle', () => {
		it('should return false from runtime message listener for unrecognized messages', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			const callback = jest.fn();
			await displayErrorOverlay('test-error', undefined, undefined, callback);

			const listener = (mockChrome.runtime.onMessage.addListener as jest.Mock).mock.calls[0][0];
			const result = listener({ action: 'completely-unknown-action' }, {}, jest.fn());

			expect(result).toBe(false);
		});
	});

	describe('Edge cases and chrome API checks', () => {
		it('should handle missing chrome.runtime.onMessage.addListener', async () => {
			const originalOnMessage = mockChrome.runtime.onMessage;
			mockChrome.runtime.onMessage = undefined as any;

			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			const callback = jest.fn();
			await displayErrorOverlay('test-error', undefined, undefined, callback);

			// Should not crash, just skip callback registration
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();

			// Restore
			mockChrome.runtime.onMessage = originalOnMessage;
		});

		it('should handle missing chrome.scripting.executeScript', async () => {
			const originalExecuteScript = mockChrome.scripting.executeScript;
			mockChrome.scripting.executeScript = undefined as any;

			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			mockChrome.tabs.sendMessage.mockRejectedValueOnce(new Error('Content script not loaded'));

			await displayErrorOverlay('test-error');

			// Should attempt to send message but fail gracefully without script injection
			expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();

			// Restore
			mockChrome.scripting.executeScript = originalExecuteScript;
		});
	});

	describe('error overlay feature flag', () => {
		it('should not display overlay when feature flag is disabled', async () => {
			mockIsPolicyErrorBlockingEnabled.mockReturnValue(false);

			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayErrorOverlay('test-error');

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
			expect(mockLogger.logInfo).toHaveBeenCalledWith(
				'message-overlay',
				'Policy error blocking is not enabled, skipping overlay display'
			);
		});

		it('should not display access blocked overlay when isAccessBlockedOverlayEnabled is disabled', async () => {
			mockIsAccessBlockedOverlayEnabled.mockReturnValue(false);

			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
			expect(mockLogger.logInfo).toHaveBeenCalledWith(
				'message-overlay',
				'Access blocked overlay is not enabled, skipping overlay display'
			);
		});

		it('should display access blocked overlay when isAccessBlockedOverlayEnabled is enabled even if isPolicyErrorBlockingOverlayEnabled is disabled', async () => {
			mockIsPolicyErrorBlockingEnabled.mockReturnValue(false);
			mockIsAccessBlockedOverlayEnabled.mockReturnValue(true);

			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				123,
				expect.objectContaining({ errorId: 'BLOCK_URL_ERROR' })
			);
		});

		it('should not display policy error overlay when isPolicyErrorBlockingOverlayEnabled is disabled even if isAccessBlockedOverlayEnabled is enabled', async () => {
			mockIsPolicyErrorBlockingEnabled.mockReturnValue(false);
			mockIsAccessBlockedOverlayEnabled.mockReturnValue(true);

			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayErrorOverlay('test-error');

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
			expect(mockLogger.logInfo).toHaveBeenCalledWith(
				'message-overlay',
				'Policy error blocking is not enabled, skipping overlay display'
			);
		});

		it('should display overlay when feature flag is enabled', async () => {
			mockIsPolicyErrorBlockingEnabled.mockReturnValue(true);

			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayErrorOverlay('test-error');

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();
		});

		it('displayForceLogoutOverlay: should display FORCE_LOGOUT overlay even when isPolicyErrorBlockingOverlayEnabled is disabled', async () => {
			mockIsPolicyErrorBlockingEnabled.mockReturnValue(false);

			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayForceLogoutOverlay(jest.fn(), { trackNewTabs: true });

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				123,
				expect.objectContaining({ errorId: 'FORCE_LOGOUT' })
			);
		});

		it('retryOverlayForTab: should still deliver FORCE_LOGOUT to a new tab even when isPolicyErrorBlockingOverlayEnabled is disabled', async () => {
			// Arm tracking while the flag is enabled, then disable it before the retry —
			// FORCE_LOGOUT must remain independent of this flag on both the initial
			// display path and the new-tab retry path.
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayForceLogoutOverlay(jest.fn(), { trackNewTabs: true });
			mockChrome.tabs.sendMessage.mockClear();

			mockIsPolicyErrorBlockingEnabled.mockReturnValue(false);
			mockChrome.tabs.get.mockResolvedValue({
				id: 200,
				url: 'https://example.com',
			} as chrome.tabs.Tab);
			await retryOverlayForTab(200);

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				200,
				expect.objectContaining({ errorId: 'FORCE_LOGOUT', tabId: 200 })
			);
		});
	});

	describe('logged out behavior — FF enabled, user logged out', () => {
		beforeEach(() => {
			mockIsPolicyErrorBlockingEnabled.mockReturnValue(true);
			mockIsUserLoggedOut.mockResolvedValue(true);
		});

		it('displayErrorOverlay: should skip overlay when FF enabled but user is logged out', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayErrorOverlay('test-error');

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
			expect(mockLogger.logInfo).toHaveBeenCalledWith(
				'message-overlay',
				'User is logged out: skipping overlay display'
			);
		});

		it('displayAccessBlockedErrorOverlay: should skip overlay when FF enabled but user is logged out', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayAccessBlockedErrorOverlay({ 'example.com': false });

			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
			expect(mockLogger.logInfo).toHaveBeenCalledWith(
				'message-overlay',
				'User is logged out: skipping overlay display'
			);
		});

		it('retryOverlayForTab: should skip retry when FF enabled but user is logged out', async () => {
			// Arm generic overlay tracking while logged IN (one-shot false ahead of the
			// describe's logged-out default) so the retry gets past the `!criteria` guard
			// and actually reaches the logged-out gate.
			mockIsUserLoggedOut.mockResolvedValueOnce(false);
			mockChrome.tabs.query.mockResolvedValue([]);
			await displayErrorOverlay('test-error', 'tx-123', 'CSA_ERROR_000101', undefined, undefined, {
				trackNewTabs: true,
			});
			mockChrome.tabs.sendMessage.mockClear();
			// Count only the retry's logged-out check below, not the arming call above.
			mockIsUserLoggedOut.mockClear();

			// Now logged out (describe beforeEach); an eligible tracked tab must be gated.
			mockChrome.tabs.get.mockResolvedValue({
				id: 200,
				url: 'https://example.com',
			} as chrome.tabs.Tab);
			await retryOverlayForTab(200);

			// isUserLoggedOut is reached only past the criteria + feature-flag gates — proves
			// the retry hit the logged-out gate rather than bailing early (cannot go vacuous).
			expect(mockIsUserLoggedOut).toHaveBeenCalled();
			expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
		});

		it('displayForceLogoutOverlay: should still render while user is logged out', async () => {
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayForceLogoutOverlay(jest.fn(), { trackNewTabs: true });

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				123,
				expect.objectContaining({ errorId: 'FORCE_LOGOUT' })
			);
		});

		it('retryOverlayForTab: should still deliver FORCE_LOGOUT to a new tab while user is logged out', async () => {
			// Enable tracking with a FORCE_LOGOUT overlay — allowed even when logged out.
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);
			await displayForceLogoutOverlay(jest.fn(), { trackNewTabs: true });
			mockChrome.tabs.sendMessage.mockClear();

			// A newly opened/rewritten tab (not yet in the overlay store) must still receive it.
			// FORCE_LOGOUT tracks with an empty domainPolicyMap, so any valid http(s) tab is eligible.
			mockChrome.tabs.get.mockResolvedValue({
				id: 200,
				url: 'https://example.com',
			} as chrome.tabs.Tab);
			await retryOverlayForTab(200);

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
				200,
				expect.objectContaining({ errorId: 'FORCE_LOGOUT', tabId: 200 })
			);
		});

		it('displayErrorOverlay: should show overlay when FF enabled and user is logged in', async () => {
			mockIsUserLoggedOut.mockResolvedValue(false);
			const tabs = [{ id: 123, url: 'https://example.com' } as chrome.tabs.Tab];
			mockChrome.tabs.query.mockResolvedValue(tabs);

			await displayErrorOverlay('test-error');

			expect(mockChrome.tabs.sendMessage).toHaveBeenCalled();
		});
	});
});
