import type {
  ChecklistItem,
  ContentFileName,
  Hotline,
  IntentRules,
  Passage,
  PhaseRules,
  PlacesFile,
  Result,
  Source,
  SynonymEntry,
  WarningEntry,
} from '../types/index.ts';

export interface BundledContent {
  passages: Passage[];
  checklist: ChecklistItem[];
  warnings: WarningEntry[];
  synonyms: SynonymEntry[];
  rules: IntentRules;
  sources: Source[];
  hotlines: Hotline[];
  phaseRules?: PhaseRules;
  places?: PlacesFile;
}

// phase_rules.json and places.json are part of the v2 contract but not bundled yet; session 2 adds them.
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
const CHECKLIST_GROUPS = ['now', 'go_bag', 'home', 'evacuate', 'after'] as const;
const WARNING_KINDS = ['tcws', 'rainfall', 'surge', 'gale', 'barangay_order'] as const;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const oneOf = (v: unknown, allowed: readonly string[]): boolean => typeof v === 'string' && allowed.includes(v);

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
    if (p.lang !== 'tl') problems.push(`${where}: lang must be 'tl'`);
    if (!nonEmpty(p.reviewed_by)) problems.push(`${where}: missing reviewed_by`);
    if (typeof p.reviewed_at !== 'string' || !DATE_RE.test(p.reviewed_at))
      problems.push(`${where}: reviewed_at must be YYYY-MM-DD`);
    if (isRec(p.warnings) && p.warnings.barangay_order !== undefined && typeof p.warnings.barangay_order !== 'boolean')
      problems.push(`${where}: warnings.barangay_order must be a boolean`);
  });

  const checklist = items('checklist.json', true);
  checklist.forEach((c, i) => {
    const where = label('checklist.json', c, i);
    checkSource(where, c);
    if (!oneOf(c.group, CHECKLIST_GROUPS)) problems.push(`${where}: group must be one of ${CHECKLIST_GROUPS.join(', ')}`);
    if (!(c.priority === 1 || c.priority === 2 || c.priority === 3)) problems.push(`${where}: priority must be 1, 2 or 3`);
    if (typeof c.critical !== 'boolean') problems.push(`${where}: critical must be a boolean`);
  });

  const warnings = items('warnings.json', true);
  warnings.forEach((w, i) => {
    const where = label('warnings.json', w, i);
    checkSource(where, w);
    if (!oneOf(w.kind, WARNING_KINDS)) problems.push(`${where}: kind must be one of ${WARNING_KINDS.join(', ')}`);
    if (typeof w.confirmed !== 'boolean') problems.push(`${where}: confirmed must be a boolean`);
  });

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
    if (!Array.isArray(rules.emergency_cards)) problems.push('intents.json: rules.emergency_cards must be an array');
    const cards = Array.isArray(rules.emergency_cards) ? rules.emergency_cards.filter(isRec) : [];
    uniqueIds('intents.json emergency_cards', cards);
    cards.forEach((card, i) => {
      const where = label('intents.json card', card, i);
      checkSource(where, card);
      const ids = Array.isArray(card.hotline_ids) ? card.hotline_ids : [];
      for (const id of ids) {
        if (typeof id !== 'string' || !hotlineIds.has(id)) problems.push(`${where}: unknown hotline_id ${String(id)}`);
      }
    });
    const phaseCues = rules.phase_cues;
    if (phaseCues !== undefined) {
      if (!isRec(phaseCues)) problems.push('intents.json: rules.phase_cues must be an object');
      else {
        for (const phase of ['before', 'during', 'after'] as const) {
          const list = phaseCues[phase];
          if (list === undefined) continue;
          if (!isRec(list) || !Array.isArray(list.strong) || !Array.isArray(list.weak))
            problems.push(`intents.json: rules.phase_cues.${phase} must have strong and weak arrays`);
        }
      }
    }
  }

  const phaseRulesRaw = raw['phase_rules.json'];
  if (phaseRulesRaw !== undefined) {
    const phaseRules = envelope('phase_rules.json', 'rules');
    if (isRec(phaseRules)) validateSourcedRules(phaseRules, problems);
  }

  const placesRaw = raw['places.json'];
  if (placesRaw !== undefined) {
    if (!isRec(placesRaw)) problems.push('places.json: not an object');
    else {
      if (placesRaw.schema_version !== 1) problems.push('places.json: schema_version must be 1');
      if (!Array.isArray(placesRaw.items)) problems.push('places.json: items must be an array');
      if (!nonEmpty(placesRaw.names_source_id)) problems.push('places.json: missing names_source_id');
    }
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
      ...(isRec(phaseRulesRaw) && isRec(phaseRulesRaw.rules)
        ? { phaseRules: phaseRulesRaw.rules as unknown as PhaseRules } : {}),
      ...(isRec(placesRaw) ? { places: placesRaw as unknown as PlacesFile } : {}),
    },
  };
}

/** A sourced rule is either a placeholder or must carry a value, a source and a reviewer. */
function validateSourcedRules(rules: Rec, problems: string[]): void {
  const bands = isRec(rules.bands) ? rules.bands : undefined;
  const near = bands && isRec(bands.near) ? bands.near : undefined;
  const approach = bands && isRec(bands.approach) ? bands.approach : undefined;
  checkSourcedRule('phase_rules.json near', near, 'max_km', problems);
  checkSourcedRule('phase_rules.json approach', approach, 'max_km', problems);
  checkSourcedRule('phase_rules.json evacuation_threshold', isRec(rules.evacuation_threshold) ? rules.evacuation_threshold : undefined, null, problems);
  if (near && approach && typeof near.max_km === 'number' && typeof approach.max_km === 'number' && !(approach.max_km > near.max_km)) {
    problems.push('phase_rules.json: approach.max_km must be larger than near.max_km');
  }
}

function checkSourcedRule(where: string, rule: Rec | undefined, valueKey: string | null, problems: string[]): void {
  if (!rule || typeof rule.placeholder !== 'boolean') {
    problems.push(`${where}: placeholder must be a boolean`);
    return;
  }
  if (rule.placeholder) return;
  if (valueKey === null) {
    if (!nonEmpty(rule.source_id) || !nonEmpty(rule.reviewed_by)) problems.push(`${where}: a sourced rule needs source_id and reviewed_by`);
    return;
  }
  if (typeof rule[valueKey] !== 'number' || !nonEmpty(rule.source_id) || !nonEmpty(rule.reviewed_by)) {
    problems.push(`${where}: a sourced rule needs ${valueKey}, source_id and reviewed_by`);
  }
}
