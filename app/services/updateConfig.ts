/**
 * Reads the one pinned update host from `app.config.ts` (`extra.updateHost`).
 * Returns null in Node (no expo-constants module), when the value is unset or still a
 * placeholder, or when it is not an `https://` origin, so every online call stays `disabled`.
 */
export function updateHost(): string | null {
  let value: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants') as {
      default?: { expoConfig?: { extra?: Record<string, unknown> } };
      expoConfig?: { extra?: Record<string, unknown> };
    };
    const config = Constants?.default?.expoConfig ?? Constants?.expoConfig;
    value = config?.extra?.updateHost;
  } catch {
    return null;
  }

  if (typeof value !== 'string') return null;
  const host = value.trim();
  if (host.length === 0) return null;
  if (host.includes('(fill in)')) return null;
  if (!host.startsWith('https://')) return null;

  let origin: string;
  try {
    origin = new URL(host).origin;
  } catch {
    return null;
  }
  return origin;
}
