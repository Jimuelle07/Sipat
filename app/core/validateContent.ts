import type {
  BundledContent,
  ContentFileName,
  Result,
  Passage,
  ChecklistItem,
  WarningEntry,
  SynonymEntry,
  IntentRules,
  Source,
  Hotline,
} from '../types/index.ts';

export const REQUIRED_CONTENT_FILES = [
  'guide.tl.json',
  'checklist.json',
  'warnings.json',
  'synonyms.json',
  'intents.json',
  'sources.json',
  'hotlines.json',
] as const satisfies readonly ContentFileName[];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_RE = /^\+?\d+$/;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Validates raw parsed content JSON; collects every problem into one message joined by "; ". */
export function validateContent(
  raw: Partial<Record<ContentFileName, unknown>>,
): Result<BundledContent, 'content_invalid'> {
  const problems: string[] = [];

  const envelope = (file: ContentFileName, body: 'items' | 'rules'): unknown => {
    const v = raw[file];
    if (v === undefined) {
      problems.push(`${file}: missing`);
      return undefined;
    }
    if (!isRec(v)) {
      problems.push(`${file}: not an object`);
      return undefined;
    }
    if (v.schema_version !== 1) problems.push(`${file}: schema_version must be 1`);
    if (body === 'items' && !Array.isArray(v.items)) {
      problems.push(`${file}: items must be an array`);
      return undefined;
    }
    if (body === 'rules' && !isRec(v.rules)) {
      problems.push(`${file}: rules must be an object`);
      return undefined;
    }
    return v[body];
  };

  const items = (file: ContentFileName, withIds: boolean): Rec[] => {
    const list = envelope(file, 'items');
    if (!Array.isArray(list)) return [];
    const out: Rec[] = [];
    list.forEach((it, i) => {
      if (!isRec(it)) {
        problems.push(`${file}: item ${i} is not an object`);
        return;
      }
      out.push(it);
    });
    if (withIds) uniqueIds(file, out);
    return out;
  };

  const uniqueIds = (where: string, list: Rec[]): void => {
    const seen = new Set<string>();
    list.forEach((it, i) => {
      if (!nonEmpty(it.id)) {
        problems.push(`${where}: item ${i} has no id`);
        return;
      }
      if (seen.has(it.id)) problems.push(`${where}: duplicate id ${it.id}`);
      seen.add(it.id);
    });
  };

  const label = (file: string, it: Rec, i: number) => `${file}: ${nonEmpty(it.id) ? it.id : `item ${i}`}`;

  const sources = items('sources.json', true);
  const sourceIds = new Set(sources.map((s) => s.id).filter(nonEmpty));
  const checkSource = (where: string, it: Rec): void => {
    if (!nonEmpty(it.source_id)) problems.push(`${where}: missing source_id`);
    else if (!sourceIds.has(it.source_id)) problems.push(`${where}: unknown source_id ${it.source_id}`);
  };

  const passages = items('guide.tl.json', true);
  passages.forEach((p, i) => {
    const where = label('guide.tl.json', p, i);
    checkSource(where, p);
    if (!nonEmpty(p.reviewed_by)) problems.push(`${where}: missing reviewed_by`);
    if (typeof p.reviewed_at !== 'string' || !DATE_RE.test(p.reviewed_at))
      problems.push(`${where}: reviewed_at must be YYYY-MM-DD`);
  });

  const checklist = items('checklist.json', true);
  checklist.forEach((c, i) => {
    const where = label('checklist.json', c, i);
    checkSource(where, c);
    if (c.quantity !== undefined) {
      const amount = isRec(c.quantity) ? c.quantity.amount : undefined;
      if (typeof amount !== 'number' || !(amount > 0)) problems.push(`${where}: quantity.amount must be > 0`);
    }
  });

  const warnings = items('warnings.json', true);
  warnings.forEach((w, i) => checkSource(label('warnings.json', w, i), w));

  const synonyms = items('synonyms.json', false);

  const hotlines = items('hotlines.json', true);
  const hotlineIds = new Set(hotlines.map((h) => h.id).filter(nonEmpty));
  hotlines.forEach((h, i) => {
    const where = label('hotlines.json', h, i);
    checkSource(where, h);
    if (!nonEmpty(h.verified_at)) problems.push(`${where}: missing verified_at`);
    if (typeof h.number !== 'string' || !NUMBER_RE.test(h.number))
      problems.push(`${where}: number must be digits with optional leading +`);
  });

  const rules = envelope('intents.json', 'rules');
  if (isRec(rules)) {
    const cards = Array.isArray(rules.emergency_cards) ? rules.emergency_cards.filter(isRec) : [];
    if (!Array.isArray(rules.emergency_cards)) problems.push('intents.json: rules.emergency_cards must be an array');
    uniqueIds('intents.json emergency_cards', cards);
    cards.forEach((card, i) => {
      const where = label('intents.json card', card, i);
      checkSource(where, card);
      const ids = Array.isArray(card.hotline_ids) ? card.hotline_ids : [];
      for (const id of ids) {
        if (typeof id !== 'string' || !hotlineIds.has(id)) problems.push(`${where}: unknown hotline_id ${String(id)}`);
      }
    });
  }

  if (problems.length > 0) {
    return { ok: false, error: { code: 'content_invalid', message: problems.join('; ') } };
  }
  return {
    ok: true,
    value: {
      passages: passages as unknown as Passage[],
      checklist: checklist as unknown as ChecklistItem[],
      warnings: warnings as unknown as WarningEntry[],
      synonyms: synonyms as unknown as SynonymEntry[],
      rules: rules as unknown as IntentRules,
      sources: sources as unknown as Source[],
      hotlines: hotlines as unknown as Hotline[],
    },
  };
}
