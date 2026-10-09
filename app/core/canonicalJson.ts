/**
 * RFC 8785 JSON Canonicalization Scheme (JCS).
 * https://www.rfc-editor.org/rfc/rfc8785
 *
 * Pure: no React Native and no Node-only modules, so it runs in Hermes and Node.
 * Object keys are sorted by UTF-16 code units, numbers use the ECMAScript
 * serialization (`String`), strings go through `JSON.stringify`, `undefined`
 * object members are omitted and non-finite numbers throw.
 */

function quote(text: string): string {
  return JSON.stringify(text) as string;
}

/** Values JSON cannot represent: omitted from objects, serialized as null in arrays. */
function isOmittable(value: unknown): boolean {
  return value === undefined || typeof value === 'function' || typeof value === 'symbol';
}

function serializeArray(values: readonly unknown[]): string {
  const parts: string[] = [];
  for (const value of values) {
    parts.push(isOmittable(value) ? 'null' : serialize(value));
  }
  return `[${parts.join(',')}]`;
}

function serializeObject(value: Record<string, unknown>): string {
  const keys = Object.keys(value).filter((key) => !isOmittable(value[key]));
  keys.sort();
  const parts: string[] = [];
  for (const key of keys) {
    parts.push(`${quote(key)}:${serialize(value[key])}`);
  }
  return `{${parts.join(',')}}`;
}

function serialize(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError('Cannot canonicalize a non-finite number');
      return String(value);
    case 'string':
      return quote(value);
    case 'bigint':
      throw new TypeError('Cannot canonicalize a bigint');
    case 'object':
      return Array.isArray(value)
        ? serializeArray(value)
        : serializeObject(value as Record<string, unknown>);
    default:
      // undefined, function or symbol at the top level or as an array element.
      return 'null';
  }
}

/** Serializes a JSON value to its RFC 8785 canonical form. */
export function canonicalize(value: unknown): string {
  return serialize(value);
}
