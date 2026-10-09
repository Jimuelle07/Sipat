import { describe, expect, it } from 'vitest';
import { canonicalize } from './canonicalJson.ts';
import { PINNED_ROOT_KEYS } from './pinnedKeys.ts';
import {
  base64urlDecode,
  base64urlEncode,
  generateKeyPair,
  sha256Hex,
  signEd25519,
  signedBytes,
  utf8,
  verifyEd25519,
} from './signature.ts';

describe('canonicalize (RFC 8785)', () => {
  it('sorts object keys by UTF-16 code units, recursively', () => {
    const value = { b: 1, a: { d: 4, c: [3, { f: 6, e: 5 }] }, '10': 'ten', '2': 'two' };
    expect(canonicalize(value)).toBe(
      '{"10":"ten","2":"two","a":{"c":[3,{"e":5,"f":6}],"d":4},"b":1}',
    );
  });

  it('omits undefined members and rejects non-finite numbers', () => {
    expect(canonicalize({ a: 1, b: undefined, c: null })).toBe('{"a":1,"c":null}');
    expect(() => canonicalize({ a: Number.NaN })).toThrow();
    expect(() => canonicalize({ a: Number.POSITIVE_INFINITY })).toThrow();
  });

  it('serializes numbers and strings the way ECMAScript does', () => {
    expect(canonicalize({ n: 1e21, m: -0, s: 'a"b\\c\n' })).toBe(
      '{"m":0,"n":1e+21,"s":"a\\"b\\\\c\\n"}',
    );
  });
});

describe('Ed25519 signing', () => {
  const { privateKey, publicKey } = generateKeyPair();

  it('base64url round-trips bytes without padding', () => {
    const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    const encoded = base64urlEncode(bytes);
    expect(encoded).not.toContain('=');
    const decoded = base64urlDecode(encoded);
    expect(decoded).not.toBeNull();
    expect(Array.from(decoded ?? [])).toEqual(Array.from(bytes));
  });

  it('signs and verifies a message', () => {
    const message = utf8('SAMPLE - hindi totoong bulletin ñ');
    const sig = signEd25519(privateKey, message);
    expect(verifyEd25519(publicKey, message, sig)).toBe(true);
  });

  it('fails on a tampered message and on a wrong key', () => {
    const message = utf8('hello');
    const sig = signEd25519(privateKey, message);
    expect(verifyEd25519(publicKey, utf8('hello!'), sig)).toBe(false);

    const other = generateKeyPair();
    expect(verifyEd25519(other.publicKey, message, sig)).toBe(false);
  });

  it('returns false, never throws, for bad base64url input', () => {
    const message = utf8('hello');
    expect(verifyEd25519('not base64 !!', message, 'also bad')).toBe(false);
    expect(verifyEd25519(publicKey, message, 'AAAA')).toBe(false);
    expect(base64urlDecode('****')).toBeNull();
    expect(base64urlDecode('AAAAA')).toBeNull();
  });

  it('signedBytes ignores the top-level signature member', () => {
    const a = {
      schema_version: 1,
      manifest_id: 'feed',
      signature: { kid: 'x', alg: 'Ed25519', sig: 'a' },
    };
    const b = {
      schema_version: 1,
      manifest_id: 'feed',
      signature: { kid: 'y', alg: 'Ed25519', sig: 'b' },
    };
    expect(Array.from(signedBytes(a))).toEqual(Array.from(signedBytes(b)));
    expect(new TextDecoder().decode(signedBytes(a))).toBe(
      '{"manifest_id":"feed","schema_version":1}',
    );
  });

  it('hashes to the known SHA-256 digest', () => {
    expect(sha256Hex(utf8('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('pinned keys', () => {
  it('starts empty until the real root key exists', () => {
    expect(PINNED_ROOT_KEYS).toEqual([]);
  });
});
