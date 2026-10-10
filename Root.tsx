import type { JSX, ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFonts } from 'expo-font';
import { BowlbyOne_400Regular } from '@expo-google-fonts/bowlby-one';
import { Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { LibreBaskerville_400Regular, LibreBaskerville_400Regular_Italic, LibreBaskerville_700Bold } from '@expo-google-fonts/libre-baskerville';
import App from './app/ui/App';
import palette from './assets/color-palette/palette.json';

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
const BEZEL = 10;

/**
 * On a wide web window the app is shown inside a fixed phone body (390 x 844 plus a bezel) on a
 * desk-coloured backdrop, so desktop reviewers see the real phone layout. On a phone-width window,
 * and on the device itself, the app fills the screen.
 */
function PhoneFrame({ children }: { children: ReactNode }): JSX.Element {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width <= PHONE_WIDTH + BEZEL * 2 + 40) return <>{children}</>;
  const frameHeight = Math.min(PHONE_HEIGHT, height - 48);
  return (
    <View style={styles.desk}>
      <View style={[styles.phone, { width: PHONE_WIDTH + BEZEL * 2, height: frameHeight + BEZEL * 2 }]}>
        <View style={styles.screen}>{children}</View>
      </View>
    </View>
  );
}

/** Fonts ship inside the app, so loading never touches the network. Renders once they are ready or failed. */
export default function Root(): JSX.Element | null {
  const [ready, error] = useFonts({ BowlbyOne_400Regular, Inter_500Medium, Inter_700Bold, LibreBaskerville_400Regular, LibreBaskerville_400Regular_Italic, LibreBaskerville_700Bold });
  return ready || error ? <PhoneFrame><App /></PhoneFrame> : null;
}

const styles = StyleSheet.create({
  desk: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.blue['200'],
  },
  phone: {
    padding: BEZEL,
    borderRadius: 54,
    backgroundColor: palette.blue['900'],
    boxShadow: [
      { offsetX: 0, offsetY: 30, blurRadius: 60, spreadDistance: -10, color: `${palette.blue['900']}66` },
      { offsetX: 0, offsetY: 6, blurRadius: 12, spreadDistance: 0, color: `${palette.blue['900']}40` },
    ],
  },
  // overflow hidden clips the absolute dock and floating header to the rounded glass.
  screen: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 44,
    backgroundColor: palette.blue['50'],
  },
});
