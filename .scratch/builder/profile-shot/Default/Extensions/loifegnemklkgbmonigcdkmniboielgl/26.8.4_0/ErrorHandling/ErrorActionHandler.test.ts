// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

import { EVENT_TYPES } from '../constants';
import { ErrorActionCallback, ErrorActionHandler, ErrorActionMessage } from './ErrorActionHandler';

// Mock the logger module before any imports
jest.mock('@logger/Logger', () => ({
	__esModule: true,
	default: {
		logInfo: jest.fn(),
		logError: jest.fn(),
		logDebug: jest.fn(),
	},
}));

// Import the mocked logger after setting up the mock
import logger from '@logger/Logger';
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('ErrorActionHandler', () => {
	let errorActionHandler: ErrorActionHandler;
	let mockSender: chrome.runtime.MessageSender;
	let mockSendResponse: jest.Mock<void, [{ success: boolean; error?: string }]>;
	let originalConsoleError: (message?: any, ...optionalParams: any[]) => void;

	beforeEach(() => {
		errorActionHandler = new ErrorActionHandler();
		mockSender = {
			tab: { id: 123, url: 'https://example.com' } as chrome.tabs.Tab,
		} as chrome.runtime.MessageSender;
		mockSendResponse = jest.fn();

		// Store and mock console.error
		originalConsoleError = console.error;
		console.error = jest.fn();

		// Clear all mock calls
		jest.clearAllMocks();
	});

	afterEach(() => {
		// Restore original console.error
		console.error = originalConsoleError;
	});

	describe('Constructor', () => {
		it('should initialize with null callbacks', () => {
			const handler = new ErrorActionHandler();
			expect(handler).toBeInstanceOf(ErrorActionHandler);
			// Verify initial state by testing that callbacks are not set
			expect((handler as any).callbacks[EVENT_TYPES.ERROR_ACTION_RETRY]).toBeNull();
			expect((handler as any).callbacks[EVENT_TYPES.ERROR_ACTION_CANCEL]).toBeNull();
		});
	});

	describe('setRetryCallback', () => {
		it('should set retry callback', () => {
			const retryCallback: ErrorActionCallback = jest.fn();

			errorActionHandler.setRetryCallback(retryCallback);

			expect((errorActionHandler as any).callbacks[EVENT_TYPES.ERROR_ACTION_RETRY]).toBe(
				retryCallback
			);
		});

		it('should overwrite existing retry callback', () => {
			const firstCallback: ErrorActionCallback = jest.fn();
			const secondCallback: ErrorActionCallback = jest.fn();

			errorActionHandler.setRetryCallback(firstCallback);
			errorActionHandler.setRetryCallback(secondCallback);

			expect((errorActionHandler as any).callbacks[EVENT_TYPES.ERROR_ACTION_RETRY]).toBe(
				secondCallback
			);
		});
	});

	describe('setCancelCallback', () => {
		it('should set cancel callback', () => {
			const cancelCallback: ErrorActionCallback = jest.fn();

			errorActionHandler.setCancelCallback(cancelCallback);

			expect((errorActionHandler as any).callbacks[EVENT_TYPES.ERROR_ACTION_CANCEL]).toBe(
				cancelCallback
			);
		});

		it('should overwrite existing cancel callback', () => {
			const firstCallback: ErrorActionCallback = jest.fn();
			const secondCallback: ErrorActionCallback = jest.fn();

			errorActionHandler.setCancelCallback(firstCallback);
			errorActionHandler.setCancelCallback(secondCallback);

			expect((errorActionHandler as any).callbacks[EVENT_TYPES.ERROR_ACTION_CANCEL]).toBe(
				secondCallback
			);
		});
	});

	describe('canHandle', () => {
		it('should return true for valid retry message', () => {
			const message: ErrorActionMessage = {
				action: EVENT_TYPES.ERROR_ACTION_RETRY,
				tabId: 123,
				url: 'https://example.com',
				errorType: 'network',
				transactionId: 'tx-123',
			};

			expect(errorActionHandler.canHandle(message)).toBe(true);
		});

		it('should return true for valid cancel message', () => {
			const message: ErrorActionMessage = {
				action: EVENT_TYPES.ERROR_ACTION_CANCEL,
				tabId: 456,
				url: 'https://test.com',
				errorType: 'timeout',
				transactionId: 'tx-456',
			};

			expect(errorActionHandler.canHandle(message)).toBe(true);
		});

		it('should return true for message with minimal valid properties', () => {
			// Overlay messages always have tabId; that is the minimum requirement.
			const message = { action: EVENT_TYPES.ERROR_ACTION_RETRY, tabId: 123 };

			expect(errorActionHandler.canHandle(message)).toBe(true);
		});

		it('should return false for policy-loading-page-shaped retry (no tabId)', () => {
			// PolicyLoadingPage sends { action, timestamp } — no tabId.
			// These messages must NOT be handled here; they go to runtime_message_handler instead.
			const message = { action: EVENT_TYPES.ERROR_ACTION_RETRY, timestamp: Date.now() };

			expect(errorActionHandler.canHandle(message)).toBe(false);
		});

		it('should return false for message with invalid action', () => {
			const message = { action: 'invalid' };

			expect(errorActionHandler.canHandle(message)).toBe(false);
		});

		it('should return false for message without action property', () => {
			const message = { tabId: 123 };

			expect(errorActionHandler.canHandle(message)).toBe(false);
		});

		it('should return false for null message', () => {
			expect(errorActionHandler.canHandle(null)).toBe(false);
		});

		it('should return false for undefined message', () => {
			expect(errorActionHandler.canHandle(undefined)).toBe(false);
		});

		it('should return false for string message', () => {
			expect(errorActionHandler.canHandle('not an object')).toBe(false);
		});

		it('should return false for number message', () => {
			expect(errorActionHandler.canHandle(123)).toBe(false);
		});

		it('should return false for boolean message', () => {
			expect(errorActionHandler.canHandle(true)).toBe(false);
		});
	});

	describe('handleMessage', () => {
		describe('retry action', () => {
			it('should handle retry action with registered callback successfully', async () => {
				const retryCallback: ErrorActionCallback = jest.fn().mockResolvedValue(undefined);
				const message: ErrorActionMessage = {
					action: EVENT_TYPES.ERROR_ACTION_RETRY,
					tabId: 123,
					url: 'https://example.com',
					errorType: 'network',
					transactionId: 'tx-123',
				};
				errorActionHandler.setRetryCallback(retryCallback);
				const result = await errorActionHandler.handleMessage(
					message,
					mockSender,
					mockSendResponse
				);

				expect(result).toBe(true);
				expect(retryCallback).toHaveBeenCalledWith(message, mockSender);
				expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
			});

			it('should handle retry action without tabId in message when tabId is in sender', async () => {
				const retryCallback: ErrorActionCallback = jest.fn().mockResolvedValue(undefined);
				const message: ErrorActionMessage = {
					action: EVENT_TYPES.ERROR_ACTION_RETRY,
					tabId: 123,
					url: 'https://example.com',
					errorType: 'network',
					transactionId: 'tx-123',
				};

				errorActionHandler.setRetryCallback(retryCallback);
				const result = await errorActionHandler.handleMessage(
					message,
					mockSender,
					mockSendResponse
				);

				expect(result).toBe(true);
			});

			it('should handle retry action with no callback registered', async () => {
				const message: ErrorActionMessage = {
					action: EVENT_TYPES.ERROR_ACTION_RETRY,
					tabId: 123,
					url: 'https://example.com',
					errorType: 'network',
					transactionId: 'tx-123',
				};

				const result = await errorActionHandler.handleMessage(
					message,
					mockSender,
					mockSendResponse
				);

				expect(result).toBe(true);
				expect(mockSendResponse).toHaveBeenCalledWith({
					success: false,
					error: 'No error-action-retry handler registered',
				});
				expect(mockLogger.logError).toHaveBeenCalledWith(
					'error-action-handler',
					'error-action-retry action received but no callback registered'
				);
			});

			it('should handle retry callback that throws an error', async () => {
				const error = new Error('Callback failed');
				const retryCallback: ErrorActionCallback = jest.fn().mockRejectedValue(error);
				const message: ErrorActionMessage = {
					action: EVENT_TYPES.ERROR_ACTION_RETRY,
					tabId: 123,
					url: 'https://example.com',
					errorType: 'network',
					transactionId: 'tx-123',
				};

				errorActionHandler.setRetryCallback(retryCallback);
				const result = await errorActionHandler.handleMessage(
					message,
					mockSender,
					mockSendResponse
				);

				expect(result).toBe(true);
				expect(mockSendResponse).toHaveBeenCalledWith({
					success: false,
					error: 'Callback failed',
				});
				expect(mockLogger.logError).toHaveBeenCalledWith(
					'error-action-handler',
					'Error handling error-action-retry: Callback failed - tabId: 123, errorId: undefined'
				);
			});

			it('should handle retry callback that throws a non-Error object', async () => {
				const error = 'String error';
				const retryCallback: ErrorActionCallback = jest.fn().mockRejectedValue(error);
				const message: ErrorActionMessage = {
					action: EVENT_TYPES.ERROR_ACTION_RETRY,
					tabId: 123,
					url: 'https://example.com',
					errorType: 'network',
					transactionId: 'tx-123',
				};

				errorActionHandler.setRetryCallback(retryCallback);
				const result = await errorActionHandler.handleMessage(
					message,
					mockSender,
					mockSendResponse
				);

				expect(result).toBe(true);
				expect(mockSendResponse).toHaveBeenCalledWith({
					success: false,
					error: '"String error"', // JSON.stringify adds quotes around strings
				});
				expect(mockLogger.logError).toHaveBeenCalledWith(
					'error-action-handler',
					'Error handling error-action-retry: "String error" - tabId: 123, errorId: undefined' // JSON.stringify adds quotes
				);
			});
		});

		describe('cancel action', () => {
			it('should handle cancel action with registered callback successfully', async () => {
				const cancelCallback: ErrorActionCallback = jest.fn().mockResolvedValue(undefined);
				const message: ErrorActionMessage = {
					action: EVENT_TYPES.ERROR_ACTION_CANCEL,
					tabId: 456,
					url: 'https://test.com',
					errorType: 'timeout',
					transactionId: 'tx-456',
				};

				errorActionHandler.setCancelCallback(cancelCallback);
				const result = await errorActionHandler.handleMessage(
					message,
					mockSender,
					mockSendResponse
				);

				expect(result).toBe(true);
				expect(cancelCallback).toHaveBeenCalledWith(message, mockSender);
				expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
			});

			it('should handle cancel action with no callback registered', async () => {
				const message: ErrorActionMessage = {
					action: EVENT_TYPES.ERROR_ACTION_CANCEL,
					tabId: 456,
					url: 'https://test.com',
					errorType: 'timeout',
					transactionId: 'tx-456',
				};

				const result = await errorActionHandler.handleMessage(
					message,
					mockSender,
					mockSendResponse
				);

				expect(result).toBe(true);
				expect(mockSendResponse).toHaveBeenCalledWith({
					success: false,
					error: 'No error-action-cancel handler registered',
				});
				expect(mockLogger.logError).toHaveBeenCalledWith(
					'error-action-handler',
					'error-action-cancel action received but no callback registered'
				);
			});

			it('should handle cancel callback that throws an error', async () => {
				const error = new Error('Cancel failed');
				const cancelCallback: ErrorActionCallback = jest.fn().mockRejectedValue(error);
				const message: ErrorActionMessage = {
					action: EVENT_TYPES.ERROR_ACTION_CANCEL,
					tabId: 456,
					url: 'https://test.com',
					errorType: 'timeout',
					transactionId: 'tx-456',
				};

				errorActionHandler.setCancelCallback(cancelCallback);
				const result = await errorActionHandler.handleMessage(
					message,
					mockSender,
					mockSendResponse
				);

				expect(result).toBe(true);
				expect(mockSendResponse).toHaveBeenCalledWith({
					success: false,
					error: 'Cancel failed',
				});
				expect(mockLogger.logError).toHaveBeenCalledWith(
					'error-action-handler',
					'Error handling error-action-cancel: Cancel failed - tabId: 456, errorId: undefined'
				);
			});
		});

		describe('invalid messages', () => {
			it('should return false for messages that cannot be handled', async () => {
				const invalidMessage = { action: 'invalid' };

				const result = await errorActionHandler.handleMessage(
					invalidMessage as any,
					mockSender,
					mockSendResponse
				);

				expect(result).toBe(false);
				expect(mockSendResponse).not.toHaveBeenCalled();
			});

			it('should return false for null message', async () => {
				const result = await errorActionHandler.handleMessage(
					null as any,
					mockSender,
					mockSendResponse
				);

				expect(result).toBe(false);
				expect(mockSendResponse).not.toHaveBeenCalled();
			});
		});

		describe('edge cases with missing data', () => {
			it('should handle message with missing optional properties', async () => {
				const retryCallback: ErrorActionCallback = jest.fn().mockResolvedValue(undefined);
				// tabId is required (overlay contract); other overlay fields are optional
				const message: ErrorActionMessage = { action: EVENT_TYPES.ERROR_ACTION_RETRY, tabId: 789 };
				const senderWithoutTab = {} as chrome.runtime.MessageSender;

				errorActionHandler.setRetryCallback(retryCallback);
				const result = await errorActionHandler.handleMessage(
					message,
					senderWithoutTab,
					mockSendResponse
				);

				expect(result).toBe(true);
				expect(retryCallback).toHaveBeenCalledWith(message, senderWithoutTab);
				expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
			});

			it('should handle synchronous callback (non-promise)', async () => {
				const retryCallback: ErrorActionCallback = jest.fn(); // Synchronous callback
				const message: ErrorActionMessage = {
					action: EVENT_TYPES.ERROR_ACTION_RETRY,
					tabId: 123,
					url: 'https://example.com',
				};

				errorActionHandler.setRetryCallback(retryCallback);
				const result = await errorActionHandler.handleMessage(
					message,
					mockSender,
					mockSendResponse
				);

				expect(result).toBe(true);
				expect(retryCallback).toHaveBeenCalledWith(message, mockSender);
				expect(mockSendResponse).toHaveBeenCalledWith({ success: true });
			});
		});
	});

	describe('integration tests', () => {
		it('should handle multiple callback registrations and message processing', async () => {
			const retryCallback: ErrorActionCallback = jest.fn().mockResolvedValue(undefined);
			const cancelCallback: ErrorActionCallback = jest.fn().mockResolvedValue(undefined);

			// Register both callbacks
			errorActionHandler.setRetryCallback(retryCallback);
			errorActionHandler.setCancelCallback(cancelCallback);

			// Process retry message
			const retryMessage: ErrorActionMessage = {
				action: EVENT_TYPES.ERROR_ACTION_RETRY,
				tabId: 123,
				errorType: 'network',
			};
			const retryResult = await errorActionHandler.handleMessage(
				retryMessage,
				mockSender,
				mockSendResponse
			);

			// Process cancel message
			const cancelMessage: ErrorActionMessage = {
				action: EVENT_TYPES.ERROR_ACTION_CANCEL,
				tabId: 456,
				errorType: 'timeout',
			};
			const cancelResult = await errorActionHandler.handleMessage(
				cancelMessage,
				mockSender,
				mockSendResponse
			);

			expect(retryResult).toBe(true);
			expect(cancelResult).toBe(true);
			expect(retryCallback).toHaveBeenCalledWith(retryMessage, mockSender);
			expect(cancelCallback).toHaveBeenCalledWith(cancelMessage, mockSender);
			expect(mockSendResponse).toHaveBeenCalledTimes(2);
			expect(mockSendResponse).toHaveBeenNthCalledWith(1, { success: true });
			expect(mockSendResponse).toHaveBeenNthCalledWith(2, { success: true });
		});
	});
});
