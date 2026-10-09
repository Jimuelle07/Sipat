import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import type { JSX } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EngineProvider } from './context/EngineProvider';
import { colors } from './theme';
import { RootTabs } from './navigation/RootTabs';
import { LanguageProvider } from './i18n';

const navigationTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, text: colors.text, primary: colors.accent },
};

export default function App(): JSX.Element {
  return (
    <SafeAreaProvider>
      <EngineProvider>
        <LanguageProvider>
          <NavigationContainer theme={navigationTheme}>
            <StatusBar style="light" />
            <RootTabs />
          </NavigationContainer>
        </LanguageProvider>
      </EngineProvider>
    </SafeAreaProvider>
  );
}
