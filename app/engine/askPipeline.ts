import type {
  AiDecision, AiSkipReason, AnswerEvent, AskOptions, BundledContent, Context, EmergencyCardView,
  EvacuationCenter, GuideIndex, Hotline, ModelManager, Outcome, Profile, QuestionLogEntry,
  SourceRef, Timings,
} from '../types';
import { DEFAULT_SEARCH_CONFIG } from '../core/config';
import { normalize } from '../core/normalize';
import { route } from '../core/route';
import { search } from '../core/search';
import { buildPrompt } from '../core/prompt';
import { verify } from '../core/verify';
import { toManilaIso } from '../core/time';
import { COPY } from './copy';

export interface AskDeps {
  content: BundledContent;
  index: GuideIndex;
  profile: () => Profile | null;
  context: () => Context;
  power: { aiAllowed(): Promise<AiDecision> };
  model: ModelManager;
  emergencyCard: (id?: string) => EmergencyCardView;
  hotlines: () => Hotline[];
  evacuationCenters: () => EvacuationCenter[];
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

function modelSettings(nPredict: number) {
  return { nPredict, temperature: 0.2, topP: 0.9, stop: [] as string[] };
}

/** Runs the on-device grounded answer flow. All emitted paths are logged exactly once. */
export async function* runAskPipeline(
  question: string,
  deps: AskDeps,
  opts: AskOptions = {},
): AsyncIterable<AnswerEvent> {
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? (() => `log-${now()}-${Math.random().toString(36).slice(2, 8)}`);
  const startedAt = now();
  const routeStarted = now();
  const normalized = normalize(question, deps.content.synonyms);
  const profile = deps.profile();
  const context = deps.context();
  const routed = route(normalized, deps.content.rules);
  const routeMs = Math.max(0, now() - routeStarted);
  const logEntry: QuestionLogEntry = {
    id: newId(), at: toManilaIso(new Date(startedAt)), question: normalized.raw,
    route: routed.primary, emergency: routed.emergency, topIds: [], topScore: 0,
    gatePassed: false, outcome: 'cancelled', failures: [], timings: { ...zeroTimings(), routeMs },
  };
  let logged = false;
  const finish = (outcome: Outcome): AnswerEvent => {
    logEntry.outcome = outcome;
    logEntry.timings.totalMs = Math.max(0, now() - startedAt);
    if (!logged) { deps.log(logEntry); logged = true; }
    return { type: 'done', logId: logEntry.id, outcome };
  };
  const cancelled = (): boolean => opts.signal?.aborted ?? false;
  const doneCancelled = (): AnswerEvent => finish('cancelled');
  if (cancelled()) { yield doneCancelled(); return; }

  if (routed.emergency) {
    yield { type: 'emergency_card', card: deps.emergencyCard(), matched: routed.matched };
    if (cancelled()) { yield doneCancelled(); return; }
  }

  if (routed.primary === 'live_data' || routed.primary === 'medical_dose') {
    const live = routed.primary === 'live_data';
    yield { type: 'fixed_reply', route: routed.primary, copyKey: live ? 'no_live_data' : 'medical_dose', text: live ? COPY.no_live_data : COPY.medical_dose };
    if (cancelled()) { yield doneCancelled(); return; }
    yield { type: 'closing', copyKey: 'closing', text: COPY.closing };
    yield finish('fixed_reply'); return;
  }

  if (routed.primary === 'plan') {
    const field = routed.planField!;
    const plan = profile?.plan;
    if (field === 'evacuation_center') {
      const center = deps.evacuationCenters().find((item) => item.id === plan?.evacuationCenterId);
      const empty = !center && !plan?.evacuationCenter?.trim();
      yield empty
        ? { type: 'plan_answer', field, empty: true }
        : { type: 'plan_answer', field, empty: false, ...(center ? { center } : { text: plan!.evacuationCenter }) };
    } else if (field === 'meeting_place') {
      const text = plan?.meetingPlace;
      yield !text?.trim() ? { type: 'plan_answer', field, empty: true } : { type: 'plan_answer', field, empty: false, text };
    } else if (field === 'contacts') {
      const contacts = plan?.contacts ?? [];
      const text = contacts.map((contact) => [contact.name, contact.phone, contact.relation].filter(Boolean).join(' · ')).join('\n');
      yield contacts.length === 0 ? { type: 'plan_answer', field, empty: true } : { type: 'plan_answer', field, empty: false, text };
    } else {
      const hotlines = deps.hotlines();
      yield hotlines.length === 0 ? { type: 'plan_answer', field, empty: true } : { type: 'plan_answer', field, empty: false, hotlines };
    }
    if (cancelled()) { yield doneCancelled(); return; }
    yield { type: 'closing', copyKey: 'closing', text: COPY.closing };
    yield finish('plan_answer'); return;
  }

  const searchStarted = now();
  const result = search(normalized, context, profile, deps.index, DEFAULT_SEARCH_CONFIG);
  logEntry.timings.searchMs = Math.max(0, now() - searchStarted);
  logEntry.topIds = result.hits.slice(0, 2).map((hit) => hit.id);
  logEntry.topScore = result.gate.topScore;
  logEntry.gatePassed = result.gate.passed;
  if (!result.gate.passed || result.selected.length === 0) {
    yield { type: 'refusal', copyKey: 'refusal', text: COPY.refusal, suggestions: result.suggestions };
    yield { type: 'closing', copyKey: 'closing', text: COPY.closing };
    yield finish('refused'); return;
  }

  const selected = result.selected
    .map((id) => deps.content.passages.find((passage) => passage.id === id))
    .filter((passage): passage is BundledContent['passages'][number] => passage !== undefined);
  const critical = selected.find((passage) => passage.critical);
  if (critical) selected.splice(selected.indexOf(critical), 1), selected.unshift(critical);
  const fallback = selected[0]!;
  yield {
    type: 'summary', passageId: fallback.id, title: fallback.title, text: fallback.summary,
    pinned: fallback.critical, source: sourceRef(deps.content, fallback.source_id, fallback.locator),
  };
  if (cancelled()) { yield doneCancelled(); return; }

  let decision: AiDecision;
  try { decision = await deps.power.aiAllowed(); }
  catch { decision = { allowed: false, reason: 'no_model' }; }
  if (cancelled()) { yield doneCancelled(); return; }
  if (!decision.allowed) {
    logEntry.aiSkipReason = decision.reason;
    yield { type: 'ai_status', status: 'skipped', reason: decision.reason as AiSkipReason };
    yield { type: 'closing', copyKey: 'closing', text: COPY.closing };
    yield finish('answered_summary'); return;
  }

  yield { type: 'ai_status', status: 'loading_model' };
  if (cancelled()) { yield doneCancelled(); return; }
  yield { type: 'ai_status', status: 'thinking' };
  if (cancelled()) { yield doneCancelled(); return; }
  const tier = await deps.model.tier().catch(() => 'lite' as const);
  const passages = selected;
  const prompt = buildPrompt({ question: normalized.raw, profile, context, passages });
  const pending: string[] = [];
  const request = deps.model.generate({ prompt, settings: modelSettings(tier === 'full' ? 110 : 80) }, (text) => pending.push(text), opts.signal);
  // Drain partial callbacks while generation is in flight without buffering the model response.
  let requestDone = false;
  void request.then(() => { requestDone = true; }, () => { requestDone = true; });
  let emitted = 0;
  while (!requestDone || emitted < pending.length) {
    if (cancelled()) {
      await deps.model.stop().catch(() => undefined);
      yield doneCancelled(); return;
    }
    while (emitted < pending.length) yield { type: 'ai_partial', text: pending[emitted++]! };
    if (!requestDone) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const generated = await request;
  if (cancelled() || (!generated.ok && generated.error.code === 'cancelled')) { yield doneCancelled(); return; }
  if (!generated.ok) {
    logEntry.failures = ['schema'];
    yield { type: 'ai_rejected', code: 'schema', fallbackPassageId: fallback.id };
    yield { type: 'closing', copyKey: 'closing', text: COPY.closing };
    yield finish('answered_summary'); return;
  }
  const verification = verify(generated.value.raw, passages);
  logEntry.timings = {
    ...logEntry.timings,
    ...generated.value.timings,
    totalMs: Math.max(0, now() - startedAt),
  };
  if (!verification.ok || !verification.output || !verification.text) {
    const failure = verification.failures[0]?.code ?? 'schema';
    logEntry.failures = verification.failures.map((item) => item.code);
    yield { type: 'ai_rejected', code: failure, fallbackPassageId: fallback.id };
    yield { type: 'closing', copyKey: 'closing', text: COPY.closing };
    yield finish('answered_summary'); return;
  }
  const timings: Timings = {
    routeMs: logEntry.timings.routeMs, searchMs: logEntry.timings.searchMs,
    ...generated.value.timings, totalMs: Math.max(0, now() - startedAt),
  };
  yield { type: 'ai_final', text: verification.text, used: verification.output.used, timings };
  yield { type: 'closing', copyKey: 'closing', text: COPY.closing };
  yield finish('answered_ai');
}
