// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

/**
 * Unit tests for NMH Error Code Mapping
 * Tests the mapping from Native Messaging Host error codes to user-facing error IDs
 */

import { ERROR_IDS } from './errorIds';
import { mapNMHErrorCode, NMH_ERROR_CODES } from './nmhErrorCodeMapping';
import { POLICY_ENFORCE_ERROR_CODES } from './policyErrorCodes';

describe('NMH Error Code Mapping', () => {
	describe('mapNMHErrorCode', () => {
		describe('Workspace App Errors', () => {
			it('should map SDK_INIT_FAILED to WORKSPACE_APP_ERROR with no errorCode', () => {
				const result = mapNMHErrorCode(NMH_ERROR_CODES.SDK_INIT_FAILED);
				expect(result.errorId).toBe(ERROR_IDS.WORKSPACE_APP_ERROR);
				expect(result.errorCode).toBeUndefined();
			});

			it('should map CWA_NOT_INSTALLED to WORKSPACE_APP_ERROR with no errorCode', () => {
				const result = mapNMHErrorCode(NMH_ERROR_CODES.CWA_NOT_INSTALLED);
				expect(result.errorId).toBe(ERROR_IDS.WORKSPACE_APP_ERROR);
				expect(result.errorCode).toBeUndefined();
			});

			it('should map CWA_VERSION_UNSUPPORTED to WORKSPACE_APP_ERROR with no errorCode', () => {
				const result = mapNMHErrorCode(NMH_ERROR_CODES.CWA_VERSION_UNSUPPORTED);
				expect(result.errorId).toBe(ERROR_IDS.WORKSPACE_APP_ERROR);
				expect(result.errorCode).toBeUndefined();
			});

			it('should map CWA_VERSION_PARSE_ERROR to WORKSPACE_APP_ERROR with no errorCode', () => {
				const result = mapNMHErrorCode(NMH_ERROR_CODES.CWA_VERSION_PARSE_ERROR);
				expect(result.errorId).toBe(ERROR_IDS.WORKSPACE_APP_ERROR);
				expect(result.errorCode).toBeUndefined();
			});
		});

		describe('Policy Enforce Errors', () => {
			it('should map AKL_SERVICE_TIMEOUT to POLICY_ENFORCE_FAILED with NMH_AKL_SERVICE_TIMEOUT errorCode', () => {
				const result = mapNMHErrorCode(NMH_ERROR_CODES.AKL_SERVICE_TIMEOUT);
				expect(result.errorId).toBe(ERROR_IDS.POLICY_ENFORCE_FAILED);
				expect(result.errorCode).toBe(POLICY_ENFORCE_ERROR_CODES.NMH_AKL_SERVICE_TIMEOUT);
			});

			it('should map AKL_ENFORCEMENT_FAILED to POLICY_ENFORCE_FAILED with NMH_AKL_ENFORCEMENT_FAILED errorCode', () => {
				const result = mapNMHErrorCode(NMH_ERROR_CODES.AKL_ENFORCEMENT_FAILED);
				expect(result.errorId).toBe(ERROR_IDS.POLICY_ENFORCE_FAILED);
				expect(result.errorCode).toBe(POLICY_ENFORCE_ERROR_CODES.NMH_AKL_ENFORCEMENT_FAILED);
			});

			it('should map EXCEPTION_OCCURRED to POLICY_ENFORCE_FAILED with NMH_EXCEPTION errorCode', () => {
				const result = mapNMHErrorCode(NMH_ERROR_CODES.EXCEPTION_OCCURRED);
				expect(result.errorId).toBe(ERROR_IDS.POLICY_ENFORCE_FAILED);
				expect(result.errorCode).toBe(POLICY_ENFORCE_ERROR_CODES.NMH_EXCEPTION);
			});
		});

		describe('Unknown/Unhandled Errors', () => {
			it('should map unknown error codes to UNKNOWN_ERROR with no errorCode (default case)', () => {
				const unknownErrorCode = 999 as any;
				const result = mapNMHErrorCode(unknownErrorCode);
				expect(result.errorId).toBe(ERROR_IDS.UNKNOWN_ERROR);
				expect(result.errorCode).toBeUndefined();
			});
		});

		describe('All Defined Error Codes', () => {
			it('should handle all NMH_ERROR_CODES values and return valid errorIds', () => {
				const allErrorCodes = Object.values(NMH_ERROR_CODES);
				const validErrorIds = Object.values(ERROR_IDS);
				allErrorCodes.forEach(code => {
					const { errorId } = mapNMHErrorCode(code);
					expect(validErrorIds).toContain(errorId);
				});
			});
		});

		describe('Error Code Constants', () => {
			it('should have all required NMH error code constants', () => {
				expect(NMH_ERROR_CODES.SDK_INIT_FAILED).toBe(1);
				expect(NMH_ERROR_CODES.CWA_NOT_INSTALLED).toBe(11);
				expect(NMH_ERROR_CODES.CWA_VERSION_UNSUPPORTED).toBe(12);
				expect(NMH_ERROR_CODES.CWA_VERSION_PARSE_ERROR).toBe(13);
				expect(NMH_ERROR_CODES.AKL_SERVICE_TIMEOUT).toBe(21);
				expect(NMH_ERROR_CODES.AKL_ENFORCEMENT_FAILED).toBe(22);
				expect(NMH_ERROR_CODES.EXCEPTION_OCCURRED).toBe(91);
			});
		});

		describe('Workspace Error Mapping Groups', () => {
			it('should group all workspace-related errors together', () => {
				const workspaceErrors = [
					NMH_ERROR_CODES.SDK_INIT_FAILED,
					NMH_ERROR_CODES.CWA_NOT_INSTALLED,
					NMH_ERROR_CODES.CWA_VERSION_UNSUPPORTED,
					NMH_ERROR_CODES.CWA_VERSION_PARSE_ERROR,
				];
				workspaceErrors.forEach(code => {
					const { errorId, errorCode } = mapNMHErrorCode(code);
					expect(errorId).toBe(ERROR_IDS.WORKSPACE_APP_ERROR);
					expect(errorCode).toBeUndefined();
				});
			});
		});

		describe('Error Mapping Consistency', () => {
			it('should return consistent results for the same error code', () => {
				const result1 = mapNMHErrorCode(NMH_ERROR_CODES.SDK_INIT_FAILED);
				const result2 = mapNMHErrorCode(NMH_ERROR_CODES.SDK_INIT_FAILED);
				expect(result1.errorId).toBe(result2.errorId);
				expect(result1.errorCode).toBe(result2.errorCode);
			});

			it('should not mutate input or have side effects', () => {
				const errorCode = NMH_ERROR_CODES.CWA_NOT_INSTALLED;
				const originalCode = errorCode;
				mapNMHErrorCode(errorCode);
				expect(errorCode).toBe(originalCode);
			});
		});
	});
});
