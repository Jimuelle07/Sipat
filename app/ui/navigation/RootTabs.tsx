import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { JSX } from 'react';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '../components';
import { commonStrings } from '../strings/common';
import { useT } from '../i18n';
import { DockInsetContext } from '../context/DockInset';
import { SPRING } from '../motion/spring';
import { useMinimalMotion, useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { AskScreen } from '../screens/AskScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { HotlinesScreen } from '../screens/HotlinesScreen';
import { GuideScreen } from '../screens/GuideScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<keyof RootTabParamList, { off: IconName; on: IconName }> = {
  Home: { off: 'home-outline', on: 'home' },
  Ask: { off: 'chatbubble-ellipses-outline', on: 'chatbubble-ellipses' },
  Guide: { off: 'book-outline', on: 'book' },
  Hotlines: { off: 'call-outline', on: 'call' },
  Family: { off: 'people-outline', on: 'people' },
};

/** One dock slot: icon only at rest; the focused slot springs wider into a phase-coloured pill with its label. */
function DockItem({ name, title, focused, onPress, onLongPress }: {
  name: keyof RootTabParamList;
  title: string;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}): JSX.Element {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const minimal = useMinimalMotion();
  const grow = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (minimal) { grow.setValue(focused ? 1 : 0); return; }
    // flex is a layout prop, so this spring runs on the JS driver.
    Animated.spring(grow, { toValue: focused ? 1 : 0, useNativeDriver: false, ...SPRING.bouncy, damping: 13, stiffness: 190 }).start();
  }, [focused, minimal, grow]);

  const icon = ICONS[name];
  return (
    <Animated.View style={[styles.slot, { flexGrow: grow.interpolate({ inputRange: [0, 1], outputRange: [1, 2.7] }) }]}>
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={title}
        accessibilityState={{ selected: focused }}
        onPress={onPress}
        onLongPress={onLongPress}
        style={[styles.pill, focused && styles.pillOn]}
      >
        <Ionicons name={focused ? icon.on : icon.off} size={22} color={focused ? theme.colors.selected.ink : theme.colors.textMuted} />
        {focused ? (
          <Animated.View style={{ opacity: grow }}>
            <Txt role="label" color={theme.colors.selected.ink} numberOfLines={1}>{title}</Txt>
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function Dock({ state, descriptors, navigation, onHeight }: BottomTabBarProps & { onHeight: (height: number) => void }): JSX.Element {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom + theme.space.md }]} onLayout={(e) => onHeight(e.nativeEvent.layout.height)}>
      <View style={styles.dock}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          return (
            <DockItem
              key={route.key}
              name={route.name as keyof RootTabParamList}
              title={descriptors[route.key]?.options.title ?? route.name}
              focused={focused}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}

export function RootTabs(): JSX.Element {
  const t = useT(commonStrings);
  const [dockHeight, setDockHeight] = useState(0);

  return (
    <DockInsetContext.Provider value={dockHeight}>
    <Tab.Navigator tabBar={(props) => <Dock {...props} onHeight={setDockHeight} />} screenOptions={{ headerShown: false, tabBarStyle: { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 } }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t.tabHome }} />
      <Tab.Screen name="Ask" component={AskScreen} options={{ title: t.tabAsk }} />
      <Tab.Screen name="Guide" component={GuideScreen} options={{ title: t.tabGuide }} />
      <Tab.Screen name="Hotlines" component={HotlinesScreen} options={{ title: t.tabHotlines }} />
      <Tab.Screen name="Family" component={ProfileScreen} options={{ title: t.tabProfile }} />
    </Tab.Navigator>
    </DockInsetContext.Provider>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  // Absolute and transparent: the dock floats over the screen instead of sitting on a bar.
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: t.space.gutter,
    backgroundColor: 'transparent',
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.xs,
    padding: t.space.sm,
    borderRadius: t.radius.pill,
    borderWidth: t.border.control,
    borderColor: t.colors.stroke,
    backgroundColor: t.colors.surface,
    boxShadow: t.shadow.float,
  },
  slot: {
    flexBasis: 0,
    minWidth: t.minTouch,
  },
  pill: {
    height: t.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space.md,
    paddingHorizontal: t.space.md,
    borderRadius: t.radius.pill,
    borderWidth: t.border.control,
    borderColor: 'transparent',
  },
  pillOn: {
    backgroundColor: t.colors.wash,
    borderColor: t.colors.stroke,
    boxShadow: t.shadow.sticker,
  },
});
