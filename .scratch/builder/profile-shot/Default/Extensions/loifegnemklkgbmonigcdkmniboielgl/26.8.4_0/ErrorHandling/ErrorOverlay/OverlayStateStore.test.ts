// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

const mockSessionStorage = {
	get: jest.fn(),
	set: jest.fn(),
	clear: jest.fn(),
};

jest.mock('../../Storage/SessionStorage', () => ({
	sessionStorage: mockSessionStorage,
}));

import { OverlayStateStore, type OverlayState } from './OverlayStateStore';

const STATE_A: OverlayState = { errorId: 'ERR_A', transactionId: 'tx-1' };
const STATE_B: OverlayState = { errorId: 'ERR_B' };

describe('OverlayStateStore', () => {
	let store: OverlayStateStore;
	let onPersistError: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		mockSessionStorage.get.mockResolvedValue(null);
		mockSessionStorage.set.mockResolvedValue(undefined);
		mockSessionStorage.clear.mockResolvedValue(undefined);
		onPersistError = jest.fn();
		store = new OverlayStateStore('test-key', onPersistError);
	});

	describe('Map operations', () => {
		it('get returns undefined for unknown tabId', () => {
			expect(store.get(1)).toBeUndefined();
		});

		it('has returns false for unknown tabId', () => {
			expect(store.has(1)).toBe(false);
		});

		it('size is 0 initially', () => {
			expect(store.size).toBe(0);
		});

		it('set makes state accessible via get/has/size', () => {
			store.set(1, STATE_A);
			expect(store.get(1)).toEqual(STATE_A);
			expect(store.has(1)).toBe(true);
			expect(store.size).toBe(1);
		});

		it('set overwrites existing state for the same tabId', () => {
			store.set(1, STATE_A);
			store.set(1, STATE_B);
			expect(store.get(1)).toEqual(STATE_B);
			expect(store.size).toBe(1);
		});

		it('delete removes a known tabId', () => {
			store.set(1, STATE_A);
			store.delete(1);
			expect(store.has(1)).toBe(false);
			expect(store.size).toBe(0);
		});

		it('delete on an unknown tabId is a no-op', () => {
			store.delete(999);
			expect(store.size).toBe(0);
		});

		it('keys returns an iterator of all stored tab IDs', () => {
			store.set(1, STATE_A);
			store.set(2, STATE_B);
			expect(Array.from(store.keys())).toEqual(expect.arrayContaining([1, 2]));
		});

		it('clear removes all entries', () => {
			store.set(1, STATE_A);
			store.set(2, STATE_B);
			store.clear();
			expect(store.size).toBe(0);
			expect(store.has(1)).toBe(false);
			expect(store.has(2)).toBe(false);
		});
	});

	describe('persistence', () => {
		it('set calls sessionStorage.set with the serialized record', () => {
			store.set(1, STATE_A);
			expect(mockSessionStorage.set).toHaveBeenCalledWith('test-key', { '1': STATE_A });
		});

		it('set with multiple entries serializes all of them', () => {
			store.set(1, STATE_A);
			store.set(2, STATE_B);
			expect(mockSessionStorage.set).toHaveBeenLastCalledWith('test-key', {
				'1': STATE_A,
				'2': STATE_B,
			});
		});

		it('delete with remaining entries calls sessionStorage.set (not clear)', () => {
			store.set(1, STATE_A);
			store.set(2, STATE_B);
			jest.clearAllMocks();
			store.delete(1);
			expect(mockSessionStorage.set).toHaveBeenCalledWith('test-key', { '2': STATE_B });
			expect(mockSessionStorage.clear).not.toHaveBeenCalled();
		});

		it('delete of the last entry calls sessionStorage.clear (not set)', () => {
			store.set(1, STATE_A);
			jest.clearAllMocks();
			store.delete(1);
			expect(mockSessionStorage.clear).toHaveBeenCalledWith('test-key');
			expect(mockSessionStorage.set).not.toHaveBeenCalled();
		});

		it('clear calls sessionStorage.clear (not set)', () => {
			store.set(1, STATE_A);
			jest.clearAllMocks();
			store.clear();
			expect(mockSessionStorage.clear).toHaveBeenCalledWith('test-key');
			expect(mockSessionStorage.set).not.toHaveBeenCalled();
		});

		it('calls onPersistError when sessionStorage.set rejects', async () => {
			const err = new Error('quota exceeded');
			mockSessionStorage.set.mockRejectedValueOnce(err);
			store.set(1, STATE_A);
			await Promise.resolve();
			expect(onPersistError).toHaveBeenCalledWith(
				'Failed to persist overlay state to session storage',
				err
			);
		});

		it('calls onPersistError when sessionStorage.clear rejects', async () => {
			const err = new Error('storage error');
			mockSessionStorage.clear.mockRejectedValueOnce(err);
			store.set(1, STATE_A);
			store.delete(1);
			await Promise.resolve();
			expect(onPersistError).toHaveBeenCalledWith(
				'Failed to clear overlay state from session storage',
				err
			);
		});

		it('does not throw when no onPersistError callback is provided and storage rejects', async () => {
			const silentStore = new OverlayStateStore('test-key');
			mockSessionStorage.set.mockRejectedValueOnce(new Error('boom'));
			expect(() => silentStore.set(1, STATE_A)).not.toThrow();
			await Promise.resolve();
		});
	});

	describe('hydrateIfNeeded', () => {
		it('loads stored state into the map', async () => {
			mockSessionStorage.get.mockResolvedValueOnce({ '1': STATE_A, '2': STATE_B });
			await store.hydrateIfNeeded();
			expect(store.get(1)).toEqual(STATE_A);
			expect(store.get(2)).toEqual(STATE_B);
			expect(store.size).toBe(2);
		});

		it('is a no-op when stored value is null', async () => {
			mockSessionStorage.get.mockResolvedValueOnce(null);
			await store.hydrateIfNeeded();
			expect(store.size).toBe(0);
		});

		it('reads storage only once across multiple calls', async () => {
			mockSessionStorage.get.mockResolvedValue({ '1': STATE_A });
			await store.hydrateIfNeeded();
			await store.hydrateIfNeeded();
			expect(mockSessionStorage.get).toHaveBeenCalledTimes(1);
		});

		it('leaves hydrated=false on storage failure so the next call retries', async () => {
			mockSessionStorage.get.mockRejectedValueOnce(new Error('read error'));
			await store.hydrateIfNeeded();
			expect(store.size).toBe(0);

			mockSessionStorage.get.mockResolvedValueOnce({ '1': STATE_A });
			await store.hydrateIfNeeded();
			expect(store.size).toBe(1);
		});

		it('preserves entries already in the map when hydrating', async () => {
			store.set(99, STATE_B);
			mockSessionStorage.get.mockResolvedValueOnce({ '1': STATE_A });
			await store.hydrateIfNeeded();
			expect(store.get(99)).toEqual(STATE_B);
			expect(store.get(1)).toEqual(STATE_A);
			expect(store.size).toBe(2);
		});
	});
});
