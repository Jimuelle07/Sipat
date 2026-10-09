import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (value: unknown) => value },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));

import { hotlineStrings, topicLabel } from '../strings/hotlines';
import { hotlineErrorMessage, parseRecipients } from './HotlinesScreen';

describe('parseRecipients', () => {
  it('splits recipient lists on commas, semicolons, and new lines, trimming empty entries', () => {
    expect(parseRecipients(' 0917 123 4567,\n; 0928-123-4567 ; ')).toEqual(['0917 123 4567', '0928-123-4567']);
  });

  it('returns an empty list when no recipient was entered', () => {
    expect(parseRecipients(' , ; \n')).toEqual([]);
  });
});

describe('hotlineErrorMessage', () => {
  it('shows a clear message when the phone has no dialer', () => {
    expect(hotlineErrorMessage('no_dialer', 'native detail', hotlineStrings.tl.noDialer)).toBe(hotlineStrings.tl.noDialer);
  });

  it('uses the localized no-dialer copy', () => {
    expect(hotlineErrorMessage('no_dialer', 'native detail', 'The dialer cannot open on this phone.')).toBe('The dialer cannot open on this phone.');
  });

  it('preserves other engine result error messages', () => {
    expect(hotlineErrorMessage('not_found', 'Hindi makita ang hotline.', hotlineStrings.tl.noDialer)).toBe('Hindi makita ang hotline.');
  });
});

describe('guide topic labels', () => {
  it('provides a Tagalog label for the special out-of-guide topic', () => {
    expect(topicLabel('out_of_guide')).toBe('Wala sa gabay');
  });
});
