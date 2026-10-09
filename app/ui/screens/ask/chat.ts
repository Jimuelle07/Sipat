import { fill } from '../../strings/format';

/**
 * Pure helpers for the Ask screen. No React or React Native imports, so the rules run in Node.
 * One `AnswerPlan` per question lives in the screen; these cover input guardrails and copy.
 */

/** A question is sendable when it is 1..maxLength characters once trimmed. */
export function canSend(question: string, maxLength: number): boolean {
  const text = question.trim();
  return text.length > 0 && text.length <= maxLength;
}

/** The `{count}/{max}` counter copy filled with the live length and the engine's max. */
export function counterText(template: string, count: number, max: number): string {
  return fill(template, { count, max });
}

/** The source ids from a final answer, de-duplicated and order-preserving. */
export function usedIds(used: readonly string[]): string[] {
  return [...new Set(used)];
}
