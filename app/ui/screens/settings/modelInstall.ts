import type { ModelInstallError, Result } from '../../../engine';

export type InstallState =
  | { kind: 'idle' }
  | { kind: 'copying'; bytes: number; total: number }
  | { kind: 'installed' }
  | { kind: 'closed' }
  | { kind: 'error'; code: ModelInstallError | 'unknown' };

export type InstallAction =
  | { type: 'start' }
  | { type: 'progress'; bytes: number; total: number }
  | { type: 'result'; result: Result<'installed' | null, ModelInstallError> }
  | { type: 'thrown' }
  | { type: 'reset' };

export function installReducer(state: InstallState, action: InstallAction): InstallState {
  switch (action.type) {
    case 'start':
      return { kind: 'copying', bytes: 0, total: 0 };
    case 'progress':
      return state.kind === 'copying'
        ? { kind: 'copying', bytes: action.bytes, total: action.total }
        : state;
    case 'result':
      if (!action.result.ok) return { kind: 'error', code: action.result.error.code };
      return action.result.value === 'installed' ? { kind: 'installed' } : { kind: 'closed' };
    case 'thrown':
      return { kind: 'error', code: 'unknown' };
    case 'reset':
      return { kind: 'idle' };
  }
}

export function progressFraction(state: InstallState): number {
  if (state.kind === 'installed') return 1;
  if (state.kind !== 'copying') return 0;
  if (state.total <= 0) return 0;
  return Math.min(1, Math.max(0, state.bytes / state.total));
}
