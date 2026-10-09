/**
 * Fills `{key}` placeholders in a copy template. Unknown placeholders are left
 * untouched so a missing variable is visible instead of silently blank.
 */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{([^{}]+)\}/g, (match, key: string) => {
    const value = vars[key];
    return value === undefined ? match : String(value);
  });
}
