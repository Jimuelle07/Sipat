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
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: () => undefined, goBack: () => undefined }),
  useRoute: () => ({ params: undefined }),
}));
vi.mock('../context/AppChrome', () => ({
  AppBanners: () => null,
  StatusBadges: () => null,
}));

import type { TopicGroup } from '../../engine';
import { goBack } from './GuideScreen';
import type { GuideView } from './GuideScreen';
import { guideStrings, guideTopicLabels } from '../strings/guide';
import { fill } from '../strings/format';

const TOPICS: TopicGroup[] = [
  'signals', 'go_bag', 'home_prep', 'evacuation', 'flood', 'surge', 'landslide', 'infant', 'senior',
  'pregnancy', 'disability', 'pets', 'water_food', 'electrical', 'generator_fire', 'gas_safety',
  'cleanup', 'health_after_flood', 'first_aid', 'psychosocial', 'damage_report', 'assistance', 'out_of_guide',
];

describe('goBack', () => {
  it('steps from a topic list back to the topic grid', () => {
    expect(goBack({ kind: 'topic', topic: 'flood' })).toEqual({ kind: 'topics' });
  });

  it('stays on the topic grid when already at the root', () => {
    expect(goBack({ kind: 'topics' })).toEqual({ kind: 'topics' });
  });

  it('loses the topic while returning to the grid', () => {
    const view: GuideView = { kind: 'topic', topic: 'senior' };
    expect(goBack(view)).toEqual({ kind: 'topics' });
  });
});

describe('guide topic labels', () => {
  it('has a non-empty Tagalog and English label for every topic', () => {
    for (const topic of TOPICS) {
      expect(guideTopicLabels.tl[topic].length).toBeGreaterThan(0);
      expect(guideTopicLabels.en[topic].length).toBeGreaterThan(0);
    }
  });

  it('translates the labels in English mode', () => {
    expect(guideTopicLabels.tl.signals).toBe('Mga signal');
    expect(guideTopicLabels.en.signals).toBe('Signals');
    expect(guideTopicLabels.en.out_of_guide).toBe('Not in the guide');
  });
});

describe('guide strings', () => {
  it('shows the English note about Filipino guide text in both modes', () => {
    expect(guideStrings.tl.englishNote).toBe('Official guide text is in Filipino.');
    expect(guideStrings.en.englishNote).toBe('Official guide text is in Filipino.');
  });

  it('fills the reviewer line from the passaged reviewer and date', () => {
    expect(fill(guideStrings.tl.reviewedLine, { name: 'SAMPLE Reviewer A', date: '2026-10-09' }))
      .toBe('Sinuri ni SAMPLE Reviewer A noong 2026-10-09');
  });
});
