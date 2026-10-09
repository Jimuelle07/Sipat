import { describe, expect, it } from 'vitest';
import type { IntentRules, PhaseCueList, SynonymEntry } from '../types/index.ts';
import intents from '../../content/intents.json';
import synonymsFile from '../../content/synonyms.json';
import { normalize } from './normalize.ts';
import { route } from './route.ts';

// JSON imports widen literal types; shape is checked by validateContent.
const intentsData = intents as unknown as { rules: IntentRules };
const synonymsData = synonymsFile as unknown as { items: SynonymEntry[] };
const rules = intentsData.rules;
const synonyms = synonymsData.items;
const r = (q: string) => route(normalize(q, synonyms), rules);

const EMPTY_CUE: PhaseCueList = { strong: [], weak: [] };

describe('route', () => {
  it('emergency is independent of primary', () => {
    const res = r('Lumulubog na ang bahay namin!');
    expect(res.emergency).toBe(true);
    expect(res.primary).toBe('guide');
    expect(res.matched.length).toBeGreaterThan(0);
    expect(res.phaseCue).toBeNull();
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
    expect(res.phaseCue).toBeNull();
  });
  it('matches on word boundaries only', () => {
    const custom: IntentRules = {
      ...rules,
      emergency: { ...rules.emergency, phrases: ['baha'] },
      live_data: { ...rules.live_data, phrases: [] },
      medical_dose: { ...rules.medical_dose, phrases: [] },
      plan: { evacuation_center: [], meeting_place: [], contacts: [], hotlines: [] },
      phase_cues: { before: EMPTY_CUE, during: EMPTY_CUE, after: EMPTY_CUE },
    };
    expect(route(normalize('bahala na', []), custom).emergency).toBe(false);
    expect(route(normalize('may baha dito', []), custom))
      .toEqual({ emergency: true, phaseCue: null, primary: 'guide', matched: ['baha'] });
  });
});

describe('route phase cues', () => {
  const cueRules = (cues: Record<'before' | 'during' | 'after', PhaseCueList>): IntentRules => ({
    emergency: { phrases: [], card_id: 'card' },
    live_data: { phrases: [], reply_key: 'no_live_data' },
    medical_dose: { phrases: [], reply_key: 'medical_dose' },
    plan: { evacuation_center: [], meeting_place: [], contacts: [], hotlines: [] },
    phase_cues: cues,
    emergency_cards: [],
  });

  it('a strong during cue combines with the guide route', () => {
    const res = route(normalize('Nandito na ang bagyo', []), cueRules({
      before: EMPTY_CUE, during: { strong: ['nandito na ang bagyo'], weak: [] }, after: EMPTY_CUE,
    }));
    expect(res.primary).toBe('guide');
    expect(res.phaseCue).toEqual({ phase: 'during', strong: true, matched: ['nandito na ang bagyo'] });
  });

  it('a weak cue is reported as not strong', () => {
    const res = route(normalize('Tumataas na ang tubig', []), cueRules({
      before: EMPTY_CUE, during: { strong: [], weak: ['tumataas na ang tubig'] }, after: EMPTY_CUE,
    }));
    expect(res.phaseCue).toEqual({ phase: 'during', strong: false, matched: ['tumataas na ang tubig'] });
  });

  it('# matches any one number token', () => {
    const res = route(normalize('Signal 3 na dito', []), cueRules({
      before: EMPTY_CUE, during: { strong: ['signal # na dito'], weak: [] }, after: EMPTY_CUE,
    }));
    expect(res.phaseCue).toEqual({ phase: 'during', strong: true, matched: ['signal # na dito'] });
  });

  it('the most cautious matched phase wins', () => {
    const res = route(normalize('Humupa na pero nandito na ang bagyo', []), cueRules({
      before: EMPTY_CUE,
      during: { strong: ['nandito na ang bagyo'], weak: [] },
      after: { strong: ['humupa na'], weak: [] },
    }));
    expect(res.phaseCue?.phase).toBe('during');
  });

  it('no cue when nothing matches', () => {
    const res = route(normalize('Ano ang go bag', []), cueRules({
      before: { strong: ['may paparating na bagyo'], weak: [] }, during: EMPTY_CUE, after: EMPTY_CUE,
    }));
    expect(res.phaseCue).toBeNull();
  });
});
