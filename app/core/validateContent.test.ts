import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ContentFileName } from '../types/index.ts';
import { REQUIRED_CONTENT_FILES, validateContent } from './validateContent.ts';

const env = (items: unknown[]) => ({ schema_version: 1, content_version: 1, generated_at: '2026-10-09', items });

function fixture(): Record<string, any> {
  return {
    'sources.json': env([{ id: 'src', agency: 'PAGASA', title: 't', date: 'undated', url: 'https://x', retrieved_at: '2026-10-09' }]),
    'guide.tl.json': env([
      {
        id: 'p1', lang: 'tl', title: 't', topic: 'signals', phase: ['before'],
        warnings: { tcws: [], rainfall: [], surge: [], gale: false, barangay_order: false }, profile_tags: [], hazards: [],
        critical: false, text: 'x', summary: 's', source_id: 'src', locator: 'p1',
        reviewed_by: 'Reviewer', reviewed_at: '2026-10-01', version: 1,
      },
    ]),
    'checklist.json': env([
      { id: 'c1', text: 'Tubig', group: 'go_bag', phase: ['before'], priority: 1, critical: true, source_id: 'src' },
    ]),
    'warnings.json': env([
      { id: 'gale', kind: 'gale', level: 'on', label: 'Gale', meaning: 'm', actions: [], source_id: 'src', confirmed: true },
    ]),
    'synonyms.json': env([{ canonical: 'bagyo', forms: ['typhoon'], lang: 'tl' }]),
    'hotlines.json': env([{ id: 'h911', name: '911', number: '911', scope: 'national', source_id: 'src', verified_at: '2026-10-09' }]),
    'intents.json': {
      schema_version: 1, content_version: 1, generated_at: '2026-10-09',
      rules: {
        emergency: { phrases: ['tulong'], card_id: 'card1' },
        live_data: { phrases: [], reply_key: 'no_live_data' },
        medical_dose: { phrases: [], reply_key: 'medical_dose' },
        plan: {},
        emergency_cards: [{ id: 'card1', title: 'T', steps: ['a'], hotline_ids: ['h911'], source_id: 'src' }],
      },
    },
  };
}

function errorOf(raw: Record<string, any>): string {
  const r = validateContent(raw);
  expect(r.ok).toBe(false);
  if (r.ok) return '';
  expect(r.error.code).toBe('content_invalid');
  return r.error.message;
}

describe('validateContent', () => {
  it('accepts a valid minimal set', () => {
    const r = validateContent(fixture());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.passages[0]?.id).toBe('p1');
  });

  it('rejects a passage missing reviewed_by, naming the id', () => {
    const f = fixture();
    delete f['guide.tl.json'].items[0].reviewed_by;
    expect(errorOf(f)).toContain('p1');
    expect(errorOf(f)).toContain('reviewed_by');
  });

  it('rejects a passage whose lang is not tl', () => {
    const f = fixture();
    f['guide.tl.json'].items[0].lang = 'en';
    expect(errorOf(f)).toContain("lang must be 'tl'");
  });

  it('rejects an unknown source_id', () => {
    const f = fixture();
    f['warnings.json'].items[0].source_id = 'nope';
    expect(errorOf(f)).toContain('unknown source_id nope');
  });

  it('rejects a hotline number with letters', () => {
    const f = fixture();
    f['hotlines.json'].items[0].number = '91A';
    expect(errorOf(f)).toContain('h911');
  });

  it('rejects an invalid checklist group', () => {
    const f = fixture();
    f['checklist.json'].items[0].group = 'water_food';
    expect(errorOf(f)).toContain('group must be one of');
  });

  it('validates phase_cues when intents.json carries them', () => {
    const f = fixture();
    f['intents.json'].rules.phase_cues = { during: { strong: ['nandito na'], weak: [] } };
    expect(validateContent(f).ok).toBe(true);
    f['intents.json'].rules.phase_cues = { during: { strong: 'nope' } };
    expect(errorOf(f)).toContain('phase_cues.during');
  });

  it('collects every problem and reports missing files', () => {
    const f = fixture();
    delete f['synonyms.json'];
    f['intents.json'].rules.emergency_cards[0].hotline_ids = ['ghost'];
    f['sources.json'].schema_version = 2;
    const msg = errorOf(f);
    expect(msg.split('; ').length).toBeGreaterThanOrEqual(3);
    expect(msg).toContain('synonyms.json: missing');
    expect(msg).toContain('unknown hotline_id ghost');
  });

  const dir = fileURLToPath(new URL('../../content/', import.meta.url));
  const allPresent = REQUIRED_CONTENT_FILES.every((f) => existsSync(dir + f));
  it.skipIf(!allPresent)('bundled content files validate', () => {
    const raw: Partial<Record<ContentFileName, unknown>> = {};
    for (const f of REQUIRED_CONTENT_FILES) raw[f] = JSON.parse(readFileSync(dir + f, 'utf8'));
    const r = validateContent(raw);
    expect(r.ok ? 'ok' : r.error.message).toBe('ok');
  });
});
