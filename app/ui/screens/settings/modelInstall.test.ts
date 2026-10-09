import { describe, expect, it } from 'vitest';
import type { ModelInstallError, Result } from '../../../engine';
import type { InstallAction, InstallState } from './modelInstall';
import { installReducer, progressFraction } from './modelInstall';

const ERROR_CODES: ModelInstallError[] = [
  'tier',
  'no_space',
  'wrong_file',
  'hash_mismatch',
  'cancelled',
  'io',
];

const idle: InstallState = { kind: 'idle' };
const installed: InstallState = { kind: 'installed' };
const closed: InstallState = { kind: 'closed' };
const copying = (bytes: number, total: number): InstallState => ({ kind: 'copying', bytes, total });
const errored = (code: ModelInstallError | 'unknown'): InstallState => ({ kind: 'error', code });

const start: InstallAction = { type: 'start' };
const reset: InstallAction = { type: 'reset' };
const thrown: InstallAction = { type: 'thrown' };
const progress = (bytes: number, total: number): InstallAction => ({ type: 'progress', bytes, total });
const result = (value: Result<'installed' | null, ModelInstallError>): InstallAction => ({
  type: 'result',
  result: value,
});

const okInstalled: Result<'installed' | null, ModelInstallError> = { ok: true, value: 'installed' };
const okClosed: Result<'installed' | null, ModelInstallError> = { ok: true, value: null };
const fail = (code: ModelInstallError): Result<'installed' | null, ModelInstallError> => ({
  ok: false,
  error: { code, message: 'install failed' },
});

const ALL_STATES: { name: string; state: InstallState }[] = [
  { name: 'idle', state: idle },
  { name: 'copying', state: copying(1, 2) },
  { name: 'installed', state: installed },
  { name: 'closed', state: closed },
  { name: 'error', state: errored('io') },
];

const NON_COPYING_STATES: { name: string; state: InstallState }[] = [
  { name: 'idle', state: idle },
  { name: 'installed', state: installed },
  { name: 'closed', state: closed },
  { name: 'error', state: errored('no_space') },
];

describe('installReducer', () => {
  it.each(ALL_STATES)('start moves $name to copying with zero bytes and total', ({ state }) => {
    expect(installReducer(state, start)).toEqual(copying(0, 0));
  });

  it('records the bytes and total of a progress event while copying', () => {
    expect(installReducer(copying(0, 0), progress(250, 1000))).toEqual(copying(250, 1000));
  });

  it('replaces the copying bytes and total on a later progress event', () => {
    expect(installReducer(copying(250, 1000), progress(500, 1000))).toEqual(copying(500, 1000));
  });

  it.each(NON_COPYING_STATES)('ignores progress while $name', ({ state }) => {
    expect(installReducer(state, progress(250, 1000))).toEqual(state);
  });

  it('result ok installed moves to installed', () => {
    expect(installReducer(copying(999, 1000), result(okInstalled))).toEqual(installed);
  });

  it('result ok null moves to closed', () => {
    expect(installReducer(copying(1, 1000), result(okClosed))).toEqual(closed);
  });

  it.each(ERROR_CODES)('result error %s moves to error with that code', (code) => {
    expect(installReducer(copying(1, 1000), result(fail(code)))).toEqual(errored(code));
  });

  it('result error cancelled still moves to error with the cancelled code', () => {
    expect(installReducer(copying(1, 1000), result(fail('cancelled')))).toEqual(errored('cancelled'));
  });

  it.each(ALL_STATES)('thrown moves $name to error with the unknown code', ({ state }) => {
    expect(installReducer(state, thrown)).toEqual(errored('unknown'));
  });

  it.each(ALL_STATES)('reset moves $name to idle', ({ state }) => {
    expect(installReducer(state, reset)).toEqual(idle);
  });
});

describe('progressFraction', () => {
  it.each([
    { bytes: 0, total: 100, expected: 0 },
    { bytes: 25, total: 50, expected: 0.5 },
    { bytes: 50, total: 100, expected: 0.5 },
    { bytes: 100, total: 100, expected: 1 },
  ])('copying $bytes of $total is $expected', ({ bytes, total, expected }) => {
    expect(progressFraction(copying(bytes, total))).toBeCloseTo(expected, 9);
  });

  it.each([
    { bytes: -50, total: 100, expected: 0 },
    { bytes: 150, total: 100, expected: 1 },
    { bytes: 5, total: 0, expected: 0 },
    { bytes: 5, total: -10, expected: 0 },
    { bytes: 0, total: 0, expected: 0 },
  ])('copying $bytes of $total clamps to $expected', ({ bytes, total, expected }) => {
    expect(progressFraction(copying(bytes, total))).toBeCloseTo(expected, 9);
  });

  it('is 1 when installed', () => {
    expect(progressFraction(installed)).toBe(1);
  });

  it.each([
    { name: 'idle', state: idle },
    { name: 'closed', state: closed },
    { name: 'error', state: errored('io') },
  ])('is 0 for $name', ({ state }) => {
    expect(progressFraction(state)).toBe(0);
  });
});
