import { Composition } from 'remotion';
import { SipatShowreel30 } from './Showreel';
import { DURATION } from './timeline';
import { LANDSCAPE, PORTRAIT } from './layout';

export function RemotionRoot() {
  return (
    <>
      <Composition id="SipatShowreel30" component={SipatShowreel30} defaultProps={{ orientation: 'landscape' as const }} durationInFrames={DURATION} fps={60} width={LANDSCAPE.W} height={LANDSCAPE.H} />
      <Composition id="SipatShowreel30Vertical" component={SipatShowreel30} defaultProps={{ orientation: 'portrait' as const }} durationInFrames={DURATION} fps={60} width={PORTRAIT.W} height={PORTRAIT.H} />
    </>
  );
}
