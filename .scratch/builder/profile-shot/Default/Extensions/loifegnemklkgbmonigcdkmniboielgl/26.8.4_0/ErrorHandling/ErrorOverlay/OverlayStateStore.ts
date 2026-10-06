// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

import { sessionStorage } from '../../Storage/SessionStorage';

export interface OverlayState {
	errorId: string;
	transactionId?: string;
	errorCode?: string;
}

/**
 * Wraps a Map<number, OverlayState> with automatic session-storage persistence.
 * Mutations (set/delete/clear) fire-and-forget persist to storage.
 * Call hydrateIfNeeded() once before reading on a fresh service-worker start.
 */
export class OverlayStateStore {
	private readonly inner = new Map<number, OverlayState>();
	private hydrated = false;

	constructor(
		private readonly storageKey: string,
		private readonly onPersistError?: (message: string, error: unknown) => void
	) {}

	get(tabId: number): OverlayState | undefined {
		return this.inner.get(tabId);
	}
	has(tabId: number): boolean {
		return this.inner.has(tabId);
	}
	get size(): number {
		return this.inner.size;
	}
	keys(): IterableIterator<number> {
		return this.inner.keys();
	}

	set(tabId: number, state: OverlayState): void {
		this.inner.set(tabId, state);
		this.persist();
	}

	delete(tabId: number): void {
		this.inner.delete(tabId);
		this.persist();
	}

	clear(): void {
		this.inner.clear();
		this.persist();
	}

	async hydrateIfNeeded(): Promise<void> {
		if (this.hydrated) {
			return;
		}
		try {
			const stored = await sessionStorage.get<Record<string, OverlayState>>(this.storageKey);
			if (stored) {
				for (const [tabIdStr, state] of Object.entries(stored)) {
					this.inner.set(Number(tabIdStr), state);
				}
			}
			// Only mark hydrated on success; a transient read failure leaves the flag
			// false so the next call can retry rather than silently staying empty.
			this.hydrated = true;
		} catch {
			// Best-effort; leave hydrated=false so a later call can retry
		}
	}

	private persist(): void {
		if (this.inner.size === 0) {
			void sessionStorage.clear(this.storageKey).catch((error: unknown) => {
				this.onPersistError?.('Failed to clear overlay state from session storage', error);
			});
			return;
		}
		const record: Record<string, OverlayState> = {};
		for (const [tabId, state] of this.inner) {
			record[String(tabId)] = state;
		}
		void sessionStorage.set(this.storageKey, record).catch((error: unknown) => {
			this.onPersistError?.('Failed to persist overlay state to session storage', error);
		});
	}
}
