import type {
  AiDecision, AiSkipReason, AnswerEvent, AskOptions, BulletinCardView, Context,
  EmergencyCardView, EvacuationCenter, GuideIndex, Hotline, ModelManager, Outcome, PhaseRules, Profile,
  QuestionLogEntry, SourceRef, Timings,
} from '../types/index.ts';
import { DEFAULT_SEARCH_CONFIG } from '../core/config.ts';
import { normalize } from '../core/normalize.ts';
import { route } from '../core/route.ts';
import { search } from '../core/search.ts';
import { buildPrompt } from '../core/prompt.ts';
import { verify } from '../core/verify.ts';
import { toManilaIso } from '../core/time.ts';
import { decidePhase } from '../core/decidePhase.ts';
import { copyText } from './copy.ts';
import type { BundledContent } from '../core/validateContent.ts';

export interface AskDeps {
  content: BundledContent;
  index: GuideIndex;
  profile: () => Profile | null;
  context: () => Context;
  phaseRules: PhaseRules;
  applyContext: (context: Context) => void;
  power: { aiAllowed(): Promise<AiDecision> };
  model: ModelManager;
  emergencyCard: (id?: string) => EmergencyCardView;
  hotlines: () => Hotline[];
  evacuationCenters: () => EvacuationCenter[];
  latestBulletin: () => BulletinCardView | null;
  log: (entry: QuestionLogEntry) => void;
  now?: () => number;
  newId?: () => string;
}

const zeroTimings = (): Timings => ({ routeMs: 0, searchMs: 0, totalMs: 0 });

function sourceRef(content: BundledContent, sourceId: string, locator?: string): SourceRef {
  const source = content.sources.find((item) => item.id === sourceId);
  return {
    sourceId,
    agency: source?.agency ?? '',
    title: source?.title ?? '',
    date: source?.date ?? '',
    url: source?.url ?? '',
    ...(locator ? { locator } : {}),
  };
}

function phaseKey(phase: 'before' | 'during' | 'after') {
  return `phase_${phase}` as const;
}

function redactProfileText(question: string, profile: Profile | null): string {
  let redacted = question;
  const privateValues = (profile?.people ?? [])
    .flatMap((member) => [member.name, member.note, member.phone])
    .filter((value): value is string => Boolean(value?.trim()));
  for (const value of privateValues) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    redacted = redacted.replace(new RegExp(escaped, 'gi'), '[redacted]');
  }
  return redacted;
}

function modelSettings(nPredict: number) {
  return { nPredict, temperature: 0.2, topP: 0.9, stop: [] as string[] };
}

