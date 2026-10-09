import type {
  ActiveWarnings,
  Phase,
  PhaseCandidate,
  PhaseDecision,
  PhaseInputKey,
  PhaseInputs,
  PhaseSource,
  PhaseState,
  PhaseSwitch,
  WarningKind,
} from '../types/index.ts';

type CandidateSource = Exclude<PhaseSource, 'manual'>;

// Caution order: during > before > after.
const CAUTION: Record<Phase, number> = { during: 3, before: 2, after: 1 };
// Deterministic tie order for candidates of the same phase.
const SOURCE_ORDER: Record<CandidateSource, number> = { warning: 0, bulletin: 1, ask: 2 };

const WARNING_KINDS: readonly WarningKind[] = ['tcws', 'rainfall', 'surge', 'gale', 'barangay_order'];

function warningKey(kind: WarningKind, warnings: ActiveWarnings): PhaseInputKey | null {
  switch (kind) {
    case 'tcws': return warnings.tcws ? `warning:tcws-${warnings.tcws.level}` : null;
    case 'rainfall': return warnings.rainfall ? `warning:rainfall-${warnings.rainfall.level}` : null;
    case 'surge': return warnings.surge ? `warning:surge-${warnings.surge.level}` : null;
    case 'gale': return warnings.gale ? 'warning:gale' : null;
    case 'barangay_order': return warnings.barangay_order ? 'warning:barangay-order' : null;
  }
}

function warningReasonText(kind: WarningKind, warnings: ActiveWarnings): string {
  switch (kind) {
    case 'tcws': return `Signal No. ${warnings.tcws?.level ?? ''} ang aktibo.`;
    case 'rainfall': return `${warnings.rainfall?.level ?? ''} na babala sa ulan ang aktibo.`;
    case 'surge': return `${warnings.surge?.level ?? ''} na babala sa storm surge ang aktibo.`;
    case 'gale': return 'Aktibo ang gale warning.';
    case 'barangay_order': return 'Pinapalikas na kami ng barangay.';
  }
}

function cueReasonText(phase: Phase): string {
  switch (phase) {
    case 'during': return 'Sabi ng tanong, narito na ang bagyo.';
    case 'before': return 'Sabi ng tanong, paparating pa lang ang bagyo.';
    case 'after': return 'Sabi ng tanong, humupa na ang bagyo.';
  }
}

function sourceOrderKey(source: CandidateSource, key: PhaseInputKey): string {
  return `${SOURCE_ORDER[source]}:${key}`;
}

/** Inputs that are still present: their suppression survives pruning. */
function presentKeys(context: PhaseInputs['context'], storm: PhaseInputs['storm']): Set<PhaseInputKey> {
  const present = new Set<PhaseInputKey>();
  for (const kind of WARNING_KINDS) {
    const key = warningKey(kind, context.warnings);
    if (key) present.add(key);
  }
  if (storm) {
    present.add(`bulletin:${storm.bulletin.id}`);
    present.add(`storm:${storm.bulletin.stormId}`);
  }
  return present;
}

function pruneSuppressed(
  context: PhaseInputs['context'],
  storm: PhaseInputs['storm'],
): PhaseInputKey[] {
  const present = presentKeys(context, storm);
  return context.suppressed.filter((key) => present.has(key));
}

