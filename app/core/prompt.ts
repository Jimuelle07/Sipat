import type {
  BuiltPrompt, ChatMessage, Context, HomeTag, MemberTag, Passage, Phase, Profile, PromptInput,
} from '../types/index.ts';

export const SYSTEM_TL = [
  'Ikaw si Bagyo Buddy, gabay sa paghahanda sa bagyo para sa isang sambahayan.',
  'Sumagot LAMANG mula sa mga talatang ibinigay. Huwag gumamit ng sariling kaalaman.',
  'Sumagot sa 2 hanggang 4 na maiikling pangungusap sa simpleng Tagalog.',
  'Huwag magdagdag ng numero, oras, lugar o pangalan na wala sa mga talata.',
  'Huwag magbigay ng numero ng telepono, hotline o dosis ng gamot.',
  'Kung hindi sinasagot ng mga talata ang tanong, ilagay ang "in_guide": false.',
  'Ilagay sa "used" ang ID ng talatang pinagkunan mo.',
  'Ilagay sa "phase_hint" ang yugto ng bagyo kung sinabi ito ng tanong; kung hindi, null.',
].join('\n');

export function answerSchema(ids: string[]) {
  return {
    type: 'object',
    properties: {
      used: { type: 'array', items: { enum: ids }, minItems: 1, maxItems: ids.length },
      in_guide: { type: 'boolean' },
      phase_hint: { enum: ['before', 'during', 'after', null] },
      answer: { type: 'string', maxLength: 400 },
    },
    required: ['used', 'in_guide', 'phase_hint', 'answer'],
    additionalProperties: false,
  };
}

export const PROMPT_TOKEN_BUDGET = 700;

export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

export const PHASE_LABEL: Record<Phase, string> = { before: 'Bago', during: 'Habang', after: 'Pagkatapos' };

const MEMBER_TL: Record<MemberTag, string> = {
  infant: 'sanggol',
  child: 'bata',
  pregnant: 'buntis',
  senior: 'senior',
  pwd: 'PWD',
  maintenance_meds: 'maintenance na gamot',
  pets: 'alagang hayop',
};

const HOME_TL: Record<HomeTag, string> = {
  near_river: 'malapit sa ilog',
  near_sea: 'malapit sa dagat',
  slope: 'nasa dalisdis',
  low_lying: 'mababang lugar',
  light_materials: 'bahay na magaang materyales',
  concrete: 'bahay na kongkreto',
  upper_floor: 'may itaas na palapag',
};

/** Tags only: never names, notes, phones, contacts, or plan places. */
export function profileSummary(profile: Profile): string {
  const parts = [`${profile.headcount} tao`];
  const members = profile.members.map((t) => MEMBER_TL[t]).filter(Boolean);
  if (members.length > 0) parts.push(`may ${members.join(' at ')}`);
  for (const h of profile.home) if (HOME_TL[h]) parts.push(HOME_TL[h]);
  return parts.join('; ');
}

export function warningsSummary(ctx: Context): string {
  const w = ctx.warnings;
  const parts: string[] = [];
  if (w.tcws) parts.push(`Signal No. ${w.tcws.level}`);
  if (w.rainfall) parts.push(`${w.rainfall.level} na babala sa ulan`);
  if (w.surge) parts.push(`${w.surge.level} na babala sa storm surge`);
  if (w.gale) parts.push('gale warning');
  if (w.barangay_order) parts.push('pinapalikas na ng barangay');
  return parts.length > 0 ? parts.join('; ') : 'wala';
}

function userTurn(summary: string, header: string, passages: Pick<Passage, 'id' | 'text'>[], question: string): string {
  const talata = passages.map((p) => `Talata [${p.id}]: ${p.text}`).join('\n');
  return `Sambahayan: ${summary}\nYugto at babala: ${header}\n\n${talata}\n\nTanong: ${question}`;
}

/** Verbatim copy of `before-gobag-01.summary` from content/guide.tl.json (test enforces equality); the summary keeps the fixed part small (system-design §6.1). */
export const EXAMPLE_PASSAGE_ID = 'before-gobag-01';
export const EXAMPLE_PASSAGE_TEXT =
  'Ihanda ang go bag na may tubig, pagkain, gamot, flashlight, damit, gamit sa kalinisan at mga dokumento, at suriin ito nang regular.';

const EXAMPLE_PASSAGES = [{ id: EXAMPLE_PASSAGE_ID, text: EXAMPLE_PASSAGE_TEXT }];
const EXAMPLE_SUMMARY = '4 tao; may bata';
const EXAMPLE_HEADER = `${PHASE_LABEL.before}; wala`;
export const EXAMPLE_1_USER = userTurn(EXAMPLE_SUMMARY, EXAMPLE_HEADER, EXAMPLE_PASSAGES, 'Ano ang dapat ilagay sa go bag?');
// Keys in order used, in_guide, phase_hint, answer: the answer streams last; the question states no phase.
export const EXAMPLE_1_JSON = JSON.stringify({
  used: [EXAMPLE_PASSAGE_ID],
  in_guide: true,
  phase_hint: null,
  answer:
    'Ilagay sa go bag ang tubig, pagkain, gamot, flashlight at damit. Isama rin ang gamit sa kalinisan at mga dokumento, at suriin ito nang regular.',
});
export const EXAMPLE_2_USER = userTurn(EXAMPLE_SUMMARY, EXAMPLE_HEADER, EXAMPLE_PASSAGES, 'Magkano ang pamasahe papuntang evacuation center?');
export const EXAMPLE_2_JSON = JSON.stringify({ used: [EXAMPLE_PASSAGE_ID], in_guide: false, phase_hint: null, answer: '' });

function assemble(input: PromptInput, passages: Passage[]): BuiltPrompt {
  const header = `${PHASE_LABEL[input.context.phase]}; ${warningsSummary(input.context)}`;
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_TL },
    { role: 'user', content: EXAMPLE_1_USER },
    { role: 'assistant', content: EXAMPLE_1_JSON },
    { role: 'user', content: EXAMPLE_2_USER },
    { role: 'assistant', content: EXAMPLE_2_JSON },
    { role: 'user', content: userTurn(input.profile ? profileSummary(input.profile) : 'hindi pa naka-setup', header, passages, input.question) },
  ];
  const allowedIds = passages.map((p) => p.id);
  return {
    messages,
    responseFormat: { type: 'json_schema', json_schema: { schema: answerSchema(allowedIds) } },
    allowedIds,
  };
}

export function promptTokens(prompt: BuiltPrompt): number {
  return prompt.messages.reduce((n, m) => n + estimateTokens(m.content), 0);
}

export function buildPrompt(input: PromptInput): BuiltPrompt {
  const passages = input.passages.slice(0, 2);
  const full = assemble(input, passages);
  if (passages.length === 2 && promptTokens(full) > PROMPT_TOKEN_BUDGET) {
    return assemble(input, passages.slice(0, 1));
  }
  return full;
}
