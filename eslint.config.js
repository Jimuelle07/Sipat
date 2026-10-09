import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

const root = path.dirname(fileURLToPath(import.meta.url));
const slash = (value) => value.replaceAll('\\', '/');
const normalize = (value) => {
  const normalized = slash(path.normalize(value));
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
};

function isInside(target, directory) {
  return target === directory || target.startsWith(`${directory}/`);
}

function packageName(specifier) {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
}

function isNativePackage(specifier) {
  const name = packageName(specifier);
  if (name === 'react-native-mmkv' || name === 'llama.rn' || name === 'expo' || name.startsWith('expo-')) return true;
  if (name.startsWith('@expo/')) return name !== '@expo/vector-icons';
  if (name.startsWith('react-native-')) {
    return !['react-native-safe-area-context', 'react-native-screens', 'react-native-web'].includes(name);
  }
  return /^@react-native-[^/]+\//.test(specifier) || /^@react-native\/[^/]+/.test(specifier);
}

const boundaryRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Keep app/ui imports behind the app/engine facade' },
    schema: [],
    messages: {
      appPath: 'app/ui may import only the app/engine barrel, not {{specifier}}.',
      native: 'Native module {{specifier}} is owned by the engine.',
    },
  },
  create(context) {
    const blockedDirectories = ['core', 'services', 'types', 'content']
      .map((name) => normalize(path.join(root, 'app', name)));
    const engineRoot = normalize(path.join(root, 'app', 'engine'));

    function check(node, specifier) {
      if (typeof specifier !== 'string') return;
      if (specifier.startsWith('.')) {
        const target = normalize(path.resolve(path.dirname(context.filename), specifier));
        if (blockedDirectories.some((directory) => isInside(target, directory))) {
          context.report({ node, messageId: 'appPath', data: { specifier } });
          return;
        }
        if (isInside(target, engineRoot)) {
          const relative = target.slice(engineRoot.length).replace(/^\//, '');
          if (relative !== '' && relative !== 'index' && relative !== 'index.ts') {
            context.report({ node, messageId: 'appPath', data: { specifier } });
            return;
          }
        }
        return;
      }
      if (isNativePackage(specifier)) {
        context.report({ node, messageId: 'native', data: { specifier } });
      }
    }

    return {
      ImportDeclaration(node) { check(node, node.source.value); },
      ExportNamedDeclaration(node) { if (node.source) check(node, node.source.value); },
      ExportAllDeclaration(node) { if (node.source) check(node, node.source.value); },
      ImportExpression(node) { check(node, node.source.value); },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require' && node.arguments[0]?.type === 'Literal') {
          check(node, node.arguments[0].value);
        }
      },
      TSImportEqualsDeclaration(node) {
        if (node.moduleReference.type === 'TSExternalModuleReference' && node.moduleReference.expression.type === 'Literal') {
          check(node, node.moduleReference.expression.value);
        }
      },
      TSImportType(node) {
        check(node, node.source.value);
      },
    };
  },
};

const config = [
  { ignores: ['**/node_modules/**', '**/.expo/**', '**/dist/**'] },
  {
    files: ['app/ui/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    plugins: { bagyo: { rules: { 'ui-boundary': boundaryRule } } },
    rules: {
      'bagyo/ui-boundary': 'error',
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'react-native',
          importNames: ['NativeModules', 'TurboModuleRegistry', 'requireNativeComponent'],
          message: 'Native modules are owned by the engine.',
        }],
      }],
    },
  },
];

export default config;
