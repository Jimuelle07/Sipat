import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ContentFileName } from '../app/types/index.ts';
import { REQUIRED_CONTENT_FILES, validateContent } from '../app/core/validateContent.ts';

const contentDir = fileURLToPath(new URL('../content/', import.meta.url));
const raw: Partial<Record<ContentFileName, unknown>> = {};
let readFailed = false;

for (const file of REQUIRED_CONTENT_FILES) {
  const path = contentDir + file;
  if (!existsSync(path)) continue; // reported as missing by validateContent
  try {
    raw[file] = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`${file}: invalid JSON: ${(e as Error).message}`);
    readFailed = true;
  }
}

const result = validateContent(raw);
if (!result.ok) {
  for (const problem of result.error.message.split('; ')) console.error(problem);
  process.exit(1);
}
if (readFailed) process.exit(1);

const c = result.value;
console.log(`guide.tl.json: ${c.passages.length} passages`);
console.log(`checklist.json: ${c.checklist.length} items`);
console.log(`warnings.json: ${c.warnings.length} entries`);
console.log(`synonyms.json: ${c.synonyms.length} entries`);
console.log(`intents.json: ${c.rules.emergency_cards.length} emergency cards`);
console.log(`sources.json: ${c.sources.length} sources`);
console.log(`hotlines.json: ${c.hotlines.length} hotlines`);
console.log('Content OK');
