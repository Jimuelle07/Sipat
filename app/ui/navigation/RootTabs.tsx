import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { JSX } from 'react';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '../components';
import { commonStrings } from '../strings/common';
import { useT } from '../i18n';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { AskScreen } from '../screens/AskScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { HotlinesScreen } from '../screens/HotlinesScreen';
import { GuideScreen } from '../screens/GuideScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

function TabGlyph({ name, color, focused }: { name: ComponentProps<typeof Ionicons>['name']; color: string; focused: boolean }): JSX.Element {
  const theme = useTheme();
  return (
    <View style={{
      width: 52,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.pill,
      borderWidth: focused ? theme.border.control : 0,
      borderColor: theme.colors.stickers.carbon,
      backgroundColor: focused ? theme.colors.wash : 'transparent',
    }}>
      <Ionicons name={name} color={color} size={22} />
    </View>
  );
}

export function RootTabs(): JSX.Element {
  const t = useT(commonStrings);
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.colors.stickers.carbon,
      tabBarInactiveTintColor: theme.colors.textMuted,
      tabBarItemStyle: { marginVertical: theme.space.xs },
      tabBarStyle: [styles.tabBar, {
        height: theme.minTouch + theme.type.roles.caption.lineHeight + theme.space.xxl,
        paddingBottom: theme.space.xs,
        paddingTop: theme.space.xs,
        marginBottom: insets.bottom + theme.space.md,
      }],
      tabBarLabel: ({ color, children }) => (
        <Txt role="caption" color={color} numberOfLines={1} style={styles.tabLabel}>{children}</Txt>
      ),
    }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t.tabHome, tabBarIcon: ({ color, focused }) => <TabGlyph name="home-outline" color={color} focused={focused} /> }} />
      <Tab.Screen name="Ask" component={AskScreen} options={{ title: t.tabAsk, tabBarIcon: ({ color, focused }) => <TabGlyph name="chatbubble-ellipses-outline" color={color} focused={focused} /> }} />
      <Tab.Screen name="Guide" component={GuideScreen} options={{ title: t.tabGuide, tabBarIcon: ({ color, focused }) => <TabGlyph name="book-outline" color={color} focused={focused} /> }} />
      <Tab.Screen name="Hotlines" component={HotlinesScreen} options={{ title: t.tabHotlines, tabBarIcon: ({ color, focused }) => <TabGlyph name="call-outline" color={color} focused={focused} /> }} />
      <Tab.Screen name="Family" component={ProfileScreen} options={{ title: t.tabProfile, tabBarIcon: ({ color, focused }) => <TabGlyph name="people-outline" color={color} focused={focused} /> }} />
    </Tab.Navigator>
  );
}

const makeStyles = (theme: Theme) => StyleSheet.create({
  tabLabel: { fontSize: 11, lineHeight: 20, paddingBottom: 2 },
  tabBar: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.space.gutter,
    marginBottom: theme.space.md,
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.stickers.carbon,
    borderWidth: theme.border.emphasis,
    borderTopWidth: theme.border.emphasis,
    elevation: 0,
    boxShadow: theme.shadow.float,
  },
});
