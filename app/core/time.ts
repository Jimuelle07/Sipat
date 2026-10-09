const pad = (n: number): string => String(n).padStart(2, '0');

/** `YYYY-MM-DDTHH:mm:ss+08:00` in Asia/Manila (fixed UTC+8, no DST). */
export function toManilaIso(d: Date): string {
  const m = new Date(d.getTime() + 8 * 3_600_000);
  return (
    `${m.getUTCFullYear()}-${pad(m.getUTCMonth() + 1)}-${pad(m.getUTCDate())}` +
    `T${pad(m.getUTCHours())}:${pad(m.getUTCMinutes())}:${pad(m.getUTCSeconds())}+08:00`
  );
}
