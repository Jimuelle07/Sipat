// Starts the web preview with the demo seed on (docs/seed_data.md). Sets EXPO_PUBLIC_DEMO_SEED in
// Node so the same command works in PowerShell, cmd and POSIX shells. Extra arguments pass through
// to `expo start`, e.g. `npm run demo -- --port 8082`.
import { spawn } from 'node:child_process';

const child = spawn(['npx expo start --web', ...process.argv.slice(2)].join(' '), {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EXPO_PUBLIC_DEMO_SEED: '1' },
});
child.on('exit', (code) => process.exit(code ?? 0));
