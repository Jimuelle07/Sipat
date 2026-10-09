import { errorMessage } from '../../strings/errors';

export type SetupStep = 'household' | 'ownerPhoto' | 'members' | 'area' | 'done';

export const SETUP_ORDER: readonly SetupStep[] = ['household', 'ownerPhoto', 'members', 'area', 'done'];

const NEXT: Record<SetupStep, SetupStep> = {
  household: 'ownerPhoto',
  ownerPhoto: 'members',
  members: 'area',
  area: 'done',
  done: 'done',
};

const PREVIOUS: Record<SetupStep, SetupStep | null> = {
  household: null,
  ownerPhoto: null,
  members: 'household',
  area: 'members',
  done: 'area',
};

export function nextStep(step: SetupStep): SetupStep {
  return NEXT[step];
}

export function previousStep(step: SetupStep): SetupStep | null {
  return PREVIOUS[step];
}

export function stepIndex(step: SetupStep): number {
  return SETUP_ORDER.indexOf(step);
}

export function fieldErrors(
  lang: 'tl' | 'en',
  errors: { code: string; field: string }[],
): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const { code, field } of errors) {
    if (field in messages) continue;
    const message = errorMessage(lang, 'validation', code);
    if (message !== null) messages[field] = message;
  }
  return messages;
}
