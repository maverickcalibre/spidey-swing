// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

/**
 * NMH Error Code Mapping
 * Maps numeric error codes from Native Messaging Host responses to a
 * { errorId, errorCode } pair so callers can set both the user-facing
 * error category and the precise shareable sub-code in one call.
 */

import { ERROR_IDS, type ErrorId } from './errorIds';
import { POLICY_ENFORCE_ERROR_CODES } from './policyErrorCodes';

export const NMH_ERROR_CODES = {
	SDK_INIT_FAILED: 1,
	CWA_NOT_INSTALLED: 11,
	CWA_VERSION_UNSUPPORTED: 12,
	CWA_VERSION_PARSE_ERROR: 13,
	AKL_SERVICE_TIMEOUT: 21,
	AKL_ENFORCEMENT_FAILED: 22,
	EXCEPTION_OCCURRED: 91,
} as const;

export type NMHErrorCode = (typeof NMH_ERROR_CODES)[keyof typeof NMH_ERROR_CODES];

export interface NMHErrorMapping {
	errorId: ErrorId;
	errorCode: string | undefined;
}

/**
 * Maps an NMH numeric error code to the user-facing error ID and the
 * precise shareable sub-code to display in the error popup.
 *
 * @param nmhCode - Numeric error code from the NMH response
 * @returns { errorId, errorCode }
 */
export function mapNMHErrorCode(nmhCode: NMHErrorCode): NMHErrorMapping {
	switch (nmhCode) {
		case NMH_ERROR_CODES.SDK_INIT_FAILED:
			return {
				errorId: ERROR_IDS.WORKSPACE_APP_ERROR,
				errorCode: undefined,
			};

		case NMH_ERROR_CODES.CWA_NOT_INSTALLED:
			return {
				errorId: ERROR_IDS.WORKSPACE_APP_ERROR,
				errorCode: undefined,
			};

		case NMH_ERROR_CODES.CWA_VERSION_UNSUPPORTED:
			return {
				errorId: ERROR_IDS.WORKSPACE_APP_ERROR,
				errorCode: undefined,
			};

		case NMH_ERROR_CODES.CWA_VERSION_PARSE_ERROR:
			return {
				errorId: ERROR_IDS.WORKSPACE_APP_ERROR,
				errorCode: undefined,
			};

		case NMH_ERROR_CODES.AKL_SERVICE_TIMEOUT:
			return {
				errorId: ERROR_IDS.POLICY_ENFORCE_FAILED,
				errorCode: POLICY_ENFORCE_ERROR_CODES.NMH_AKL_SERVICE_TIMEOUT,
			};

		case NMH_ERROR_CODES.AKL_ENFORCEMENT_FAILED:
			return {
				errorId: ERROR_IDS.POLICY_ENFORCE_FAILED,
				errorCode: POLICY_ENFORCE_ERROR_CODES.NMH_AKL_ENFORCEMENT_FAILED,
			};

		case NMH_ERROR_CODES.EXCEPTION_OCCURRED:
			return {
				errorId: ERROR_IDS.POLICY_ENFORCE_FAILED,
				errorCode: POLICY_ENFORCE_ERROR_CODES.NMH_EXCEPTION,
			};

		default:
			return { errorId: ERROR_IDS.UNKNOWN_ERROR, errorCode: undefined };
	}
}
