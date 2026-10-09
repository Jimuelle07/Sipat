import { describe, expect, it } from 'vitest';
import type { Context, Profile, SearchConfig } from '../types';
import { bundledContent } from '../content';
import { normalize } from './normalize';
import { createIndex, search } from './search';
import { DEFAULT_SEARCH_CONFIG } from './config';

const IN_SCOPE: { question: string; id: string }[] = [
  { question: 'Malapit kami sa ilog, lilikas na ba kami?', id: 'during-flood-river-01' },
  { question: 'Ano ang leptospirosis?', id: 'after-leptospirosis-01' },
  { question: 'Ano ang ilalagay sa go bag?', id: 'before-gobag-01' },
  { question: 'Paano kung may landslide?', id: 'during-landslide-01' },
  { question: 'Ligtas ba gumamit ng generator sa loob ng bahay?', id: 'after-generator-fire-01' },
  { question: 'Ano ang ibig sabihin ng wind signal?', id: 'before-signals-tcws-01' },
  { question: 'Ano ang gagawin kung may storm surge sa tabing-dagat?', id: 'during-surge-01' },
  { question: 'Paano ihanda ang bubong bago ang bagyo?', id: 'before-home-prep-01' },
  { question: 'Paano protektahan ang sanggol at pagpapasuso sa bagyo?', id: 'before-infant-01' },
  { question: 'Ano ang ihahanda para sa senior na may maintenance na gamot?', id: 'before-senior-01' },
  { question: 'Ano ang gagawin sa alagang hayop bago lumikas?', id: 'before-pets-01' },
  { question: 'Ano ang gagawin sa kuryente at basang saksakan?', id: 'during-electrical-01' },
];

const OUT_OF_SCOPE = [
  'Magkano ang bigas?',
  'Sino ang presidente?',
  'Paano magluto ng adobo?',
  'Anong oras ang basketball?',
  'Ilang taon na ang buwan?',
  'Saan makakabili ng murang sapatos?',
];

const context: Context = {
  phase: 'during', phaseSource: 'manual', reason: { source: 'manual', text: '' },
  changedAt: '2026-10-09T00:00:00+08:00', recommended: null, warnings: {}, suppressed: [],
};
const profile: Profile = {
  id: 'test', name: 'Bahay namin', ownerId: 'owner', people: [], petsCount: 0,
  headcount: 0, members: [], home: [], location: null, plan: { contacts: [] }, updatedAt: '2026-10-09T00:00:00+08:00',
};
const index = createIndex(bundledContent.passages);

function run(question: string, household: Profile = profile, config: SearchConfig = DEFAULT_SEARCH_CONFIG) {
  return search(normalize(question, bundledContent.synonyms), context, household, index, config);
}

