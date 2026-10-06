// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import logger from '../../Logger/Logger';
import { EVENT_TYPES } from '../../constants';
import { handleOverlayCallback } from './ErrorOverlay';

// Helper function to check if URL is valid for interception
export function isValidNavigationUrl(url: string): boolean {
	return (
		!url.includes('chrome://') &&
		!url.includes('chrome-extension://') &&
		!url.includes('ErrorPage.html') &&
		(url.startsWith('http://') || url.startsWith('https://'))
	);
}

const moduleName = 'ErrorHandling/ErrorOverlayComponent.tsx';

const DIMENSIONS = {
	HEIGHT: { MIN: 250, MAX: 600, DEFAULT: 250 },
	WIDTH: { MIN: 480, MAX: 640, DEFAULT: 540 },
	Z_INDEX: 9999,
} as const;

const ANIMATIONS = { TRANSITION: '0.3s cubic-bezier(0.4, 0, 0.2, 1)', BLUR: 'blur(14px)' } as const;

const SCROLL_PREVENTION = {
	overflow: 'hidden',
	overflowX: 'hidden',
	overflowY: 'hidden',
	scrollbarWidth: 'none' as const,
	msOverflowStyle: 'none' as const,
} as const;

const clampDimension = (value: number, min: number, max: number, fallback: number): number =>
	Math.max(min, Math.min(max, value || fallback));

const iframeStyle: React.CSSProperties = {
	background: '#fff',
	borderRadius: '12px',
	boxShadow: '0 2px 16px rgba(0,0,0,0.2)',
	minWidth: `${DIMENSIONS.WIDTH.MIN}px`,
	border: 'none',
	display: 'block',
	width: 'auto',
	height: 'auto',
	...SCROLL_PREVENTION,
};

const createDynamicIframeStyle = (dimensions: {
	height: number;
	width: number;
}): React.CSSProperties => ({
	...iframeStyle,
	height: `${dimensions.height}px`,
	width: `${dimensions.width}px`,
	minWidth: `${DIMENSIONS.WIDTH.MIN}px`,
	maxWidth: `${DIMENSIONS.WIDTH.MAX}px`,
	transition: `height ${ANIMATIONS.TRANSITION}, width ${ANIMATIONS.TRANSITION}`,
});

// Store callback context for iframe communication
export const overlayCallbacks = new Map<string, { tabId: number }>();
// Store React roots for proper cleanup
const overlayRoots = new Map<string, ReturnType<typeof createRoot>>();
// Store iframe contentWindow references for message validation
const iframeWindows = new Map<string, Window>();
interface ErrorOverlayProps {
	errorId: string;
	transactionId?: string;
	errorCode?: string;
}

const overlayStyle: React.CSSProperties = {
	position: 'fixed',
	top: 0,
	left: 0,
	width: '100vw',
	height: '100vh',
	background: 'rgba(0,0,0,0.40)',
	zIndex: DIMENSIONS.Z_INDEX,
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	pointerEvents: 'all',
	touchAction: 'none',
	...SCROLL_PREVENTION,
};

const BLUR_CLASS = 'ds-error-overlay-active';
const BLUR_STYLE_ID = 'ds-error-overlay-style';
let blurStyleElement: HTMLStyleElement | null = null;

