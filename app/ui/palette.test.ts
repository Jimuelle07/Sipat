import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { palette } from './theme/palette';
import paletteJson from '../../assets/color-palette/palette.json';

const UI_DIR = dirname(fileURLToPath(import.meta.url));

const HEX_IN_STRING = /['"`]#[0-9a-fA-F]{3,8}['"`]/;
const COLOR_FUNCTION = /\b(?:rgba?|hsla?)\s*\(/;

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (
      (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.test.tsx')
    ) {
      files.push(full);
    }
  }
  return files;
}

function findColorLiterals(file: string): string[] {
  const offenses: string[] = [];
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (HEX_IN_STRING.test(line) || COLOR_FUNCTION.test(line)) {
      offenses.push(`${relative(UI_DIR, file)}:${index + 1}: ${line.trim()}`);
    }
  });
  return offenses;
}

describe('app/ui palette traceability', () => {
  it('has no hex, rgb, rgba, hsl or hsla literals in app/ui source', () => {
    const sourceFiles = listSourceFiles(UI_DIR);
    const offenses = sourceFiles.flatMap(findColorLiterals);
    expect(
      offenses,
      `Raw color literals must trace to palette.json via the theme. Offenders:\n${offenses.join('\n')}`,
    ).toEqual([]);
  });

  it('theme/palette.ts imports the palette JSON as the single source', () => {
    const source = readFileSync(join(UI_DIR, 'theme', 'palette.ts'), 'utf8');
    expect(source).toContain('assets/color-palette/palette.json');
  });

  it('the exported palette deep-equals palette.json', () => {
    expect(palette).toEqual(paletteJson);
  });
});
