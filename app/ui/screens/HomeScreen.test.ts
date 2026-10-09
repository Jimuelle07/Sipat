import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (value: unknown) => value },
  Text: 'Text',
  View: 'View',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: vi.fn() }) }));

import type { WarningEntry } from '../../engine';
import { warningInput } from './HomeScreen';

const entry = (kind: WarningEntry['kind'], level: WarningEntry['level']): WarningEntry => ({
  id: `${kind}-${level}`,
  kind,
  level,
  label: 'Babala',
  meaning: 'Paliwanag mula sa gabay.',
  actions: [],
  source_id: 'source-test',
  confirmed: false,
});

describe('warningInput', () => {
  it('preserves each picker level and removes the sentinel level for gale', () => {
    expect(warningInput(entry('tcws', 3))).toEqual({ kind: 'tcws', level: 3 });
    expect(warningInput(entry('rainfall', 'orange'))).toEqual({ kind: 'rainfall', level: 'orange' });
    expect(warningInput(entry('surge', 'red'))).toEqual({ kind: 'surge', level: 'red' });
    expect(warningInput(entry('gale', 'on'))).toEqual({ kind: 'gale' });
  });
});
