import type { JSX } from 'react';
import { Image, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFonts } from 'expo-font';
import { BowlbyOne_400Regular } from '@expo-google-fonts/bowlby-one';
import { Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { LibreBaskerville_400Regular, LibreBaskerville_400Regular_Italic, LibreBaskerville_700Bold } from '@expo-google-fonts/libre-baskerville';
import App from './app/ui/App';
import palette from './assets/color-palette/palette.json';
import frameArt from './assets/phone-frame-only.png';

const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
// assets/phone-frame-only.png is 1200 x 2364 with a 998 x 2162 screen opening at (101, 101), corners
// about 150 px and the island ending 121 px below the opening's top. Scaled so the opening is 390 dp wide.
const FRAME_SCALE = PHONE_WIDTH / 998;
const FRAME = { width: 1200 * FRAME_SCALE, height: 2364 * FRAME_SCALE, inset: 101 * FRAME_SCALE, radius: 150 * FRAME_SCALE };
const FRAME_INSETS = { top: 54, bottom: 20, left: 0, right: 0 };

/**
 * On a wide web window the app is shown inside the phone frame artwork on a desk-coloured backdrop,
 * so desktop reviewers see the real phone layout; the frame shrinks to fit short windows. On a
 * phone-width window, and on the device itself, the app fills the screen.
 */
function PhoneFrame(): JSX.Element {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width <= FRAME.width + 40) return <App />;
  const fit = Math.min(1, (height - 32) / FRAME.height);
  return (
    <View style={styles.desk}>
      <View style={{ width: FRAME.width, height: FRAME.height, transform: [{ scale: fit }] }}>
        <View style={[styles.screen, { left: FRAME.inset, top: FRAME.inset, width: PHONE_WIDTH, height: PHONE_HEIGHT, borderRadius: FRAME.radius }]}>
          <App insets={FRAME_INSETS} />
        </View>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={frameArt} style={styles.art} />
        </View>
      </View>
    </View>
  );
}

/** Fonts ship inside the app, so loading never touches the network. Renders once they are ready or failed. */
export default function Root(): JSX.Element | null {
  const [ready, error] = useFonts({ BowlbyOne_400Regular, Inter_500Medium, Inter_700Bold, LibreBaskerville_400Regular, LibreBaskerville_400Regular_Italic, LibreBaskerville_700Bold });
  return ready || error ? <PhoneFrame /> : null;
}

const styles = StyleSheet.create({
  desk: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.blue['200'],
  },
  // overflow hidden clips the absolute dock and floating header to the rounded glass.
  screen: {
    position: 'absolute',
    overflow: 'hidden',
    backgroundColor: palette.blue['50'],
  },
  art: { width: '100%', height: '100%', resizeMode: 'stretch' },
});
