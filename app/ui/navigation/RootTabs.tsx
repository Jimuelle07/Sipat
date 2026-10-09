import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { JSX } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { strings } from '../strings';
import { useT } from '../i18n';
import { AskScreen } from '../screens/AskScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { HotlinesScreen } from '../screens/HotlinesScreen';
import { GuideScreen } from '../screens/GuideScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import type { RootTabParamList } from './types';
import { colors } from '../theme';

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootTabs(): JSX.Element {
  const t = useT(strings);
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 58 }, tabBarLabelStyle: { fontSize: 12 } }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t.tabHome, tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Ask" component={AskScreen} options={{ title: t.tabAsk, tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Guide" component={GuideScreen} options={{ title: t.tabGuide, tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Hotlines" component={HotlinesScreen} options={{ title: t.tabHotlines, tabBarIcon: ({ color, size }) => <Ionicons name="call-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Family" component={ProfileScreen} options={{ title: t.tabProfile, tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}
