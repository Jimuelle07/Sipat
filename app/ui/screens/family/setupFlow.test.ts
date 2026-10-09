import { describe, expect, it } from 'vitest';
import { errorMessage } from '../../strings/errors';
import { SETUP_ORDER, fieldErrors, nextStep, previousStep, stepIndex } from './setupFlow';

describe('SETUP_ORDER', () => {
  it('lists the wizard steps in the order a person walks them', () => {
    expect(SETUP_ORDER).toEqual(['household', 'ownerPhoto', 'members', 'area', 'done']);
  });

  it('has no duplicate steps', () => {
    expect(new Set(SETUP_ORDER).size).toBe(SETUP_ORDER.length);
  });
});

describe('nextStep', () => {
  it.each([
    ['household', 'ownerPhoto'],
    ['ownerPhoto', 'members'],
    ['members', 'area'],
    ['area', 'done'],
  ] as const)('advances from %s to %s', (step, expected) => {
    expect(nextStep(step)).toBe(expected);
  });

  it('stays on done at the end of the wizard', () => {
    expect(nextStep('done')).toBe('done');
  });
});

describe('previousStep', () => {
  it.each([
    ['household', null],
    ['ownerPhoto', null],
    ['members', 'household'],
    ['area', 'members'],
    ['done', 'area'],
  ] as const)('goes back from %s to %s', (step, expected) => {
    expect(previousStep(step)).toBe(expected);
  });

  it('offers no way back from household, the first step', () => {
    expect(previousStep('household')).toBeNull();
  });

  it('offers no way back from ownerPhoto, because the household already exists', () => {
    expect(previousStep('ownerPhoto')).toBeNull();
  });
});

describe('stepIndex', () => {
  it.each([
    ['household', 0],
    ['ownerPhoto', 1],
    ['members', 2],
    ['area', 3],
    ['done', 4],
  ] as const)('places %s at position %i', (step, expected) => {
    expect(stepIndex(step)).toBe(expected);
  });

  it('matches the position in SETUP_ORDER for every step', () => {
    SETUP_ORDER.forEach((step, index) => {
      expect(stepIndex(step)).toBe(index);
    });
  });

  it('increases by one on every step forward', () => {
    SETUP_ORDER.slice(0, -1).forEach((step) => {
      expect(stepIndex(nextStep(step))).toBe(stepIndex(step) + 1);
    });
  });
});

describe('fieldErrors', () => {
  it('maps a known validation code to its message, keyed by field path', () => {
    expect(fieldErrors('tl', [{ code: 'name_required', field: 'owner.name' }])).toEqual({
      'owner.name': errorMessage('tl', 'validation', 'name_required'),
    });
  });

  it('uses the language it is asked for', () => {
    expect(fieldErrors('en', [{ code: 'too_long', field: 'name' }])).toEqual({
      name: errorMessage('en', 'validation', 'too_long'),
    });
  });

  it('falls back to the generic message for an unknown code', () => {
    const generic = errorMessage('tl', 'validation', 'this_code_does_not_exist');
    expect(generic).toBeTypeOf('string');
    expect(fieldErrors('tl', [{ code: 'this_code_does_not_exist', field: 'name' }])).toEqual({
      name: generic,
    });
  });

  it('keeps the first error reported for a field', () => {
    expect(
      fieldErrors('tl', [
        { code: 'name_required', field: 'owner.name' },
        { code: 'too_long', field: 'owner.name' },
      ]),
    ).toEqual({ 'owner.name': errorMessage('tl', 'validation', 'name_required') });
  });

  it('returns one message per distinct field', () => {
    expect(
      fieldErrors('tl', [
        { code: 'name_required', field: 'name' },
        { code: 'pets_range', field: 'petsCount' },
        { code: 'contact_phone_invalid', field: 'plan.contacts.0.phone' },
      ]),
    ).toEqual({
      name: errorMessage('tl', 'validation', 'name_required'),
      petsCount: errorMessage('tl', 'validation', 'pets_range'),
      'plan.contacts.0.phone': errorMessage('tl', 'validation', 'contact_phone_invalid'),
    });
  });

  it('returns an empty record when there are no errors', () => {
    expect(fieldErrors('tl', [])).toEqual({});
  });

  it('produces one message per field in every language', () => {
    const errors: { code: string; field: string }[] = [
      { code: 'owner_relation', field: 'member.relation' },
      { code: 'too_many_members', field: 'member' },
    ];
    for (const lang of ['tl', 'en'] as const) {
      expect(fieldErrors(lang, errors)).toEqual({
        'member.relation': errorMessage(lang, 'validation', 'owner_relation'),
        member: errorMessage(lang, 'validation', 'too_many_members'),
      });
    }
  });

  it('accepts every step as a value without throwing', () => {
    for (const step of SETUP_ORDER) {
      const result = fieldErrors('tl', [{ code: 'too_long', field: step }]);
      expect(result[step]).toBe(errorMessage('tl', 'validation', 'too_long'));
    }
  });
});
