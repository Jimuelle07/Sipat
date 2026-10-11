import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import type { JSX } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { RootStack } from './navigation/RootStack';
import { EngineProvider } from './context/EngineProvider';
import { LanguageProvider } from './i18n';
import { PhaseTheme } from './context/PhaseTheme';
import { DevOverridesProvider } from './context/AppChrome';
import { DevPanel, DevPanelProvider } from './context/DevPanel';
import { useTheme } from './theme';

function ThemedNavigation(): JSX.Element {
  const theme = useTheme();
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: theme.colors.canvas,
      card: theme.colors.surface,
      text: theme.colors.text,
      primary: theme.colors.accentText,
      border: theme.colors.hairline,
      notification: theme.colors.danger.fill,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar
        barStyle={theme.scheme === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={theme.colors.canvas}
      />
      <RootStack />
      <DevPanel global />
    </NavigationContainer>
  );
}

/** `insets` overrides the measured safe area: the web phone frame passes its notch and home-bar space. */
export default function App({ insets }: { insets?: EdgeInsets } = {}): JSX.Element {
  const tree = (
      <EngineProvider>
        <LanguageProvider>
          <DevOverridesProvider>
            <PhaseTheme>
              <DevPanelProvider>
                <ThemedNavigation />
              </DevPanelProvider>
            </PhaseTheme>
          </DevOverridesProvider>
        </LanguageProvider>
      </EngineProvider>
  );
  return (
    <SafeAreaProvider>
      {insets ? <SafeAreaInsetsContext.Provider value={insets}>{tree}</SafeAreaInsetsContext.Provider> : tree}
    </SafeAreaProvider>
  );
}
