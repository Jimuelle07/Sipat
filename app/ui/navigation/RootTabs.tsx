import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { JSX } from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commonStrings } from '../strings/common';
import { useT } from '../i18n';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { AskScreen } from '../screens/AskScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { HotlinesScreen } from '../screens/HotlinesScreen';
import { GuideScreen } from '../screens/GuideScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AccountScreen } from '../screens/AccountScreen';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

export function RootTabs(): JSX.Element {
  const t = useT(commonStrings);
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.colors.accentText,
      tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.label,
    }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t.tabHome, tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Ask" component={AskScreen} options={{ title: t.tabAsk, tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Guide" component={GuideScreen} options={{ title: t.tabGuide, tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Hotlines" component={HotlinesScreen} options={{ title: t.tabHotlines, tabBarIcon: ({ color, size }) => <Ionicons name="call-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Family" component={ProfileScreen} options={{ title: t.tabProfile, tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ title: t.tabAccount, tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  tabBar: {
    minHeight: theme.minTouch,
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.hairline,
    borderTopWidth: theme.border.hairline,
  },
  label: {
    fontSize: theme.type.roles.caption.fontSize,
    lineHeight: theme.type.roles.caption.lineHeight,
    fontWeight: theme.type.roles.caption.fontWeight,
    letterSpacing: theme.type.roles.caption.letterSpacing,
  },
});