export async function* runAskPipeline(
  question: string,
  deps: AskDeps,
  opts: AskOptions = {},
): AsyncIterable<AnswerEvent> {
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? (() => `log-${now()}-${Math.random().toString(36).slice(2, 8)}`);
  const startedAt = now();
  const normalized = normalize(question.slice(0, 200), deps.content.synonyms);
  const profile = deps.profile();
  const initialContext = deps.context();
  const routeStarted = now();
  const routed = route(normalized, deps.content.rules);
  const routeMs = Math.max(0, now() - routeStarted);
  const logEntry: QuestionLogEntry = {
    id: newId(), at: toManilaIso(new Date(startedAt)), question: redactProfileText(normalized.raw, profile),
    route: routed.primary, emergency: routed.emergency, phaseCue: routed.phaseCue?.phase ?? null,
    phaseHint: null, hint: 'none', topIds: [], topScore: 0, gatePassed: false,
    outcome: 'cancelled', failures: [], timings: { ...zeroTimings(), routeMs },
  };
  let logged = false;
  const finish = (outcome: Outcome): AnswerEvent => {
    logEntry.outcome = outcome;
    logEntry.timings.totalMs = Math.max(0, now() - startedAt);
    if (!logged) {
      deps.log(logEntry);
      logged = true;
    }
    return { type: 'done', logId: logEntry.id, outcome };
  };
  const cancelled = (): boolean => opts.signal?.aborted ?? false;
  const doneCancelled = (): AnswerEvent => finish('cancelled');
  if (cancelled()) {
    yield doneCancelled();
    return;
  }
  if (routed.emergency) {
    yield { type: 'emergency_card', card: deps.emergencyCard(), matched: routed.matched };
    if (cancelled()) {
      yield doneCancelled();
      return;
    }
  }

  let outcome: Outcome = 'answered_summary';
  let phaseHint: 'before' | 'during' | 'after' | null = null;
  const field = routed.planField;
  if (routed.primary === 'live_data') {
    const bulletin = deps.latestBulletin();
    if (bulletin) {
      yield { type: 'bulletin_card', card: bulletin };
      outcome = 'bulletin_card';
    } else {
      yield { type: 'fixed_reply', route: 'live_data', copyKey: 'no_live_data', text: copyText('no_live_data') };
      outcome = 'fixed_reply';
    }
  } else if (routed.primary === 'medical_dose') {
    yield { type: 'fixed_reply', route: 'medical_dose', copyKey: 'medical_dose', text: copyText('medical_dose') };
    outcome = 'fixed_reply';
  } else if (routed.primary === 'plan' && field) {
    const plan = profile?.plan;
    if (field === 'evacuation_center') {
      const center = deps.evacuationCenters().find((item) => item.id === plan?.evacuationCenterId);
      const text = plan?.evacuationCenter;
      yield center
        ? { type: 'plan_answer', field, empty: false, center: center.name }
        : text?.trim()
          ? { type: 'plan_answer', field, empty: false, text }
          : { type: 'plan_answer', field, empty: true };
    } else if (field === 'meeting_place') {
      const text = plan?.meetingPlace;
      yield text?.trim()
        ? { type: 'plan_answer', field, empty: false, text }
        : { type: 'plan_answer', field, empty: true };
    } else if (field === 'contacts') {
      const contacts = plan?.contacts ?? [];
      yield { type: 'plan_answer', field, empty: contacts.length === 0, ...(contacts.length ? { contacts } : {}) };
    } else {
      const hotlines = deps.hotlines();
      yield { type: 'plan_answer', field, empty: hotlines.length === 0, ...(hotlines.length ? { hotlines } : {}) };
    }
    outcome = 'plan_answer';
  } else {
    const searchStarted = now();
    const result = search(normalized, initialContext, profile, deps.index, DEFAULT_SEARCH_CONFIG);
    logEntry.timings.searchMs = Math.max(0, now() - searchStarted);
    logEntry.topIds = result.hits.slice(0, 2).map((hit) => hit.id);
    logEntry.topScore = result.gate.topScore;
    logEntry.gatePassed = result.gate.passed;
    if (!result.gate.passed || result.selected.length === 0) {
      yield { type: 'refusal', copyKey: 'refusal', text: copyText('refusal'), suggestions: result.suggestions };
      outcome = 'refused';
    } else {
      const selected = result.selected
        .map((id) => deps.content.passages.find((passage) => passage.id === id))
        .filter((passage): passage is BundledContent['passages'][number] => passage !== undefined);
      const critical = selected.find((passage) => passage.critical);
      if (critical) {
        selected.splice(selected.indexOf(critical), 1);
        selected.unshift(critical);
      }
      const fallback = selected[0];
      if (!fallback) {
        yield { type: 'refusal', copyKey: 'refusal', text: copyText('refusal'), suggestions: result.suggestions };
        outcome = 'refused';
      } else {
        yield { type: 'summary', passageId: fallback.id, title: fallback.title, text: fallback.summary,
          pinned: fallback.critical, source: sourceRef(deps.content, fallback.source_id, fallback.locator) };
        outcome = 'answered_summary';
        if (cancelled()) {
          yield doneCancelled();
          return;
        }
        let decision: AiDecision;
        try {
          decision = await deps.power.aiAllowed();
        } catch {
          decision = { allowed: false, reason: 'no_model' };
        }
        if (cancelled()) {
          yield doneCancelled();
          return;
        }
        if (!decision.allowed) {
          logEntry.aiSkipReason = decision.reason;
          yield { type: 'ai_status', status: 'skipped', reason: decision.reason as AiSkipReason };
        } else {
          yield { type: 'ai_status', status: 'loading_model' };
          yield { type: 'ai_status', status: 'thinking' };
          const tier = await deps.model.tier().catch(() => 'lite' as const);
          const prompt = buildPrompt({
            question: normalized.raw,
            profile,
            context: initialContext,
            passages: selected,
          });
          const pending: string[] = [];
          const request = deps.model.generate(
            { prompt, settings: modelSettings(tier === 'full' ? 110 : 80) },
            (text) => pending.push(text),
            opts.signal,
          );
          let requestDone = false;
          void request.then(
            () => { requestDone = true; },
            () => { requestDone = true; },
          );
          let emitted = 0;
          while (!requestDone || emitted < pending.length) {
            if (cancelled()) {
              await deps.model.stop().catch(() => undefined);
              yield doneCancelled();
              return;
            }
            while (emitted < pending.length) yield { type: 'ai_partial', text: pending[emitted++]! };
            if (!requestDone) await new Promise((resolve) => setTimeout(resolve, 0));
          }
          const generated = await request;
          if (cancelled() || (!generated.ok && generated.error.code === 'cancelled')) {
            yield doneCancelled();
            return;
          }
          if (!generated.ok) {
            logEntry.failures = ['schema'];
            yield { type: 'ai_rejected', code: 'schema', fallbackPassageId: fallback.id };
          } else {
            const verification = verify(generated.value.raw, selected);
            if (!verification.ok || !verification.output) {
              const failure = verification.failures[0]?.code ?? 'schema';
              logEntry.failures = verification.failures.map((item) => item.code);
              yield { type: 'ai_rejected', code: failure, fallbackPassageId: fallback.id };
            } else {
              phaseHint = verification.output.phase_hint;
              outcome = 'answered_ai';
              yield { type: 'ai_final', text: verification.output.answer, used: verification.output.used,
                timings: {
                  routeMs,
                  searchMs: logEntry.timings.searchMs,
                  ...generated.value.timings,
                  totalMs: Math.max(0, now() - startedAt),
                } };
            }
          }
        }
      }
    }
  }

  if (cancelled()) {
    yield doneCancelled();
    return;
  }
  logEntry.phaseHint = phaseHint;
  const phaseDecision = decidePhase({
    context: initialContext,
    ask: { questionId: logEntry.id, cue: routed.phaseCue, hint: phaseHint },
    storm: null,
    rules: deps.phaseRules,
    now: toManilaIso(new Date(now())),
  });
  logEntry.hint = phaseDecision.hint;
  const nextContext: Context = { ...phaseDecision.state, warnings: initialContext.warnings };
  if (JSON.stringify(nextContext) !== JSON.stringify(initialContext)) deps.applyContext(nextContext);
  const switched = phaseDecision.switched;
  const recommendation = phaseDecision.state.recommended;
  if (switched) {
    const label = copyText(phaseKey(switched.to));
    yield { type: 'phase_change', kind: 'switched', from: switched.from, to: switched.to, source: 'ask',
      copyKey: 'phase_switched', text: copyText('phase_switched', { vars: { phase: label } }) };
    logEntry.phaseChange = { kind: 'switched', from: switched.from, to: switched.to };
  } else if (recommendation && recommendation.phase !== initialContext.phase) {
    yield { type: 'phase_change', kind: 'recommended', from: initialContext.phase, to: recommendation.phase,
      source: 'ask', copyKey: phaseKey(recommendation.phase), text: copyText(phaseKey(recommendation.phase)) };
    logEntry.phaseChange = { kind: 'recommended', from: initialContext.phase, to: recommendation.phase };
  }
  yield { type: 'closing', copyKey: 'closing', text: copyText('closing') };
  yield finish(outcome);
}
