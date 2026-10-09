/**
 * Ed25519 signatures and base64url helpers, shared by the app, the feed and the
 * pack pipeline. Pure: `@noble/ed25519` v2 + `@noble/hashes`, no React Native
 * and no Node-only modules, so it runs in Hermes and Node.
 */
import * as ed from '@noble/ed25519';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { bytesToHex } from '@noble/hashes/utils';
import { canonicalize } from './canonicalJson.ts';

// Set the sync SHA-512 backend once so the synchronous APIs work in Hermes.
ed.etc.sha512Sync = (...messages: Uint8Array[]): Uint8Array =>
  sha512(ed.etc.concatBytes(...messages));

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Value of one base64url character, or -1 when it is not in the alphabet. */
function b64Value(code: number): number {
  if (code >= 65 && code <= 90) return code - 65; // A-Z
  if (code >= 97 && code <= 122) return code - 97 + 26; // a-z
  if (code >= 48 && code <= 57) return code - 48 + 52; // 0-9
  if (code === 45) return 62; // -
  if (code === 95) return 63; // _
  return -1;
}

const B64_RE = /^[A-Za-z0-9_-]*$/;

/** Encodes bytes as base64url without padding. */
export function base64urlEncode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out +=
      B64_ALPHABET[(n >> 18) & 63]! +
      B64_ALPHABET[(n >> 12) & 63]! +
      B64_ALPHABET[(n >> 6) & 63]! +
      B64_ALPHABET[n & 63]!;
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = (bytes[i] ?? 0) << 16;
    out += B64_ALPHABET[(n >> 18) & 63]! + B64_ALPHABET[(n >> 12) & 63]!;
  } else if (rem === 2) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8);
    out +=
      B64_ALPHABET[(n >> 18) & 63]! +
      B64_ALPHABET[(n >> 12) & 63]! +
      B64_ALPHABET[(n >> 6) & 63]!;
  }
  return out;
}

/** Decodes base64url without padding. Returns null on bad input; never throws. */
export function base64urlDecode(text: string): Uint8Array | null {
  if (typeof text !== 'string' || !B64_RE.test(text) || text.length % 4 === 1) return null;
  const out = new Uint8Array((text.length * 3) >> 2);
  let o = 0;
  const groups = Math.ceil(text.length / 4);
  for (let g = 0; g < groups; g++) {
    const i = g * 4;
    const n = Math.min(4, text.length - i);
    const v0 = b64Value(text.charCodeAt(i));
    const v1 = n > 1 ? b64Value(text.charCodeAt(i + 1)) : 0;
    const v2 = n > 2 ? b64Value(text.charCodeAt(i + 2)) : 0;
    const v3 = n > 3 ? b64Value(text.charCodeAt(i + 3)) : 0;
    if (v0 < 0 || v1 < 0 || v2 < 0 || v3 < 0) return null;
    if (n >= 2) out[o++] = (v0 << 2) | (v1 >> 4);
    if (n >= 3) out[o++] = ((v1 & 15) << 4) | (v2 >> 2);
    if (n === 4) out[o++] = ((v2 & 3) << 6) | v3;
  }
  return out;
}

/** Encodes a string as UTF-8 bytes (lone surrogates become U+FFFD). */
export function utf8(text: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      } else {
        code = 0xfffd;
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      code = 0xfffd;
    }
    if (code < 0x80) {
      out.push(code);
    } else if (code < 0x800) {
      out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return Uint8Array.from(out);
}

/** Verifies an Ed25519 signature over raw message bytes. Returns false, never throws. */
export function verifyEd25519(
  publicKeyB64url: string,
  message: Uint8Array,
  sigB64url: string,
): boolean {
  try {
    const publicKey = base64urlDecode(publicKeyB64url);
    const signature = base64urlDecode(sigB64url);
    if (publicKey === null || signature === null) return false;
    if (publicKey.length !== 32 || signature.length !== 64) return false;
    return ed.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

/** Signs raw message bytes, returning a base64url signature. */
export function signEd25519(privateKeyB64url: string, message: Uint8Array): string {
  const privateKey = base64urlDecode(privateKeyB64url);
  if (privateKey === null || privateKey.length !== 32) {
    throw new Error('Invalid Ed25519 private key');
  }
  return base64urlEncode(ed.sign(message, privateKey));
}

/** Generates a raw 32-byte Ed25519 key pair as base64url strings. */
export function generateKeyPair(): { privateKey: string; publicKey: string } {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);
  return { privateKey: base64urlEncode(privateKey), publicKey: base64urlEncode(publicKey) };
}

/** Strips the top-level `signature` member so the object is in its signed form. */
function withoutSignature(obj: object): Record<string, unknown> {
  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'signature') continue;
    clone[key] = value;
  }
  return clone;
}

/** The exact bytes signed by a manifest: UTF-8 of RFC 8785 canonical JSON without `signature`. */
export function signedBytes(obj: object): Uint8Array {
  return utf8(canonicalize(withoutSignature(obj)));
}

/** Lowercase hex SHA-256 of some bytes. */
export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}
