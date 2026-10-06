// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

import logger from '@logger/Logger';
import { EVENT_TYPES } from '../constants';

const moduleName = 'error-action-handler';

// Supported action types for ErrorActionHandler
const SUPPORTED_ERROR_ACTION_TYPES = [
	EVENT_TYPES.ERROR_ACTION_RETRY,
	EVENT_TYPES.ERROR_ACTION_CANCEL,
	EVENT_TYPES.ERROR_ACTION_SIGN_IN,
] as const;

export type SupportedErrorActionType = (typeof SUPPORTED_ERROR_ACTION_TYPES)[number];

export type ErrorActionCallback = (
	message: ErrorActionMessage,
	sender: chrome.runtime.MessageSender
) => void | Promise<void>;
export interface ErrorActionMessage {
	action: SupportedErrorActionType;
	tabId?: number;
	url?: string;
	errorId?: string;
	errorType?: string;
	transactionId?: string;
	timestamp?: number;
}

export class ErrorActionHandler {
	private readonly callbacks: Record<SupportedErrorActionType, ErrorActionCallback | null> = {
		[EVENT_TYPES.ERROR_ACTION_RETRY]: null,
		[EVENT_TYPES.ERROR_ACTION_CANCEL]: null,
		[EVENT_TYPES.ERROR_ACTION_SIGN_IN]: null,
	};

	public setRetryCallback(callback: ErrorActionCallback): void {
		this.callbacks[EVENT_TYPES.ERROR_ACTION_RETRY] = callback;
	}

	public setCancelCallback(callback: ErrorActionCallback): void {
		this.callbacks[EVENT_TYPES.ERROR_ACTION_CANCEL] = callback;
	}

	public setSignInCallback(callback: ErrorActionCallback): void {
		this.callbacks[EVENT_TYPES.ERROR_ACTION_SIGN_IN] = callback;
	}

	public handleMessage(
		message: ErrorActionMessage,
		sender: chrome.runtime.MessageSender,
		sendResponse: (response: { success: boolean; error?: string }) => void
	): boolean {
		if (!this.canHandle(message)) {
			return false;
		}

		const { action } = message;
		const callback = this.callbacks[action];

		if (!callback) {
			logger.logError(moduleName, `${action} action received but no callback registered`);
			sendResponse({ success: false, error: `No ${action} handler registered` });
			return true;
		}

		// Execute callback asynchronously but respond immediately to keep message channel open
		(async () => {
			try {
				logger.logInfo(moduleName, `Executing ${action} callback`);
				await callback(message, sender);
				sendResponse({ success: true });
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
				logger.logError(
					moduleName,
					`Error handling ${action}: ${errorMessage} - tabId: ${message.tabId}, errorId: ${message.errorId}`
				);
				sendResponse({ success: false, error: errorMessage });
			}
		})();

		return true;
	}

	public canHandle(message: unknown): message is ErrorActionMessage {
		const msg = message as any;
		return (
			typeof message === 'object' &&
			message !== null &&
			'action' in msg &&
			SUPPORTED_ERROR_ACTION_TYPES.includes(msg.action) &&
			// Overlay actions always carry a tabId; policy-loading-page messages do not.
			// Requiring tabId here prevents policy-page retries from being misrouted here.
			typeof msg.tabId === 'number'
		);
	}
}