const ErrorOverlayComponent: React.FC<ErrorOverlayProps> = ({
	errorId,
	transactionId,
	errorCode,
}) => {
	const [dimensions, setDimensions] = useState<{ height: number; width: number }>({
		height: DIMENSIONS.HEIGHT.DEFAULT,
		width: DIMENSIONS.WIDTH.DEFAULT,
	});
	const iframeRef = React.useRef<HTMLIFrameElement>(null);

	const dynamicIframeStyle = createDynamicIframeStyle(dimensions);
	useEffect(() => {
		const originalStyles = {
			overflow: document.body.style.overflow,
			position: document.body.style.position,
			width: document.body.style.width,
		};
		Object.assign(document.body.style, { overflow: 'hidden', position: 'fixed', width: '100%' });

		if (!blurStyleElement) {
			blurStyleElement = document.getElementById(BLUR_STYLE_ID) as HTMLStyleElement | null;
		}
		if (!blurStyleElement) {
			blurStyleElement = document.createElement('style');
			blurStyleElement.id = BLUR_STYLE_ID;
			blurStyleElement.textContent = `
				body.${BLUR_CLASS} > *:not(#ds-error-react-root) {
					filter: ${ANIMATIONS.BLUR};
					transition: filter ${ANIMATIONS.TRANSITION};
				}
			`;
			document.head.appendChild(blurStyleElement);
		}
		document.body.classList.add(BLUR_CLASS);

		const handleIframeSizeMessage = (event: MessageEvent): void => {
			const extensionOrigin = `chrome-extension://${chrome.runtime.id}`;

			// Single validation check: both sender origin and extension ID must match
			if (event.origin !== extensionOrigin || event.data.extensionId !== chrome.runtime.id) {
				return; // Reject messages not from our extension
			}

			if (event.data.type === EVENT_TYPES.IFRAME_SIZE_UPDATE) {
				const updates: Partial<typeof dimensions> = {};
				if (event.data.contentHeight !== undefined) {
					updates.height = event.data.contentHeight;
				}
				if (event.data.contentWidth !== undefined) {
					updates.width = clampDimension(
						event.data.contentWidth,
						DIMENSIONS.WIDTH.MIN,
						DIMENSIONS.WIDTH.MAX,
						DIMENSIONS.WIDTH.DEFAULT
					);
				}
				if (Object.keys(updates).length) {
					setDimensions(prev => {
						const newDimensions = { ...prev, ...updates };
						return newDimensions;
					});
				}
			}
		};
		window.addEventListener('message', handleIframeSizeMessage);

		// Store iframe contentWindow for message validation
		const overlayElement = document.getElementById('ds-error-react-root');
		const overlayId = overlayElement?.dataset.overlayId;
		if (overlayId && iframeRef.current?.contentWindow) {
			iframeWindows.set(overlayId, iframeRef.current.contentWindow);
		}

		return (): void => {
			Object.assign(document.body.style, originalStyles);
			document.body.classList.remove(BLUR_CLASS);
			if (blurStyleElement) {
				blurStyleElement.remove();
				blurStyleElement = null;
			}
			window.removeEventListener('message', handleIframeSizeMessage);

			// Clean up iframe window reference
			const overlayElement = document.getElementById('ds-error-react-root');
			const overlayId = overlayElement?.dataset.overlayId;
			if (overlayId) {
				iframeWindows.delete(overlayId);
			}
		};
	}, []);

	// Construct iframe URL with transaction ID support
	const iframeSrc = ((): string => {
		const baseUrl = chrome.runtime.getURL('ErrorHandling/ErrorOverlay/ErrorPopup.html');
		const params = new URLSearchParams();
		params.set('ds-error', errorId);
		if (transactionId) {
			params.set('transaction-id', transactionId);
		}
		if (errorCode) {
			params.set('error-code', errorCode);
		}
		return `${baseUrl}?${params.toString()}`;
	})();

	return (
		<div style={overlayStyle} id="ds-error-react-root">
			<iframe ref={iframeRef} src={iframeSrc} style={dynamicIframeStyle} title="Error" />
		</div>
	);
};

export default ErrorOverlayComponent;

// Test-friendly function that can be wrapped in act()
export function renderErrorOverlay(
	rootDiv: HTMLDivElement,
	errorId: string,
	transactionId?: string,
	errorCode?: string
): ReturnType<typeof createRoot> {
	const root = createRoot(rootDiv);
	root.render(
		<ErrorOverlayComponent errorId={errorId} transactionId={transactionId} errorCode={errorCode} />
	);
	return root;
}

export function unmountExistingOverlays(): void {
	for (const [existingOverlayId, root] of Array.from(overlayRoots.entries())) {
		root.unmount();
		overlayRoots.delete(existingOverlayId);
		overlayCallbacks.delete(existingOverlayId);
	}

	const orphanedOverlays = Array.from(document.querySelectorAll('#ds-error-react-root'));
	if (orphanedOverlays.length > 0) {
		// Best-effort cleanup for orphaned overlays (React cleanup won't run)
		document.body.classList.remove(BLUR_CLASS);
		const blurStyleElement = document.getElementById(BLUR_STYLE_ID);
		if (blurStyleElement) {
			blurStyleElement.remove();
		}
		// Reset body styles that might have been set by orphaned overlays
		document.body.style.overflow = '';
		document.body.style.position = '';
		document.body.style.width = '';

		for (const overlay of orphanedOverlays) {
			overlay.remove();
		}
	}
}

export function mountErrorOverlay(
	errorId: string,
	tabId: number,
	transactionId?: string,
	errorCode?: string
): void {
	unmountExistingOverlays();

	const overlayId = `overlay_${transactionId || errorId}`;
	overlayCallbacks.set(overlayId, { tabId });
	const rootDiv = Object.assign(document.createElement('div'), { id: 'ds-error-react-root' });
	rootDiv.dataset.overlayId = overlayId;
	document.body.appendChild(rootDiv);

	const root = renderErrorOverlay(rootDiv, errorId, transactionId, errorCode);
	overlayRoots.set(overlayId, root);
}

