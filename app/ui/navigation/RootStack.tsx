import { CommonActions, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { AboutScreen } from '../screens/AboutScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { ChecklistScreen } from '../screens/ChecklistScreen';
import { EmergencyScreen } from '../screens/EmergencyScreen';
import { EvaluationScreen } from '../screens/EvaluationScreen';
import { MemberCardScreen } from '../screens/MemberCardScreen';
import { MemberEditorScreen } from '../screens/MemberEditorScreen';
import { PassageScreen } from '../screens/PassageScreen';
import { PhotoScreen } from '../screens/PhotoScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SetupScreen } from '../screens/SetupScreen';
import { useEngine, useEngineChange } from '../context/useEngine';
import { useMinimalMotion } from '../theme';
import { RootTabs } from './RootTabs';
import type { RootNavigation, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootStack(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const minimalMotion = useMinimalMotion();
  const profilesRevision = useEngineChange(['profiles']);
  const previousProfile = useRef(engine.profiles.active());

  useEffect(() => {
    const currentProfile = engine.profiles.active();
    if (previousProfile.current !== null && currentProfile === null) {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Setup' }] }));
    }
    previousProfile.current = currentProfile;
  }, [engine, navigation, profilesRevision]);

  return (
    <Stack.Navigator
      initialRouteName={engine.profiles.active() === null ? 'Setup' : 'Tabs'}
      screenOptions={{
        headerShown: false,
        animation: minimalMotion ? 'fade' : 'slide_from_right',
      }}
    >
      <Stack.Screen name="Tabs" component={RootTabs} />
      <Stack.Screen name="Setup" component={SetupScreen} />
      <Stack.Screen name="MemberEditor" component={MemberEditorScreen} />
      <Stack.Screen name="Photo" component={PhotoScreen} />
      <Stack.Screen name="MemberCard" component={MemberCardScreen} />
      <Stack.Screen name="Checklist" component={ChecklistScreen} />
      <Stack.Screen name="Emergency" component={EmergencyScreen} />
      <Stack.Screen name="Passage" component={PassageScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Account" component={AccountScreen} />
      <Stack.Screen name="Evaluation" component={EvaluationScreen} />
    </Stack.Navigator>
  );
}
