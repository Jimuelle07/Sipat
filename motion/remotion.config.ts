import { Config } from '@remotion/cli/config';

// PNG frames: no JPEG artifacts on flat pastel fields before the H.264 pass.
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
Config.setEntryPoint('./src/index.ts');
