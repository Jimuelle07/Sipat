import { describe, expect, it } from 'vitest';
import type { IntentsFile, SynonymEntry } from '../types';
import intents from '../../content/intents.json';
import synonymsFile from '../../content/synonyms.json';
import { normalize } from './normalize';
import { route } from './route';

// JSON imports widen literal types; shape is checked by validateContent.
const intentsFile: IntentsFile = intents as unknown as IntentsFile;
const synonymsData: { items: SynonymEntry[] } = synonymsFile as unknown as { items: SynonymEntry[] };
const rules = intentsFile.rules;
const synonyms = synonymsData.items;
const r = (q: string) => route(normalize(q, synonyms), rules);

describe('route', () => {
  it('emergency is independent of primary', () => {
    const res = r('Lumulubog na ang bahay namin!');
    expect(res.emergency).toBe(true);
    expect(res.primary).toBe('guide');
    expect(res.matched.length).toBeGreaterThan(0);
  });
  it('live data', () => {
    expect(r('Nasaan na ang bagyo?').primary).toBe('live_data');
    expect(r('May pasok ba bukas?').primary).toBe('live_data');
  });
  it('medical dose', () => {
    expect(r('Ilang tableta ng paracetamol?').primary).toBe('medical_dose');
  });
  it('plan with field', () => {
    const res = r('Saan kami magkikita?');
    expect(res.primary).toBe('plan');
    expect(res.planField).toBe('meeting_place');
  });
  it('guide fallback', () => {
    const res = r('Ano ang dapat sa go bag?');
    expect(res.primary).toBe('guide');
    expect(res.emergency).toBe(false);
    expect(res.planField).toBeUndefined();
  });
  it('matches on word boundaries only', () => {
    const custom = {
      ...rules,
      emergency: { ...rules.emergency, phrases: ['baha'] },
      live_data: { ...rules.live_data, phrases: [] },
      medical_dose: { ...rules.medical_dose, phrases: [] },
      plan: { evacuation_center: [], meeting_place: [], contacts: [], hotlines: [] },
    };
    expect(route(normalize('bahala na', []), custom).emergency).toBe(false);
    expect(route(normalize('may baha dito', []), custom)).toEqual({ emergency: true, primary: 'guide', matched: ['baha'] });
  });
});
