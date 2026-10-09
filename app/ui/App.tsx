import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import type { JSX } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootTabs } from './navigation/RootTabs';
import { EngineProvider } from './context/EngineProvider';
import { LanguageProvider } from './i18n';
import { PhaseTheme } from './context/PhaseTheme';
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
      <RootTabs />
    </NavigationContainer>
  );
}

export default function App(): JSX.Element {
  return (
    <SafeAreaProvider>
      <EngineProvider>
        <LanguageProvider>
          <PhaseTheme>
            <ThemedNavigation />
          </PhaseTheme>
        </LanguageProvider>
      </EngineProvider>
    </SafeAreaProvider>
  );
}
