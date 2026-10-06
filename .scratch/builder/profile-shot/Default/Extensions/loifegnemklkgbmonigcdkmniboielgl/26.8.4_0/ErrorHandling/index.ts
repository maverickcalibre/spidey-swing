// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

// ErrorHandling module exports

// Error IDs constants
export { ERROR_IDS, type ErrorId } from './errorIds';

// NMH Error Code Mapping
export {
	mapNMHErrorCode,
	NMH_ERROR_CODES,
	type NMHErrorCode,
	type NMHErrorMapping,
} from './nmhErrorCodeMapping';

// Per-error-type error codes
export {
	POLICY_ENFORCE_ERROR_CODES,
	POLICY_RETRIEVE_ERROR_CODES,
	type PolicyEnforceErrorCode,
	type PolicyRetrieveErrorCode,
} from './policyErrorCodes';

// Error handling
export {
	ErrorActionHandler,
	type ErrorActionCallback,
	type ErrorActionMessage,
} from './ErrorActionHandler';

// Error overlay component
export * from './ErrorOverlay/ErrorOverlayComponent';

// Error handling rules
export * from './ErrorOverlay/ErrorOverlay';
