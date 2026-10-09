import type { ContentFileName } from '../types/index.ts';
import { validateContent } from '../core/validateContent.ts';
import type { BundledContent } from '../core/validateContent.ts';
import guide from '../../content/guide.tl.json';
import checklist from '../../content/checklist.json';
import warnings from '../../content/warnings.json';
import synonyms from '../../content/synonyms.json';
import intents from '../../content/intents.json';
import sources from '../../content/sources.json';
import hotlines from '../../content/hotlines.json';

export const rawContent: Partial<Record<ContentFileName, unknown>> = {
  'guide.tl.json': guide,
  'checklist.json': checklist,
  'warnings.json': warnings,
  'synonyms.json': synonyms,
  'intents.json': intents,
  'sources.json': sources,
  'hotlines.json': hotlines,
};

const result = validateContent(rawContent);
if (!result.ok) throw new Error(`Bundled content is invalid: ${result.error.message}`);

export const bundledContent: BundledContent = result.value;
