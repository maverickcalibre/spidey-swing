// Copyright (c) 2026. Citrix Systems, Inc. All Rights Reserved. Confidential & Proprietary

/* tslint:disable */
/* eslint-disable */

/**
 * Main NTLM authenticator for Chrome extensions
 */
export class NtlmAuthenticator {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Create NTLM AUTHENTICATE message (Type 3) in response to server challenge
     *
     * # Parameters
     * - `challenge_base64`: Base64-encoded NTLM CHALLENGE message (Type 2) from server
     *
     * Returns a base64-encoded NTLM AUTHENTICATE message.
     */
    createAuthenticateMessage(challenge_base64: string): string;
    /**
     * Create NTLM NEGOTIATE message (Type 1)
     *
     * This is the first message sent to the server to initiate authentication.
     * Returns a base64-encoded NTLM message.
     */
    createNegotiateMessage(): string;
    /**
     * Get the NTLM session key (16 bytes) after successful authentication.
     *
     * This key is required for SMB 3.x key derivation (KBKDF-HMAC-SHA256).
     * Must be called after `createAuthenticateMessage()`.
     *
     * Returns a 16-byte Uint8Array containing the session key.
     */
    getSessionKey(): Uint8Array;
    /**
     * Get the current authentication state
     */
    getState(): string;
    /**
     * Create a new NTLM authenticator
     *
     * # Parameters
     * - `username`: Username for authentication
     * - `password`: Password for authentication
     * - `domain`: Optional domain name (can be null/undefined)
     * - `workstation`: Optional workstation name (can be null/undefined)
     */
    constructor(username: string, password: string, domain?: string | null, workstation?: string | null);
    /**
     * Reset the authenticator to initial state
     */
    reset(): void;
}

/**
 * NTLM Negotiation Flags for customization
 */
export class NtlmFlags {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Create default flags suitable for SMB
     */
    constructor();
    /**
     * Create flags for sealing (SMB encryption)
     */
    static with_sealing(): NtlmFlags;
    /**
     * Create flags for signing (SMB signing)
     */
    static with_signing(): NtlmFlags;
    /**
     * Request 128-bit encryption
     */
    key_128: boolean;
    /**
     * Request NTLM authentication
     */
    ntlm: boolean;
    /**
     * Request sealing (encryption)
     */
    seal: boolean;
    /**
     * Request signing
     */
    sign: boolean;
    /**
     * Request Unicode encoding
     */
    unicode: boolean;
}

/**
 * Compute AES-128-CMAC (RFC 4493) over arbitrary-length data.
 *
 * Used for SMB 3.x message signing. This provides the same functionality
 * as the `cmac` crate from the RustCrypto project, compiled to WASM.
 *
 * # Parameters
 * - `key`: 16-byte AES-128 key (the signing key derived from KBKDF)
 * - `data`: Arbitrary-length input data (the SMB2 message to sign)
 *
 * # Returns
 * 16-byte CMAC authentication tag
 *
 * # Errors
 * Returns an error if the key is not exactly 16 bytes.
 */
export function aesCmac(key: Uint8Array, data: Uint8Array): Uint8Array;

/**
 * Verify an AES-128-CMAC tag against data.
 *
 * # Parameters
 * - `key`: 16-byte AES-128 key
 * - `data`: Input data that was signed
 * - `tag`: 16-byte expected CMAC tag
 *
 * # Returns
 * `true` if the tag is valid, `false` otherwise.
 */
export function aesCmacVerify(key: Uint8Array, data: Uint8Array, tag: Uint8Array): boolean;

/**
 * Helper function to create NTLM AUTHENTICATE message with raw bytes
 */
export function createAuthenticateMessageRaw(username: string, password: string, domain: string | null | undefined, workstation: string | null | undefined, challenge_bytes: Uint8Array): Uint8Array;

/**
 * Helper function to create NTLM NEGOTIATE message with raw bytes
 *
 * This is a convenience function for direct byte manipulation.
 */
export function createNegotiateMessageRaw(username: string, password: string, domain?: string | null, workstation?: string | null): Uint8Array;

/**
 * Decrypt a Kerberos AP-REP and return the subkey bytes if present.
 *
 * Used during Kerberos SESSION_SETUP to extract the server-chosen subkey
 * from the AP-REP's `EncAPRepPart`. When present, the subkey replaces the
 * ticket session key as the KBKDF input for SMB 3.x session key derivation.
 *
 * # Parameters
 * - `ap_rep_bytes`: DER-encoded AP-REP (the inner `responseToken`, without
 *   SPNEGO wrapping).
 * - `session_key`: 32-byte AES-256 ticket session key.
 *
 * # Returns
 * - `Ok(Some(Uint8Array))` — subkey extracted (32 bytes for AES-256).
 * - `Ok(null)` — AP-REP decrypted successfully but contains no subkey field.
 * - `Err(string)` — parse or HMAC/decryption failure.
 */
export function decryptApRep(ap_rep_bytes: Uint8Array, session_key: Uint8Array): Uint8Array | undefined;

/**
 * Complete NTLM handshake helper (for simple use cases)
 *
 * Returns a JSON object with both negotiate and authenticate messages.
 */
export function performNtlmHandshake(username: string, password: string, domain: string | null | undefined, workstation: string | null | undefined, server_challenge_base64: string): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_get_ntlmflags_key_128: (a: number) => number;
    readonly __wbg_get_ntlmflags_ntlm: (a: number) => number;
    readonly __wbg_get_ntlmflags_seal: (a: number) => number;
    readonly __wbg_get_ntlmflags_sign: (a: number) => number;
    readonly __wbg_get_ntlmflags_unicode: (a: number) => number;
    readonly __wbg_ntlmauthenticator_free: (a: number, b: number) => void;
    readonly __wbg_ntlmflags_free: (a: number, b: number) => void;
    readonly __wbg_set_ntlmflags_key_128: (a: number, b: number) => void;
    readonly __wbg_set_ntlmflags_ntlm: (a: number, b: number) => void;
    readonly __wbg_set_ntlmflags_seal: (a: number, b: number) => void;
    readonly __wbg_set_ntlmflags_sign: (a: number, b: number) => void;
    readonly __wbg_set_ntlmflags_unicode: (a: number, b: number) => void;
    readonly aesCmac: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly aesCmacVerify: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly createAuthenticateMessageRaw: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly createNegotiateMessageRaw: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly decryptApRep: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly ntlmauthenticator_createAuthenticateMessage: (a: number, b: number, c: number, d: number) => void;
    readonly ntlmauthenticator_createNegotiateMessage: (a: number, b: number) => void;
    readonly ntlmauthenticator_getSessionKey: (a: number, b: number) => void;
    readonly ntlmauthenticator_getState: (a: number, b: number) => void;
    readonly ntlmauthenticator_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly ntlmauthenticator_reset: (a: number, b: number) => void;
    readonly ntlmflags_new: () => number;
    readonly ntlmflags_with_sealing: () => number;
    readonly ntlmflags_with_signing: () => number;
    readonly performNtlmHandshake: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
