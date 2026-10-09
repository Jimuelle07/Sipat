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

export const REQUIRED_CONTENT_FILES = [
  'guide.tl.json',
  'checklist.json',
  'warnings.json',
  'synonyms.json',
  'intents.json',
  'sources.json',
  'hotlines.json',
  'phase_rules.json',
  'places.json',
] as const satisfies readonly ContentFileName[];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_RE = /^\+?\d+$/;
const CHECKLIST_GROUPS = ['now', 'go_bag', 'home', 'evacuate', 'after'] as const;
const WARNING_KINDS = ['tcws', 'rainfall', 'surge', 'gale', 'barangay_order'] as const;
const PHASES = ['before', 'during', 'after'] as const;
const PLAN_FIELDS = ['evacuation_center', 'meeting_place', 'contacts', 'hotlines'] as const;
const PLACE_LEVELS = ['region', 'province', 'city', 'municipality', 'barangay'] as const;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const oneOf = (v: unknown, allowed: readonly string[]): boolean => typeof v === 'string' && allowed.includes(v);
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

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
    const cardIds = new Set(cards.map((card) => card.id).filter(nonEmpty));
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
    if (!isRec(phaseCues)) {
      problems.push('intents.json: rules.phase_cues must be an object');
    } else {
      for (const phase of PHASES) {
        const list = phaseCues[phase];
        if (!isRec(list) || !isStringArray(list.strong) || !isStringArray(list.weak))
          problems.push(`intents.json: rules.phase_cues.${phase} must have strong and weak string arrays`);
      }
    }
    const emergency = rules.emergency;
    if (!isRec(emergency)) {
      problems.push('intents.json: rules.emergency must be an object');
    } else {
      if (!isStringArray(emergency.phrases)) problems.push('intents.json: rules.emergency.phrases must be a string array');
      if (!nonEmpty(emergency.card_id)) problems.push('intents.json: rules.emergency.card_id must be a non-empty string');
      else if (cardIds.size > 0 && !cardIds.has(emergency.card_id))
        problems.push(`intents.json: rules.emergency.card_id ${emergency.card_id} has no matching card`);
    }
    checkReplyGroup('live_data', rules.live_data, 'no_live_data', problems);
    checkReplyGroup('medical_dose', rules.medical_dose, 'medical_dose', problems);
    const plan = rules.plan;
    if (!isRec(plan)) {
      problems.push('intents.json: rules.plan must be an object');
    } else {
      for (const field of PLAN_FIELDS) {
        if (!isStringArray(plan[field])) problems.push(`intents.json: rules.plan.${field} must be a string array`);
      }
    }
  }

  const phaseRules = envelope('phase_rules.json', 'rules');
  if (isRec(phaseRules)) validateSourcedRules(phaseRules, problems);

  const placesRaw = raw['places.json'];
  const placeItems = envelope('places.json', 'items');
  if (isRec(placesRaw)) {
    if (!nonEmpty(placesRaw.names_source_id)) problems.push('places.json: missing names_source_id');
    const centroids = placesRaw.centroids_source_id;
    if (!(centroids === null || nonEmpty(centroids)))
      problems.push('places.json: centroids_source_id must be a string or null');
  }
  if (Array.isArray(placeItems)) {
    const places: Rec[] = [];
    placeItems.forEach((p, i) => {
      if (!isRec(p)) { problems.push(`places.json: item ${i} is not an object`); return; }
      places.push(p);
    });
    validatePlaces(places, isRec(placesRaw) ? placesRaw : undefined, problems);
  }

  const centersRaw = raw['evacuation_centers.json'];
  if (centersRaw !== undefined) {
    const centers = envelope('evacuation_centers.json', 'items');
    if (Array.isArray(centers)) {
      centers.forEach((c, i) => {
        if (!isRec(c)) { problems.push(`evacuation_centers.json: item ${i} is not an object`); return; }
        const where = label('evacuation_centers.json', c, i);
        checkSource(where, c);
        if (!nonEmpty(c.reviewed_by)) problems.push(`${where}: missing reviewed_by`);
        if (typeof c.reviewed_at !== 'string' || !DATE_RE.test(c.reviewed_at))
          problems.push(`${where}: reviewed_at must be YYYY-MM-DD`);
        if (!isRec(c.coords) || typeof c.coords.lat !== 'number' || typeof c.coords.lon !== 'number'
          || (c.coords.lat === 0 && c.coords.lon === 0))
          problems.push(`${where}: coords must be real numbers, not the 0, 0 placeholder`);
      });
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
      ...(isRec(phaseRules) ? { phaseRules: phaseRules as unknown as PhaseRules } : {}),
      ...(isRec(placesRaw) ? { places: placesRaw as unknown as PlacesFile } : {}),
    },
  };
}

