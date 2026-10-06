// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

/**
 * All per-throw-site error codes for policy errors.
 *
 * Codes are assigned at the throw site so the error popup can show the user a
 * precise, shareable identifier without hard-coding anything in errorConfig.json.
 *
 * ── POLICY_RETRIEVE_FAILED ──────────────────────────────────────────────────
 *   CSA_ERROR_000001  NETWORK_ERROR           Non-2xx HTTP when fetching policy from SPA service
 *   CSA_ERROR_000002  JWT_EXPIRED             JWT token has already expired
 *   CSA_ERROR_000003  JWT_PAYLOAD_INVALID     JWT payload missing or invalid `cfg` field
 *   CSA_ERROR_000004  INVALID_JWS_STRUCTURE   Malformed JWS or missing `kid`/`alg`
 *   CSA_ERROR_000005  CERT_NOT_FOUND          Signing cert absent from managed storage
 *   CSA_ERROR_000006  INVALID_CERT            Signing cert present but content invalid
 *   CSA_ERROR_000007  JWS_PAYLOAD_MISMATCH    JWS payload does not match expected value
 *   CSA_ERROR_000008  CERT_ISSUER_MISMATCH    Issuer/subject mismatch in certificate chain
 *   CSA_ERROR_000009  CERT_EXPIRED            Signing certificate has expired
 *   CSA_ERROR_000010  SIGNATURE_FAILED        Cryptographic signature verification failed
 *   CSA_ERROR_000011  NMH_TIMEOUT             AKL service timed out in the Native Messaging Host
 *   CSA_ERROR_000012  NULL_POLICY_RESPONSE    Policy response from server was null or missing
 *
 * ── POLICY_ENFORCE_FAILED ─────────────────────────────────────────────────
 *   CSA_ERROR_000101  NMH_AKL_ENFORCEMENT_FAILED  NMH code 22 – AKL enforcement failed in NMH
 *   CSA_ERROR_000102  NMH_EXCEPTION               NMH code 91 – Unhandled exception inside NMH
 *   CSA_ERROR_000103  NMH_RESPONSE_ERROR          NMH returned error with no recognised code
 *   CSA_ERROR_000104  MISSING_AKL_STATUS          antiKeyLogging field absent from NMH response
 *   CSA_ERROR_000105  INVALID_AKL_STATUS          antiKeyLogging has an unexpected value
 *   CSA_ERROR_000106  HANDSHAKE_ID_MISMATCH       Message ID mismatch or invalid handshake structure
 *   CSA_ERROR_000107  HANDSHAKE_ERROR             NMH returned error during handshake exchange
 *   CSA_ERROR_000108  HANDSHAKE_MISSING_SIGNATURE Missing signature field in handshake response
 */

// ---------------------------------------------------------------------------
// POLICY_RETRIEVE_FAILED
// ---------------------------------------------------------------------------
export const POLICY_RETRIEVE_ERROR_CODES = {
	/** Non-2xx HTTP response when fetching the policy from the SPA service */
	NETWORK_ERROR: 'CSA_ERROR_000001',
	/** The received JWT token has already expired */
	JWT_EXPIRED: 'CSA_ERROR_000002',
	/** JWT payload is missing or has an invalid `cfg` field */
	JWT_PAYLOAD_INVALID: 'CSA_ERROR_000003',
	/** JWS token does not have the expected three-part structure, or is missing `kid`/`alg` */
	INVALID_JWS_STRUCTURE: 'CSA_ERROR_000004',
	/** The signing certificate for the given `kid` is not present in managed storage */
	CERT_NOT_FOUND: 'CSA_ERROR_000005',
	/** The signing certificate is present but its content is invalid */
	INVALID_CERT: 'CSA_ERROR_000006',
	/** JWS payload does not match the expected value */
	JWS_PAYLOAD_MISMATCH: 'CSA_ERROR_000007',
	/** Issuer / subject mismatch detected in the certificate chain */
	CERT_ISSUER_MISMATCH: 'CSA_ERROR_000008',
	/** The signing certificate has expired */
	CERT_EXPIRED: 'CSA_ERROR_000009',
	/** Cryptographic signature verification failed */
	SIGNATURE_FAILED: 'CSA_ERROR_000010',
	/** AKL service timed out in the Native Messaging Host */
	NMH_TIMEOUT: 'CSA_ERROR_000011',
	/** Policy response returned from the server was null or missing */
	NULL_POLICY_RESPONSE: 'CSA_ERROR_000012',
} as const;

export type PolicyRetrieveErrorCode =
	(typeof POLICY_RETRIEVE_ERROR_CODES)[keyof typeof POLICY_RETRIEVE_ERROR_CODES];

// ---------------------------------------------------------------------------
// POLICY_ENFORCE_FAILED
// ---------------------------------------------------------------------------
export const POLICY_ENFORCE_ERROR_CODES = {
	/** NMH code 21 – AKL service timed out inside the native host */
	NMH_AKL_SERVICE_TIMEOUT: 'CSA_ERROR_000100',
	/** NMH code 22 – AKL enforcement failed inside the native host */
	NMH_AKL_ENFORCEMENT_FAILED: 'CSA_ERROR_000101',
	/** NMH code 91 – Unhandled exception inside the native host */
	NMH_EXCEPTION: 'CSA_ERROR_000102',
	/** NMH returned an error response with no recognised numeric code */
	NMH_RESPONSE_ERROR: 'CSA_ERROR_000103',
	/** antiKeyLogging field is absent from the NMH policy response */
	MISSING_AKL_STATUS: 'CSA_ERROR_000104',
	/** antiKeyLogging field has an unexpected / unsupported value */
	INVALID_AKL_STATUS: 'CSA_ERROR_000105',
	/** Handshake response message ID does not match the request or structure is invalid */
	HANDSHAKE_ID_MISMATCH: 'CSA_ERROR_000106',
	/** NMH returned an error object during the handshake exchange */
	HANDSHAKE_ERROR: 'CSA_ERROR_000107',
	/** Handshake response payload is missing the required signature field */
	HANDSHAKE_MISSING_SIGNATURE: 'CSA_ERROR_000108',
} as const;

export type PolicyEnforceErrorCode =
	(typeof POLICY_ENFORCE_ERROR_CODES)[keyof typeof POLICY_ENFORCE_ERROR_CODES];