describe('search calibration on bundled guide passages', () => {
  const inScopeResults = IN_SCOPE.map(({ question, id }) => ({ question, id, result: run(question) }));
  const outOfScopeResults = OUT_OF_SCOPE.map((question) => ({ question, result: run(question) }));

  it('prints raw top scores and derives the two-decimal midpoint threshold', () => {
    const inScores = inScopeResults.map(({ result }) => result.gate.topScore);
    const outScores = outOfScopeResults.map(({ result }) => result.gate.topScore);
    const minInScope = Math.min(...inScores);
    const maxOutOfScope = Math.max(...outScores);
    const midpoint = Math.round(((minInScope + maxOutOfScope) / 2) * 100) / 100;
    console.info('Search calibration raw top scores:', {
      inScope: inScopeResults.map(({ question, result }) => [question, result.gate.topScore]),
      outOfScope: outOfScopeResults.map(({ question, result }) => [question, result.gate.topScore]),
      maxOutOfScope,
      minInScope,
      midpoint,
    });
    expect(maxOutOfScope).toBeLessThan(minInScope);
    expect(DEFAULT_SEARCH_CONFIG.threshold).toBe(midpoint);
  });

  it('retrieves each expected passage and passes the gate for in-scope questions', () => {
    for (const { question, id, result } of inScopeResults) {
      expect(result.hits[0]?.id, question).toBe(id);
      expect(result.gate.passed, question).toBe(true);
    }
  });

  it('refuses out-of-scope questions with three guide suggestions', () => {
    for (const { result } of outOfScopeResults) {
      expect(result.selected).toEqual([]);
      expect(result.gate.passed).toBe(false);
      expect(result.suggestions).toHaveLength(3);
    }
  });

  it('applies profile boosts to rank without changing the raw gate score', () => {
    const riverQuestion = 'Malapit kami sa ilog, lilikas na ba kami?';
    const base = run(riverQuestion);
    const riverProfile = { ...profile, home: ['near_river'] as Profile['home'] };
    const boosted = run(riverQuestion, riverProfile);
    const plainRiverScore = base.hits.find((hit) => hit.id === 'during-flood-river-01')!.boostedScore;
    const boostedRiverScore = boosted.hits.find((hit) => hit.id === 'during-flood-river-01')!.boostedScore;
    expect(boostedRiverScore).toBeGreaterThanOrEqual(plainRiverScore);
    expect(boosted.gate.topScore).toBeCloseTo(base.gate.topScore, 10);
  });
});

const ENGLISH_IN_SCOPE = [
  'when should we evacuate',
  'how do we evacuate',
  'where should we evacuate to',
  'what to do in signal 3',
  'what does wind signal mean',
  'how to store water',
  'how do we store drinking water',
  'flood in the house what to do',
  'what to do during a flood',
  'i have a wound after the flood',
  'wound care after a flood',
  'what is storm surge',
  'how to prepare for a landslide',
  'what to put in a go bag',
  'how to prepare a go bag',
  'how to prepare for a baby during a typhoon',
  'what medicine should a senior bring',
  'how to prepare for our pet before a typhoon',
  'what to do when the power goes out',
  'is it safe to use a generator inside the house',
  'how to prepare the roof before a typhoon',
  'how to clean the house after a flood',
];

const TAGLISH_IN_SCOPE = [
  'kailan dapat lumikas',
  'saan ba lilikas kapag baha',
  'ano ang gagawin kapag bumaha sa bahay',
  'paano mag-imbak ng tubig',
  'may sugat ako pagkatapos ng baha',
  'ano ang gagawin sa signal 3',
  'paano ihanda ang go bag',
  'ano ang gagawin sa bagyo',
  'paano alagaan ang sanggol sa bagyo',
  'may gamot ba sa go bag',
  'paano linisin ang bahay pagkatapos ng baha',
  'saan pupunta kapag may storm surge',
];

const EXTRA_OUT_OF_SCOPE = [
  'sino nanalo sa basketball',
  'presyo ng bigas',
  'who won the election',
  'what is the price of rice',
  'recommend a movie',
  'how to cook adobo',
  'who is the president',
  'what time is the basketball game',
  'where can i buy cheap shoes',
  'how many months in a year',
  'best cellphone brand',
  'how to play guitar',
];

describe('english and taglish retrieval coverage', () => {
  const inScope = [...ENGLISH_IN_SCOPE, ...TAGLISH_IN_SCOPE].map((question) => ({ question, result: run(question) }));
  const outOfScope = EXTRA_OUT_OF_SCOPE.map((question) => ({ question, result: run(question) }));

  it('passes the gate for every english and taglish in-scope question', () => {
    for (const { question, result } of inScope) {
      expect(result.gate.passed, question).toBe(true);
      expect(result.selected.length, question).toBeGreaterThan(0);
    }
  });

  it('refuses every out-of-scope question with three guide suggestions', () => {
    for (const { question, result } of outOfScope) {
      expect(result.gate.passed, question).toBe(false);
      expect(result.selected, question).toEqual([]);
      expect(result.suggestions, question).toHaveLength(3);
    }
  });
});