/** An intent reply group carries a phrase list and the exact reply key the type requires. */
function checkReplyGroup(field: string, group: unknown, replyKey: string, problems: string[]): void {
  const where = `intents.json: rules.${field}`;
  if (!isRec(group)) {
    problems.push(`${where} must be an object`);
    return;
  }
  if (!isStringArray(group.phrases)) problems.push(`${where}.phrases must be a string array`);
  if (group.reply_key !== replyKey) problems.push(`${where}.reply_key must be '${replyKey}'`);
}

/** A sourced rule is either a placeholder (all values null) or must carry a value, a source and a reviewer. */
function validateSourcedRules(rules: Rec, problems: string[]): void {
  const bands = isRec(rules.bands) ? rules.bands : undefined;
  const near = bands && isRec(bands.near) ? bands.near : undefined;
  const approach = bands && isRec(bands.approach) ? bands.approach : undefined;
  checkSourcedValue('phase_rules.json near', near, 'max_km', problems);
  checkSourcedValue('phase_rules.json approach', approach, 'max_km', problems);
  checkSourcedEvacuation(isRec(rules.evacuation_threshold) ? rules.evacuation_threshold : undefined, problems);
  if (near && approach && near.placeholder === false && approach.placeholder === false
    && isNumber(near.max_km) && isNumber(approach.max_km) && !(approach.max_km > near.max_km)) {
    problems.push('phase_rules.json: approach.max_km must be larger than near.max_km');
  }
}

function checkSourcedValue(where: string, rule: Rec | undefined, valueKey: string, problems: string[]): void {
  if (!rule || typeof rule.placeholder !== 'boolean') {
    problems.push(`${where}: placeholder must be a boolean`);
    return;
  }
  if (rule.placeholder) {
    if (rule[valueKey] !== null) problems.push(`${where}: a placeholder rule must have ${valueKey} null`);
    return;
  }
  if (!isNumber(rule[valueKey]) || !nonEmpty(rule.source_id) || !nonEmpty(rule.reviewed_by)) {
    problems.push(`${where}: a sourced rule needs ${valueKey}, source_id and reviewed_by`);
  }
}

function checkSourcedEvacuation(rule: Rec | undefined, problems: string[]): void {
  const where = 'phase_rules.json evacuation_threshold';
  if (!rule || typeof rule.placeholder !== 'boolean') {
    problems.push(`${where}: placeholder must be a boolean`);
    return;
  }
  if (rule.placeholder) {
    if (rule.category_min !== null || rule.tcws_min !== null)
      problems.push(`${where}: a placeholder rule must have category_min and tcws_min null`);
    return;
  }
  if ((rule.category_min === null && rule.tcws_min === null)
    || !nonEmpty(rule.source_id) || !nonEmpty(rule.reviewed_by)) {
    problems.push(`${where}: a sourced rule needs category_min or tcws_min, source_id and reviewed_by`);
  }
}

/** Places: unique PSGC, valid level, parents that exist (regions have none), and a well-shaped centroid. */
function validatePlaces(places: Rec[], file: Rec | undefined, problems: string[]): void {
  const byPsgc = new Map<string, Rec>();
  places.forEach((p, i) => {
    const where = `places.json: ${nonEmpty(p.psgc) ? p.psgc : `item ${i}`}`;
    if (!nonEmpty(p.psgc)) problems.push(`${where}: missing psgc`);
    else if (byPsgc.has(p.psgc)) problems.push(`places.json: duplicate psgc ${p.psgc}`);
    else byPsgc.set(p.psgc, p);
    if (!nonEmpty(p.name)) problems.push(`${where}: missing name`);
    if (!oneOf(p.level, PLACE_LEVELS)) problems.push(`${where}: level must be one of ${PLACE_LEVELS.join(', ')}`);
    if (p.centroid !== undefined && !isCentroid(p.centroid)) problems.push(`${where}: centroid must be { lat, lon } in range`);
  });
  places.forEach((p, i) => {
    const where = `places.json: ${nonEmpty(p.psgc) ? p.psgc : `item ${i}`}`;
    if (p.level === 'region') {
      if (p.parent !== null) problems.push(`${where}: a region's parent must be null`);
      return;
    }
    if (!nonEmpty(p.parent)) { problems.push(`${where}: missing parent`); return; }
    if (!byPsgc.has(p.parent)) problems.push(`${where}: parent ${p.parent} not found`);
  });
  if (isRec(file) && nonEmpty(file.centroids_source_id)) {
    places.forEach((p, i) => {
      if (p.level === 'barangay' && p.centroid === undefined) {
        const where = `places.json: ${nonEmpty(p.psgc) ? p.psgc : `item ${i}`}`;
        problems.push(`${where}: barangays need a centroid when centroids_source_id is set`);
      }
    });
  }
}

function isCentroid(v: unknown): boolean {
  return isRec(v) && isNumber(v.lat) && isNumber(v.lon)
    && v.lat >= -90 && v.lat <= 90 && v.lon >= -180 && v.lon <= 180;
}