export function decidePhase(inputs: PhaseInputs): PhaseDecision {
  const { context, ask, storm, rules, now } = inputs;
  const suppressed = pruneSuppressed(context, storm);
  const suppressedSet = new Set<PhaseInputKey>(suppressed);

  const candidates: PhaseCandidate[] = [];

  for (const kind of WARNING_KINDS) {
    const key = warningKey(kind, context.warnings);
    if (!key || suppressedSet.has(key)) continue;
    candidates.push({
      key,
      phase: 'during',
      source: 'warning',
      effect: 'switch',
      reason: { source: 'warning', input: key, text: warningReasonText(kind, context.warnings) },
    });
  }

  if (ask?.cue) {
    const cue = ask.cue;
    const weakBacked = !cue.strong && ask.hint === cue.phase;
    if (cue.strong || weakBacked) {
      const key: PhaseInputKey = `ask:${ask.questionId}`;
      if (!suppressedSet.has(key)) {
        candidates.push({
          key,
          phase: cue.phase,
          source: 'ask',
          effect: cue.phase === 'during' ? 'switch' : 'recommend',
          reason: { source: 'ask', input: key, text: cueReasonText(cue.phase) },
        });
      }
    }
  }

  if (storm) {
    const { bulletin, measure } = storm;
    const bulletinKey: PhaseInputKey = `bulletin:${bulletin.id}`;
    const stormKey: PhaseInputKey = `storm:${bulletin.stormId}`;

    if (measure.signalHere !== null && !suppressedSet.has(bulletinKey)) {
      candidates.push({
        key: bulletinKey,
        phase: 'during',
        source: 'bulletin',
        effect: 'switch',
        reason: { source: 'bulletin', input: bulletinKey, text: 'May signal para sa inyong lugar.' },
      });
    }

    const near = rules.bands.near;
    if (
      !near.placeholder && near.max_km !== null &&
      measure.now.distanceKm <= near.max_km && !suppressedSet.has(bulletinKey)
    ) {
      candidates.push({
        key: bulletinKey,
        phase: 'during',
        source: 'bulletin',
        effect: 'switch',
        reason: { source: 'bulletin', input: bulletinKey, text: 'Malapit na ang bagyo.' },
      });
    }

    const approach = rules.bands.approach;
    if (
      context.phase === 'after' && !approach.placeholder && approach.max_km !== null &&
      measure.closestKm <= approach.max_km && !suppressedSet.has(stormKey)
    ) {
      candidates.push({
        key: stormKey,
        phase: 'before',
        source: 'bulletin',
        effect: 'switch',
        reason: { source: 'bulletin', input: stormKey, text: 'Papalapit ang bagyo.' },
      });
    }

    if (bulletin.final && !suppressedSet.has(bulletinKey)) {
      candidates.push({
        key: bulletinKey,
        phase: 'after',
        source: 'bulletin',
        effect: 'recommend',
        reason: { source: 'bulletin', input: bulletinKey, text: 'Tapos na ang bagyo ayon sa bulletin.' },
      });
    }
  }

  // One key is one input: a bulletin can raise a signal and be final at once;
  // keep the most cautious reading.
  const byKey = new Map<PhaseInputKey, PhaseCandidate>();
  for (const candidate of candidates) {
    const existing = byKey.get(candidate.key);
    if (!existing || CAUTION[candidate.phase] > CAUTION[existing.phase]) {
      byKey.set(candidate.key, candidate);
    }
  }
  const collected = [...byKey.values()];

  const warningActive = WARNING_KINDS.some((kind) => warningKey(kind, context.warnings) !== null);
  const hasDuringBulletin = collected.some((c) => c.phase === 'during' && c.source === 'bulletin');
  const hasFinalBulletin = collected.some((c) => c.phase === 'after' && c.source === 'bulletin');
  const hasTrack = collected.some((c) => c.phase === 'before' && c.key.startsWith('storm:'));

  let hint: PhaseDecision['hint'] = 'none';
  if (ask?.hint) {
    const cueBacks = ask.cue !== null && ask.cue.phase === ask.hint;
    const accepted =
      cueBacks ||
      (ask.hint === 'during' && (warningActive || hasDuringBulletin)) ||
      (ask.hint === 'after' && hasFinalBulletin) ||
      (ask.hint === 'before' && hasTrack);
    hint = accepted ? 'accepted' : 'dropped';
  }

  const sorted = [...collected].sort((a, b) => {
    const caution = CAUTION[b.phase] - CAUTION[a.phase];
    if (caution !== 0) return caution;
    return sourceOrderKey(a.source, a.key) < sourceOrderKey(b.source, b.key) ? -1 : 1;
  });
  const top = sorted[0] ?? null;

  const recommended: PhaseDecision['state']['recommended'] = top
    ? { phase: top.phase, reason: top.reason }
    : null;

  let switched: PhaseSwitch | null = null;
  if (top) {
    const toDuring = top.phase === 'during' && top.effect === 'switch' && context.phase !== 'during';
    const toBefore = top.phase === 'before' && top.effect === 'switch' && context.phase === 'after';
    if (toDuring || toBefore) {
      switched = {
        from: context.phase,
        to: top.phase === 'during' ? 'during' : 'before',
        source: top.source,
        input: top.key,
        at: now,
      };
    }
  }

  const state: PhaseState = {
    phase: context.phase,
    phaseSource: context.phaseSource,
    reason: context.reason,
    changedAt: context.changedAt,
    recommended,
    suppressed,
  };
  if (context.lastSwitch) state.lastSwitch = context.lastSwitch;
  if (context.undo) state.undo = context.undo;

  if (switched && top) {
    state.phase = switched.to;
    state.phaseSource = top.source;
    state.reason = top.reason;
    state.changedAt = now;
    state.lastSwitch = switched;
    state.undo = {
      phase: context.phase,
      phaseSource: context.phaseSource,
      reason: context.reason,
      warnings: { ...context.warnings },
      cause: top.key,
    };
  }

  return { state, switched, hint, candidates: collected };
}
