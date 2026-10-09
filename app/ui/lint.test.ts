import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const eslint = new ESLint({ cwd: root });

async function boundaryMessages(code: string, file = 'app/ui/screens/Fake.tsx'): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.resolve(root, file) });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === 'bagyo/ui-boundary' || message.ruleId === 'no-restricted-imports')
    .map((message) => message.message);
}

describe('app/ui import boundary', () => {
  it.each([
    ["import { x } from '../../core/search';", 'core imports'],
    ["import { s } from '../../services/store';", 'service imports'],
    ["import type { Phase } from '../../types';", 'type imports'],
    ["import type { Engine } from '../../types/engine';", 'deep type imports'],
    ["import { createMockEngine } from '../../engine/mock';", 'deep engine imports'],
    ["import c from '../../content';", 'content imports'],
    ["export * from '../../types';", 'star re-exports'],
    ["export { x } from '../../core/route';", 'named re-exports'],
    ["const m = require('../../core/x');", 'require calls'],
    ["const m = await import('../../services/model');", 'dynamic imports'],
    ["type T = import('../../types').Phase;", 'import types'],
  ])('rejects %s (%s)', async (code) => {
    expect(await boundaryMessages(code)).not.toHaveLength(0);
  });

  it.each([
    'react-native-mmkv',
    'llama.rn',
    'expo-battery',
    'expo-device',
    'expo-image-picker',
    'expo-image-manipulator',
    'expo-document-picker',
    'expo-file-system',
    'expo-sharing',
    'expo-location',
    'expo-status-bar',
    'expo-font',
    'expo',
    'react-native-view-shot',
    '@react-native-ml-kit/face-detection',
    '@react-native-async-storage/async-storage',
  ])('rejects native package %s', async (specifier) => {
    expect(await boundaryMessages(`import value from '${specifier}';`)).not.toHaveLength(0);
  });

  it.each(['NativeModules', 'TurboModuleRegistry'])(
    'rejects %s from react-native',
    async (name) => {
      expect(await boundaryMessages(`import { ${name} } from 'react-native';`)).not.toHaveLength(0);
    },
  );

  it.each([
    ["import type { Phase } from '../../engine';", 'engine barrel types'],
    ["import { createEngine } from '../../engine/index';", 'engine index barrel'],
    ["import type { RootTabParamList } from '../navigation/types';", 'UI-local types'],
    ["import { View } from 'react-native';", 'React Native views'],
    ["import { Ionicons } from '@expo/vector-icons';", 'Expo vector icons'],
    ["import { SafeAreaView } from 'react-native-safe-area-context';", 'safe area context'],
    ["import { NavigationContainer } from '@react-navigation/native';", 'navigation'],
    ["import { enableScreens } from 'react-native-screens';", 'screens'],
  ])('allows %s (%s)', async (code) => {
    expect(await boundaryMessages(code)).toHaveLength(0);
  });

  it('allows the palette asset import from the theme directory', async () => {
    expect(await boundaryMessages(
      "import palette from '../../../assets/color-palette/palette.json';",
      'app/ui/theme/palette.ts',
    )).toHaveLength(0);
  });

  it('does not apply the UI boundary to engine files', async () => {
    expect(await boundaryMessages("import { x } from '../core/search';", 'app/engine/Fake.ts')).toHaveLength(0);
  });
});