// Function to dismiss/remove overlay
export function dismissOverlay(overlayId?: string): boolean {
	try {
		if (overlayId) {
			// Dismiss specific overlay
			const overlayElement = document.querySelector(`[data-overlay-id="${overlayId}"]`);
			if (overlayElement) {
				// Unmount React root before removing DOM element
				const root = overlayRoots.get(overlayId);
				if (root) {
					root.unmount();
					overlayRoots.delete(overlayId);
				}
				overlayElement.remove();
				overlayCallbacks.delete(overlayId);
				iframeWindows.delete(overlayId);
				return true;
			} else {
				return false;
			}
		} else {
			// Dismiss all overlays
			const allOverlays = document.querySelectorAll('#ds-error-react-root');
			let dismissedCount = 0;

			for (const overlay of allOverlays) {
				const overlayElement = overlay as HTMLElement;
				const id = overlayElement.dataset.overlayId;

				// Unmount React root if it exists
				if (id) {
					const root = overlayRoots.get(id);
					if (root) {
						root.unmount();
						overlayRoots.delete(id);
					}
					overlayCallbacks.delete(id);
					iframeWindows.delete(id);
				}

				overlay.remove();
				dismissedCount++;
			}
			return dismissedCount > 0;
		}
	} catch (error) {
		logger.logError(moduleName, `Error dismissing overlay: ${error}`);
		return false;
	}
}

// Initialize chrome runtime listeners only in browser environment
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
	chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		if (message.action === EVENT_TYPES.ERROR_OVERLAY_SHOW) {
			mountErrorOverlay(message.errorId, message.tabId, message.transactionId, message.errorCode);
			sendResponse({ success: true });
		} else if (message.action === EVENT_TYPES.ERROR_OVERLAY_DISMISS) {
			// If specific tabId provided, find overlay for that tab
			if (message.tabId) {
				let dismissed = false;
				for (const [overlayId, callbackData] of overlayCallbacks.entries()) {
					if (callbackData.tabId === message.tabId) {
						dismissed = dismissOverlay(overlayId);
						break;
					}
				}
				sendResponse({ success: dismissed });
			} else {
				// No tabId provided - dismiss all overlays
				const dismissed = dismissOverlay();
				sendResponse({ success: dismissed });
			}
		}
	});
}

// Initialize window message listeners only in browser environment
if (typeof window !== 'undefined') {
	window.addEventListener('message', event => {
		const { origin, data, source } = event;
		const extensionOrigin = `chrome-extension://${chrome.runtime.id}`;

		// Security: Only accept messages from the extension origin
		if (origin !== extensionOrigin) {
			return;
		}

		// Security: Validate the message comes from our iframe's contentWindow
		if (data.type === EVENT_TYPES.IFRAME_ACTION) {
			const overlayElement = document.getElementById('ds-error-react-root');
			const overlayId = overlayElement?.dataset.overlayId;
			const callbackData = overlayId ? overlayCallbacks.get(overlayId) : null;

			if (!callbackData) {
				logger.logError(moduleName, `No callback data found for overlay: ${overlayId}`);
				return;
			}

			// Security: Verify the message source is the iframe's contentWindow
			const expectedIframeWindow = overlayId ? iframeWindows.get(overlayId) : null;
			if (!expectedIframeWindow || source !== expectedIframeWindow) {
				logger.logError(moduleName, `Message source validation failed - not from trusted iframe`);
				return;
			}

			// Security: Validate extensionId in the message data
			if (data.extensionId !== chrome.runtime.id) {
				logger.logError(moduleName, `Extension ID mismatch in message data`);
				return;
			}

			const overlayAction = data.action;

			if (
				overlayAction !== EVENT_TYPES.ERROR_ACTION_RETRY &&
				overlayAction !== EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS &&
				overlayAction !== EVENT_TYPES.ERROR_ACTION_SIGN_IN
			) {
				logger.logError(moduleName, `Invalid overlay action received: ${String(data.action)}`);
				return;
			}
			handleOverlayCallback(
				overlayAction,
				window.location.href,
				callbackData.tabId,
				data.errorType,
				data.transactionId
			)
				.then((success: boolean) => {
					if (success && overlayId) {
						// For retry/cancel, dismiss the overlay so the user sees the result.
						// For download logs, keep the overlay open so the user can retry or cancel.
						// For FORCE_LOGOUT sign-in, keep the overlay visible until the service worker
						// clears it via hideOverlayErrors() after re-authentication.
						const isForceLogoutSignIn =
							overlayAction === EVENT_TYPES.ERROR_ACTION_SIGN_IN &&
							data.errorType === 'FORCE_LOGOUT';
						if (overlayAction !== EVENT_TYPES.ERROR_ACTION_DOWNLOAD_LOGS && !isForceLogoutSignIn) {
							dismissOverlay(overlayId);
							overlayCallbacks.delete(overlayId);
						}
					}
				})
				.catch((error: any) => logger.logError(moduleName, `Error processing callback: ${error}`));
		}
	});
}
