import { describe, expect, it } from 'vitest';

import { accountStrings } from './account';
import { askStrings } from './ask';
import { commonStrings } from './common';
import type { ErrorSource } from './errors';
import { errorMessage, errorStrings, genericMessage, SILENT } from './errors';
import { fill } from './format';
import { guideStrings, guideTopicLabels } from './guide';
import { homeStrings } from './home';
import { hotlineStrings } from './hotlines';
import { profileStrings } from './profile';

interface StringTable {
  tl: Record<string, string>;
  en: Record<string, string>;
}

const table = (name: string, value: unknown): readonly [string, StringTable] => [
  name,
  value as StringTable,
];

const TABLES: ReadonlyArray<readonly [string, StringTable]> = [
  table('commonStrings', commonStrings),
  table('errorStrings', errorStrings),
  table('accountStrings', accountStrings),
  table('askStrings', askStrings),
  table('guideStrings', guideStrings),
  table('guideTopicLabels', guideTopicLabels),
  table('homeStrings', homeStrings),
  table('hotlineStrings', hotlineStrings),
  table('profileStrings', profileStrings),
];

const ENTRIES: Array<readonly [string, string, string, string]> = [];
for (const [name, strings] of TABLES) {
  for (const lang of ['tl', 'en'] as const) {
    for (const [key, value] of Object.entries(strings[lang])) {
      ENTRIES.push([name, lang, key, value]);
    }
  }
}

describe('string tables: shape and safety', () => {
  it.each(TABLES)('%s: tl and en have identical key sets', (_name, strings) => {
    expect(Object.keys(strings.tl).sort()).toEqual(Object.keys(strings.en).sort());
  });

  it.each(ENTRIES)('%s %s.%s has no empty value', (_table, _lang, _key, value) => {
    expect(value).not.toBe('');
    expect(value.trim().length).toBeGreaterThan(0);
  });

  it.each(ENTRIES)('%s %s.%s has no digit', (_table, _lang, _key, value) => {
    expect(value).not.toMatch(/[0-9]/);
  });
});

const REQUIRED: Record<ErrorSource, string[]> = {
  init: ['content_invalid', 'storage_failed'],
  ai: ['low_battery', 'battery_saver', 'ai_off', 'tier', 'no_model'],
  model_state: ['loading', 'generating', 'error'],
  verifier: ['schema', 'not_in_guide', 'bad_citation', 'unknown_number', 'phone_number', 'too_long', 'wrong_language'],
  validation: ['name_required', 'too_long', 'pets_range', 'phone_invalid', 'too_many_members', 'owner_relation', 'too_many_contacts', 'contact_phone_invalid'],
  photo: ['permission_denied', 'no_camera', 'unreadable', 'draft_expired', 'io'],
  face_detection: ['no_face', 'many_faces', 'unavailable', 'confirm'],
  location: ['permission_denied', 'services_off', 'unavailable', 'unknown_place'],
  undo: [],
  checklist: [],
  settings: ['out_of_range'],
  family: ['owner_required'],
  plan: ['no_dialer'],
  profiles_remove: [],
  share: ['failed'],
  feed: ['empty', 'disabled', 'offline', 'http', 'unknown_key', 'bad_signature', 'key_expired', 'app_too_old'],
  updates: ['offline', 'http', 'not_allowed', 'unknown_key', 'bad_signature', 'key_expired', 'app_too_old', 'hash_mismatch', 'schema', 'failed'],
  packs: ['bad_archive', 'unknown_key', 'bad_signature', 'key_expired', 'app_too_old', 'rollback', 'hash_mismatch', 'schema', 'io', 'nothing_to_roll_back'],
  model_install: ['tier', 'no_space', 'wrong_file', 'hash_mismatch', 'io', 'failed'],
  account: ['demo_only', 'invalid_email', 'weak_password', 'offline', 'http'],
  damage: ['io', 'invalid', 'too_many_photos', 'not_opted_in', 'offline', 'http'],
};

const REQUIRED_ENTRIES: ReadonlyArray<readonly [ErrorSource, string]> = (
  Object.entries(REQUIRED) as Array<[ErrorSource, string[]]>
).flatMap(([source, codes]) => codes.map((code) => [source, code] as const));

const SILENT_KEYS: string[] = [
  'model_state.absent',
  'model_state.unloaded',
  'model_state.ready',
  'face_detection.one_face',
  'undo.nothing_to_undo',
  'checklist.unknown_item',
  'share.cancelled',
  'feed.off',
  'feed.rollback',
  'updates.cancelled',
  'model_install.cancelled',
  'account.not_signed_in',
];

describe('errorMessage', () => {
  it('exposes the generic message in both languages', () => {
    expect(genericMessage('tl')).toBe(errorStrings.tl.generic);
    expect(genericMessage('en')).toBe(errorStrings.en.generic);
  });

  it.each(REQUIRED_ENTRIES)('%s.%s has a non-generic tl and en message', (source, code) => {
    expect(errorMessage('tl', source, code)).not.toBeNull();
    expect(errorMessage('tl', source, code)).not.toBe(errorStrings.tl.generic);
    expect(errorMessage('en', source, code)).not.toBeNull();
    expect(errorMessage('en', source, code)).not.toBe(errorStrings.en.generic);
  });

  it.each(SILENT_KEYS)('%s returns null', (key) => {
    const [source, code] = key.split('.');
    expect(errorMessage('tl', source as ErrorSource, code ?? '')).toBeNull();
    expect(errorMessage('en', source as ErrorSource, code ?? '')).toBeNull();
  });

  it.each([
    ['feed', 'hash_mismatch'],
    ['plan', 'not_found'],
    ['photo', 'zzz'],
  ] as ReadonlyArray<readonly [ErrorSource, string]>)(
    'returns the generic message for %s.%s',
    (source, code) => {
      expect(errorMessage('tl', source, code)).toBe(errorStrings.tl.generic);
      expect(errorMessage('en', source, code)).toBe(errorStrings.en.generic);
    },
  );

  it('the exported SILENT set matches the required silent keys', () => {
    expect([...SILENT].sort()).toEqual([...SILENT_KEYS].sort());
  });

  it('en differs from tl for the fatal init message', () => {
    expect(errorStrings.en['init.content_invalid']).not.toBe(errorStrings.tl['init.content_invalid']);
  });
});

const TOPIC_GROUPS = [
  'signals', 'go_bag', 'home_prep', 'evacuation', 'flood', 'surge', 'landslide',
  'infant', 'senior', 'pregnancy', 'disability', 'pets', 'water_food', 'electrical',
  'generator_fire', 'gas_safety', 'cleanup', 'health_after_flood', 'first_aid',
  'psychosocial', 'damage_report', 'assistance', 'out_of_guide',
] as const;

describe('guideTopicLabels', () => {
  it.each(TOPIC_GROUPS)('covers topic %s', (topic) => {
    expect(guideTopicLabels.tl[topic]).toBeTruthy();
    expect(guideTopicLabels.en[topic]).toBeTruthy();
  });
});

describe('fill', () => {
  it('replaces known placeholders', () => {
    expect(fill('Kulang pa ang litrato ni {name}.', { name: 'Ana' })).toBe('Kulang pa ang litrato ni Ana.');
  });

  it('keeps unknown placeholders', () => {
    expect(fill('{known} at {unknown}', { known: 'isa' })).toBe('isa at {unknown}');
  });
});

