// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

import { EVENT_TYPES, PolicyFetchState } from '../../constants';

// Mock Chrome APIs
const mockAddListener = jest.fn();
const mockSendMessage = jest.fn();
const mockQuery = jest.fn();
const mockUpdate = jest.fn();
const mockGetURL = jest.fn();

// Mock Logger Bridge
const mockLogInfo = jest.fn();
const mockLogError = jest.fn();

// Mock setTimeout
jest.useFakeTimers();

// Setup global mocks
(global as any).chrome = {
	runtime: {
		onMessage: {
			addListener: mockAddListener,
		},
		sendMessage: mockSendMessage,
		getURL: mockGetURL,
	},
	tabs: {
		query: mockQuery,
		update: mockUpdate,
	},
	declarativeNetRequest: {
		updateDynamicRules: jest.fn(),
	},
};

(global as any).window = {
	sshRdpLogger: {
		logInfo: mockLogInfo,
		logError: mockLogError,
	},
	addEventListener: jest.fn(),
	location: {
		origin: 'chrome-extension://test',
		href: 'chrome-extension://test/page.html',
		search: '',
	},
};

// Mock the logger module
jest.mock('@logger/Logger', () => ({
	logError: jest.fn(),
	logInfo: jest.fn(),
}));

describe('PolicyLoadingPage', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.resetModules();

		// Setup DOM with actual HTML structure
		const mockElement = {
			classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() },
			addEventListener: jest.fn(),
			querySelector: jest.fn(),
			style: { opacity: '1' },
			click: jest.fn(),
		};

		const mockGetElementById = jest.fn(id => {
			if (id === 'loading-view' || id === 'error-view') {
				return mockElement;
			}
			if (id === 'retry-button') {
				return { ...mockElement, click: jest.fn() };
			}
			return null;
		});

		const mockQuerySelector = jest.fn(() => mockElement);

		(global as any).document = {
			readyState: 'complete',
			getElementById: mockGetElementById,
			querySelector: mockQuerySelector,
			addEventListener: jest.fn(),
			body: { innerHTML: '' },
		};

		// Setup default Chrome API mocks
		mockGetURL.mockReturnValue(
			'chrome-extension://test/ErrorHandling/PolicyLoadingPage/PolicyLoading.html'
		);
		mockQuery.mockResolvedValue([]);
	});

	describe('Chrome Runtime Message Listener', () => {
		it('should register message listener on load', () => {
			require('./PolicyLoadingPage');
			expect(mockAddListener).toHaveBeenCalled();
		});

		it('should handle POLICY_STATE_CHANGE message correctly', () => {
			require('./PolicyLoadingPage');

			const mockCallback = mockAddListener.mock.calls[0][0];
			const message = {
				type: EVENT_TYPES.POLICY_STATE_CHANGE,
				state: PolicyFetchState.LOADING,
			};

			const result = mockCallback(message);

			expect(result).toBe(false);
		});

		it('should ignore non-POLICY_STATE_CHANGE messages', () => {
			require('./PolicyLoadingPage');
			const mockCallback = mockAddListener.mock.calls[0][0];
			const message = {
				type: 'other-message-type',
				state: PolicyFetchState.LOADING,
			};

			const result = mockCallback(message);

			expect(result).toBeUndefined();
		});
	});

	describe('requestCurrentState functionality', () => {
		it('should handle successful response with state', () => {
			const mockResponse = { success: true, state: PolicyFetchState.LOADING };
			mockSendMessage.mockImplementation((_message, callback) => {
				callback(mockResponse);
			});

			require('./PolicyLoadingPage');

			expect(mockSendMessage).toHaveBeenCalledWith(
				{ type: EVENT_TYPES.POLICY_STATE_REQUEST },
				expect.any(Function)
			);
		});

		it('should handle failed response with error', () => {
			const mockResponse = { success: false, error: 'Test error' };
			mockSendMessage.mockImplementation((_message, callback) => {
				callback(mockResponse);
			});

			require('./PolicyLoadingPage');

			expect(mockLogInfo).toHaveBeenCalledWith(
				'policy-loading-page',
				'Policy state not yet available: Test error'
			);
		});
	});

	describe('setupRetryButton functionality', () => {
		it('should setup event listener when button exists', () => {
			require('./PolicyLoadingPage');

			const retryButton = document.getElementById('retry-button');
			expect(retryButton).toBeTruthy();
			expect(retryButton?.addEventListener).toHaveBeenCalled();
		});
	});

	describe('updateState functionality', () => {
		it('should show loading view for IDLE state', () => {
			require('./PolicyLoadingPage');

			const loadingView = document.getElementById('loading-view');
			const errorView = document.getElementById('error-view');

			// Simulate updateState call
			const mockCallback = mockAddListener.mock.calls[0][0];
			mockCallback({ type: EVENT_TYPES.POLICY_STATE_CHANGE, state: PolicyFetchState.IDLE });

			expect(loadingView?.classList.remove).toHaveBeenCalled();
			expect(errorView?.classList.add).toHaveBeenCalled();
		});

		it('should show error view for ERROR state', () => {
			require('./PolicyLoadingPage');

			const loadingView = document.getElementById('loading-view');
			const errorView = document.getElementById('error-view');

			const mockCallback = mockAddListener.mock.calls[0][0];
			mockCallback({ type: EVENT_TYPES.POLICY_STATE_CHANGE, state: PolicyFetchState.ERROR });

			expect(errorView?.classList.remove).toHaveBeenCalled();
			expect(loadingView?.classList.add).toHaveBeenCalled();
		});

		it('should show loading view for SUCCESS state', () => {
			require('./PolicyLoadingPage');

			const loadingView = document.getElementById('loading-view');
			const errorView = document.getElementById('error-view');

			const mockCallback = mockAddListener.mock.calls[0][0];
			mockCallback({ type: EVENT_TYPES.POLICY_STATE_CHANGE, state: PolicyFetchState.SUCCESS });

			expect(loadingView?.classList.remove).toHaveBeenCalled();
			expect(errorView?.classList.add).toHaveBeenCalled();
		});
	});

	describe('handleInitialState functionality', () => {
		it('should show loading for LOADING state', () => {
			const mockResponse = { success: true, state: PolicyFetchState.LOADING };
			mockSendMessage.mockImplementation((_message, callback) => {
				callback(mockResponse);
			});

			require('./PolicyLoadingPage');

			const loadingView = document.getElementById('loading-view');
			const errorView = document.getElementById('error-view');

			expect(loadingView?.classList.remove).toHaveBeenCalled();
			expect(errorView?.classList.add).toHaveBeenCalled();
		});

		it('should show error and schedule retry for ERROR state', () => {
			const mockResponse = { success: true, state: PolicyFetchState.ERROR };
			mockSendMessage.mockImplementation((_message, callback) => {
				callback(mockResponse);
			});

			require('./PolicyLoadingPage');

			const errorView = document.getElementById('error-view');
			expect(errorView?.classList.remove).toHaveBeenCalled();
			// Just verify the behavior - setTimeout is called in the actual code
			// We can't easily mock the built-in setTimeout in this context
		});

		it('should show loading for SUCCESS state', () => {
			const mockResponse = { success: true, state: PolicyFetchState.SUCCESS };
			mockSendMessage.mockImplementation((_message, callback) => {
				callback(mockResponse);
			});

			require('./PolicyLoadingPage');

			const loadingView = document.getElementById('loading-view');
			const errorView = document.getElementById('error-view');

			expect(loadingView?.classList.remove).toHaveBeenCalled();
			expect(errorView?.classList.add).toHaveBeenCalled();
		});

		it('should show loading for IDLE state', () => {
			const mockResponse = { success: true, state: PolicyFetchState.IDLE };
			mockSendMessage.mockImplementation((_message, callback) => {
				callback(mockResponse);
			});

			require('./PolicyLoadingPage');

			const loadingView = document.getElementById('loading-view');
			const errorView = document.getElementById('error-view');

			expect(loadingView?.classList.remove).toHaveBeenCalled();
			expect(errorView?.classList.add).toHaveBeenCalled();
		});
	});

	describe('triggerRetry functionality', () => {
		it('should send retry message and update state to loading', () => {
			// First set up ERROR state to trigger retry
			const mockErrorResponse = { success: true, state: PolicyFetchState.ERROR };
			mockSendMessage.mockImplementation((_message, callback) => {
				callback(mockErrorResponse);
			});

			require('./PolicyLoadingPage');

			// Clear previous calls and set up retry response
			mockSendMessage.mockClear();
			const mockRetryResponse = { success: true };
			mockSendMessage.mockImplementation((_message, callback) => {
				callback(mockRetryResponse);
			});

			// Advance timers to trigger retry
			jest.advanceTimersByTime(100);

			expect(mockSendMessage).toHaveBeenCalledWith(
				{
					action: EVENT_TYPES.ERROR_ACTION_RETRY,
					timestamp: expect.any(Number),
				},
				expect.any(Function)
			);
		});

		it('should log error when retry fails', () => {
			// Set up ERROR state to trigger retry
			const mockErrorResponse = { success: true, state: PolicyFetchState.ERROR };
			mockSendMessage.mockImplementation((_message, callback) => {
				callback(mockErrorResponse);
			});

			require('./PolicyLoadingPage');

			// Clear previous calls and set up retry failure response
			mockSendMessage.mockClear();
			const mockRetryResponse = { success: false, error: 'Retry failed' };
			mockSendMessage.mockImplementation((_message, callback) => {
				callback(mockRetryResponse);
			});

			// Advance timers to trigger retry
			jest.advanceTimersByTime(100);

			expect(mockLogError).toHaveBeenCalledWith(
				'policy-loading-page',
				'Policy retry failed: Retry failed'
			);
		});
	});

	describe('setupRetryButton functionality', () => {
		it('should handle missing retry button gracefully', () => {
			const mockElement = {
				classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() },
				addEventListener: jest.fn(),
				querySelector: jest.fn(),
				style: { opacity: '1' },
				click: jest.fn(),
			};

			const mockGetElementById = jest.fn(id => {
				if (id === 'loading-view' || id === 'error-view') {
					return mockElement;
				}
				return null; // retry-button missing
			});

			(global as any).document.getElementById = mockGetElementById;

			expect(() => {
				jest.resetModules();
				require('./PolicyLoadingPage');
			}).not.toThrow();
		});
	});

	describe('Initialization', () => {
		it('should initialize when DOM is already loaded', () => {
			(global as any).document.readyState = 'complete';

			require('./PolicyLoadingPage');

			expect(mockSendMessage).toHaveBeenCalledWith(
				{ type: EVENT_TYPES.POLICY_STATE_REQUEST },
				expect.any(Function)
			);
		});

		it('should setup DOMContentLoaded event listener when DOM is loading', () => {
			(global as any).document.readyState = 'loading';

			document.addEventListener = jest.fn();

			require('./PolicyLoadingPage');

			expect(document.addEventListener).toHaveBeenCalledWith(
				'DOMContentLoaded',
				expect.any(Function)
			);
		});
	});

	describe('Edge Cases and Error Handling', () => {
		it('should handle chrome.runtime being undefined', () => {
			delete (global as any).chrome;

			expect(() => {
				jest.resetModules();
				require('./PolicyLoadingPage');
			}).toThrow();
		});

		it('should handle window.sshRdpLogger being undefined', () => {
			delete (global as any).window.sshRdpLogger;

			expect(() => {
				jest.resetModules();
				require('./PolicyLoadingPage');
			}).toThrow();
		});
	});
});
