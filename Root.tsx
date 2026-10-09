import type { JSX } from 'react';
import { useFonts } from 'expo-font';
import { BowlbyOne_400Regular } from '@expo-google-fonts/bowlby-one';
import { Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import App from './app/ui/App';

/** Fonts ship inside the app, so loading never touches the network. Renders once they are ready or failed. */
export default function Root(): JSX.Element | null {
  const [ready, error] = useFonts({ BowlbyOne_400Regular, Inter_500Medium, Inter_700Bold });
  return ready || error ? <App /> : null;
}
