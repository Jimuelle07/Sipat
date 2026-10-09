import type { AnswerEvent, SourceRef } from '../../../types';

export type ChatMessage =
  | { id: string; kind: 'question'; text: string; time: string }
  | { id: string; kind: 'answer'; question: string; time: string; events: AnswerEvent[]; error?: boolean };

const AI_REPLACED: ReadonlySet<AnswerEvent['type']> = new Set(['ai_partial', 'ai_final', 'ai_rejected']);

export function canSubmitQuestion(question: string): boolean {
  return question.trim().length > 0;
}

export function sourceLine(source: SourceRef): string {
  return [source.agency, source.title, source.date, source.locator]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' — ');
}

/** Append an event in arrival order while keeping streaming AI output in one replaceable slot. */
export function reduceEvents(current: AnswerEvent[], event: AnswerEvent): AnswerEvent[] {
  if (event.type === 'ai_status') {
    return [...current.filter((item) => item.type !== 'ai_status'), event];
  }
  if (event.type === 'ai_partial') {
    return [...current.filter((item) => item.type !== 'ai_status' && item.type !== 'ai_partial' && item.type !== 'ai_final' && item.type !== 'ai_rejected'), event];
  }
  if (AI_REPLACED.has(event.type)) {
    return [...current.filter((item) => !AI_REPLACED.has(item.type)), event];
  }
  return [...current, event];
}

/** Remove transient model progress after the user stops generation. */
export function cancelEvents(current: AnswerEvent[]): AnswerEvent[] {
  return current.filter((event) => event.type !== 'ai_status' && event.type !== 'ai_partial');
}

export function chatReducer(messages: ChatMessage[], event: AnswerEvent): ChatMessage[] {
  const last = messages.at(-1);
  if (!last || last.kind !== 'answer') return messages;
  return [...messages.slice(0, -1), { ...last, events: reduceEvents(last.events, event) }];
}
