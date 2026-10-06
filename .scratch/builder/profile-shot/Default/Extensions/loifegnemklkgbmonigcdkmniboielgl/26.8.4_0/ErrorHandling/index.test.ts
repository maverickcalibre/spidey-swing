// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

import { beforeAll, describe, expect, it, jest } from '@jest/globals';

// Mock DOM before importing modules
beforeAll(() => {
	// Mock document
	const mockDocument = {
		addEventListener: jest.fn(),
		URL: 'http://localhost:3000',
		querySelector: jest.fn(() => null),
		getElementById: jest.fn(() => null),
		createElement: jest.fn(() => ({
			addEventListener: jest.fn(),
			setAttribute: jest.fn(),
			style: {},
			classList: {
				add: jest.fn(),
				remove: jest.fn(),
				toggle: jest.fn(),
			},
		})),
	};

	// Mock Chrome APIs
	const mockChrome = {
		tabs: {
			query: jest.fn(),
			sendMessage: jest.fn(),
		},
		runtime: {
			sendMessage: jest.fn(),
			onMessage: {
				addListener: jest.fn(),
			},
		},
	};

	// Mock window object
	const mockWindow = {
		chrome: mockChrome,
		location: {
			href: 'http://localhost:3000',
			search: '',
		},
		addEventListener: jest.fn(),
	};

	// Set global mocks
	(globalThis as any).document = mockDocument;
	(globalThis as any).window = mockWindow;
	(globalThis as any).chrome = mockChrome;
});

describe('ErrorHandling index.ts', () => {
	describe('Core Exports', () => {
		it('should export error handling components', async () => {
			const { ErrorActionHandler } = await import('./index');
			expect(ErrorActionHandler).toBeDefined();
			expect(typeof ErrorActionHandler).toBe('function');
		});
	});

	describe('Module Exports', () => {
		it('should export main module classes and functions', async () => {
			const { ErrorActionHandler, displayErrorOverlay } = await import('./index');

			expect(ErrorActionHandler).toBeDefined();
			expect(displayErrorOverlay).toBeDefined();

			expect(typeof ErrorActionHandler).toBe('function');
			expect(typeof displayErrorOverlay).toBe('function');
		});
	});

	describe('Module Structure', () => {
		it('should follow comprehensive barrel export pattern', async () => {
			const indexModule = await import('./index');

			// Verify that exports are properly structured
			expect(indexModule).toBeDefined();
			expect(typeof indexModule).toBe('object');

			// Check that we have the expected core exports
			const expectedExports = ['ErrorActionHandler', 'displayErrorOverlay'];

			for (const exportName of expectedExports) {
				expect(indexModule).toHaveProperty(exportName);
			}
		});

		it('should provide comprehensive module access', async () => {
			const indexModule = await import('./index');

			// Verify we have a reasonable number of exports
			const exportCount = Object.keys(indexModule).length;
			expect(exportCount).toBeGreaterThan(5);
		});
	});
});
