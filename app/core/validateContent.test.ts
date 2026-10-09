import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ContentFileName } from '../types/index.ts';
import { REQUIRED_CONTENT_FILES, validateContent } from './validateContent.ts';

const env = (items: unknown[]) => ({ schema_version: 1, content_version: 1, generated_at: '2026-10-09', items });

const phaseRules = (rules: Record<string, unknown>) => ({
  schema_version: 1, content_version: 1, generated_at: '2026-10-09', rules,
});

const placeholderRules = () => phaseRules({
  warning_to_phase: { any_active_warning: 'during', basis: 'product_rule' },
  bands: {
    near: { max_km: null, placeholder: true, source_id: null, reviewed_by: null, reviewed_at: null },
    approach: { max_km: null, placeholder: true, source_id: null, reviewed_by: null, reviewed_at: null },
  },
  evacuation_threshold: {
    category_min: null, tcws_min: null,
    placeholder: true, source_id: null, reviewed_by: null, reviewed_at: null,
  },
});

const places = (items: unknown[], centroidsSourceId: string | null = null) => ({
  schema_version: 1, content_version: 1, generated_at: '2026-10-09',
  items, names_source_id: 'src', centroids_source_id: centroidsSourceId,
});

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
        plan: {
          evacuation_center: [],
          meeting_place: [],
          contacts: [],
          hotlines: [],
        },
        phase_cues: {
          before: { strong: [], weak: [] },
          during: { strong: ['nandito na'], weak: [] },
          after: { strong: [], weak: [] },
        },
        emergency_cards: [{ id: 'card1', title: 'T', steps: ['a'], hotline_ids: ['h911'], source_id: 'src' }],
      },
    },
    'phase_rules.json': placeholderRules(),
    'places.json': places([
      { psgc: 'R1', name: 'Region', level: 'region', parent: null },
      { psgc: 'P1', name: 'Province', level: 'province', parent: 'R1' },
      { psgc: 'M1', name: 'Municipality', level: 'municipality', parent: 'P1' },
      { psgc: 'B1', name: 'Barangay', level: 'barangay', parent: 'M1' },
    ]),
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

  it('requires phase_cues for all three phases', () => {
    expect(validateContent(fixture()).ok).toBe(true);
    const f = fixture();
    delete f['intents.json'].rules.phase_cues;
    expect(errorOf(f)).toContain('phase_cues must be an object');
    const g = fixture();
    delete g['intents.json'].rules.phase_cues.after;
    expect(errorOf(g)).toContain('phase_cues.after');
    const h = fixture();
    h['intents.json'].rules.phase_cues.during = { strong: 'nope', weak: [] };
    expect(errorOf(h)).toContain('phase_cues.during');
  });

  it('accepts the shipped placeholder phase rules', () => {
    expect(validateContent(fixture()).ok).toBe(true);
  });

  it('requires rules.emergency with phrases and a card_id that matches a card', () => {
    const f = fixture();
    delete f['intents.json'].rules.emergency;
    expect(errorOf(f)).toContain('rules.emergency must be an object');
    const g = fixture();
    g['intents.json'].rules.emergency.phrases = 'nope';
    expect(errorOf(g)).toContain('rules.emergency.phrases must be a string array');
    const h = fixture();
    h['intents.json'].rules.emergency.card_id = '';
    expect(errorOf(h)).toContain('rules.emergency.card_id');
    const i = fixture();
    i['intents.json'].rules.emergency.card_id = 'ghost';
    expect(errorOf(i)).toContain('rules.emergency.card_id ghost has no matching card');
  });

  it('requires live_data and medical_dose phrase lists and reply keys', () => {
    const f = fixture();
    delete f['intents.json'].rules.live_data;
    expect(errorOf(f)).toContain('rules.live_data must be an object');
    const g = fixture();
    g['intents.json'].rules.live_data.reply_key = 'other';
    expect(errorOf(g)).toContain("rules.live_data.reply_key must be 'no_live_data'");
    const h = fixture();
    h['intents.json'].rules.medical_dose.phrases = [1, 2];
    expect(errorOf(h)).toContain('rules.medical_dose.phrases must be a string array');
    const i = fixture();
    i['intents.json'].rules.medical_dose.reply_key = '';
    expect(errorOf(i)).toContain("rules.medical_dose.reply_key must be 'medical_dose'");
  });

  it('requires rules.plan string arrays for every field', () => {
    const f = fixture();
    delete f['intents.json'].rules.plan;
    expect(errorOf(f)).toContain('rules.plan must be an object');
    const g = fixture();
    delete g['intents.json'].rules.plan.contacts;
    expect(errorOf(g)).toContain('rules.plan.contacts must be a string array');
    const h = fixture();
    h['intents.json'].rules.plan.hotlines = ['ok', 5];
    expect(errorOf(h)).toContain('rules.plan.hotlines must be a string array');
  });

  it('rejects a sourced band with no value, source or reviewer', () => {
    const f = fixture();
    f['phase_rules.json'].rules.bands.near.placeholder = false;
    expect(errorOf(f)).toContain('near');
  });

  it('rejects a placeholder rule carrying a value', () => {
    const f = fixture();
    f['phase_rules.json'].rules.bands.near.max_km = 50;
    expect(errorOf(f)).toContain('placeholder rule must have max_km null');
  });

  it('rejects approach.max_km not larger than near.max_km when both sourced', () => {
    const f = fixture();
    const sourced = (max_km: number) => ({ max_km, placeholder: false, source_id: 'src', reviewed_by: 'R', reviewed_at: '2026-10-01' });
    f['phase_rules.json'].rules.bands.near = sourced(100);
    f['phase_rules.json'].rules.bands.approach = sourced(100);
    expect(errorOf(f)).toContain('approach.max_km must be larger than near.max_km');
    f['phase_rules.json'].rules.bands.approach = sourced(200);
    expect(validateContent(f).ok).toBe(true);
  });

  it('rejects a sourced evacuation_threshold with no category or signal', () => {
    const f = fixture();
    f['phase_rules.json'].rules.evacuation_threshold = {
      category_min: null, tcws_min: null, placeholder: false, source_id: 'src', reviewed_by: 'R', reviewed_at: '2026-10-01',
    };
    expect(errorOf(f)).toContain('evacuation_threshold');
  });

  it('rejects a places parent that does not exist', () => {
    const f = fixture();
    f['places.json'].items[2].parent = 'NOPE';
    expect(errorOf(f)).toContain('parent NOPE not found');
  });

  it('rejects a barangay with no parent', () => {
    const f = fixture();
    f['places.json'].items[3].parent = null;
    expect(errorOf(f)).toContain('missing parent');
  });

  it('rejects an invalid place level and a malformed centroid', () => {
    const f = fixture();
    f['places.json'].items[0].level = 'district';
    expect(errorOf(f)).toContain('level must be one of');
    const g = fixture();
    g['places.json'].items[0].centroid = { lat: 'x', lon: 2 };
    expect(errorOf(g)).toContain('centroid');
  });

  it('rejects duplicate place psgc codes', () => {
    const f = fixture();
    f['places.json'].items[1].psgc = 'R1';
    expect(errorOf(f)).toContain('duplicate psgc R1');
  });

  it('rejects a region carrying a parent', () => {
    const f = fixture();
    f['places.json'].items[0].parent = 'R1';
    expect(errorOf(f)).toContain("region's parent must be null");
  });

  it('requires a centroid on barangays only when centroids_source_id is set', () => {
    const f = fixture();
    f['places.json'].centroids_source_id = 'src-ocha';
    expect(errorOf(f)).toContain('barangays need a centroid');
    const g = fixture();
    g['places.json'].items[3].centroid = { lat: 14, lon: 122 };
    g['places.json'].centroids_source_id = 'src-ocha';
    expect(validateContent(g).ok).toBe(true);
  });

  it('requires a reviewer and real coords on evacuation centers when present', () => {
    const f = fixture();
    f['evacuation_centers.json'] = env([
      { id: 'center1', name: 'C', psgc: 'B1', coords: { lat: 14, lon: 122 }, origin: 'scraped', source_id: 'src', reviewed_by: '', reviewed_at: '2026-10-01', updated_at: '2026-10-01' },
    ]);
    expect(errorOf(f)).toContain('center1');
    expect(errorOf(f)).toContain('reviewed_by');
    const g = fixture();
    g['evacuation_centers.json'] = env([
      { id: 'center1', name: 'C', psgc: 'B1', coords: { lat: 0, lon: 0 }, origin: 'scraped', source_id: 'src', reviewed_by: 'R', reviewed_at: '2026-10-01', updated_at: '2026-10-01' },
    ]);
    expect(errorOf(g)).toContain('0, 0');
  });

  it('reports phase_rules.json and places.json as missing when absent', () => {
    const f = fixture();
    delete f['phase_rules.json'];
    delete f['places.json'];
    const msg = errorOf(f);
    expect(msg).toContain('phase_rules.json: missing');
    expect(msg).toContain('places.json: missing');
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
