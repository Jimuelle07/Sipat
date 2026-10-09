import type { PinnedKey } from '../types/index.ts';

/**
 * Root public keys compiled into the app. A manifest or key set is trusted only
 * when its chain ends at one of these (docs/api-layer.md section 10).
 *
 * Empty on purpose: paste the real root public key here from `scripts/keygen.ts`
 * output once the root key exists.
 */
export const PINNED_ROOT_KEYS: PinnedKey[] = [];
