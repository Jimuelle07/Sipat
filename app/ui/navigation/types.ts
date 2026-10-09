import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { TopicGroup } from '../../engine';

/** Five destinations fit a phone width; everything else is pushed on the root stack. */
export type RootTabParamList = {
  Home: undefined;
  Ask: undefined;
  Guide: { topic?: TopicGroup } | undefined;
  Hotlines: undefined;
  Family: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  Setup: undefined;                                  // first run: household and main person, photo, members, area
  MemberEditor: { memberId?: string };               // omit to add a member
  Photo: { memberId: string };                       // required photo; "Mamaya na" leaves the member pending
  MemberCard: { memberId: string };                  // "Hinahanap"
  Checklist: undefined;
  Emergency: { cardId?: string };
  Passage: { passageId: string };                    // "Saan galing ito?"
  Settings: undefined;
  About: undefined;
  Account: undefined;
  Evaluation: undefined;
};

export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
