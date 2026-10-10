import type { JSX } from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Txt } from './Txt';

export interface TrackPoint { x: number; y: number }

const DOT_GAP = 9;
const MARKER = 40;
const FORECAST_DOT = 22;

/**
 * Map-free track view: home sits in the middle, the bagyo and PAGASA's forecast fixes sit around
 * it on a unit disc (x east, y south, radius 1 = `scaleLabel`). Points come pre-placed from the
 * engine's bearings and distances; this only draws them. Never shows an arrival time.
 */
export function StormTrack({ now, forecast, scaleLabel, northLabel, homeLabel, stormLabel, accessibilityLabel }: {
  now: TrackPoint;
  forecast: TrackPoint[];
  scaleLabel: string;
  northLabel: string;
  homeLabel: string;
  stormLabel: string;
  accessibilityLabel: string;
}): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [size, setSize] = useState(0);

  const half = size / 2;
  const radius = Math.max(0, half - MARKER / 2 - t.space.md);
  const at = (p: TrackPoint) => ({ left: half + p.x * radius, top: half + p.y * radius });

  // The path is drawn as small dots between consecutive fixes: no SVG dependency, crisp on any phone.
  const path = [now, ...forecast];
  const dots: { left: number; top: number }[] = [];
  for (let i = 1; i < path.length; i += 1) {
    const a = at(path[i - 1] as TrackPoint);
    const b = at(path[i] as TrackPoint);
    const steps = Math.max(1, Math.floor(Math.hypot(b.left - a.left, b.top - a.top) / DOT_GAP));
    for (let s = 1; s < steps; s += 1) {
      dots.push({ left: a.left + ((b.left - a.left) * s) / steps, top: a.top + ((b.top - a.top) * s) / steps });
    }
  }

  const ring = (fraction: number) => ({
    left: half - radius * fraction,
    top: half - radius * fraction,
    width: radius * 2 * fraction,
    height: radius * 2 * fraction,
  });

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={styles.box}
      onLayout={(event) => setSize(event.nativeEvent.layout.width)}
    >
      {size > 0 ? (
        <>
          <View style={[styles.ring, ring(1)]} />
          <View style={[styles.ring, styles.ringInner, ring(0.5)]} />
          <View style={[styles.axis, { left: half, top: half - radius, height: radius * 2, width: t.border.hairline }]} />
          <View style={[styles.axis, { top: half, left: half - radius, width: radius * 2, height: t.border.hairline }]} />
          <Txt role="caption" tone="muted" style={[styles.north, { left: half - 6, top: half - radius - t.space.xl }]}>{northLabel}</Txt>
          <Txt role="caption" tone="muted" style={[styles.scale, { left: half + radius * 0.71 + t.space.xs, top: half + radius * 0.71 }]}>{scaleLabel}</Txt>

          {dots.map((dot, index) => (
            <View key={`d${index}`} style={[styles.pathDot, { left: dot.left - 2, top: dot.top - 2 }]} />
          ))}

          <View style={[styles.marker, styles.home, { left: half - MARKER / 2, top: half - MARKER / 2 }]}>
            <Ionicons name="home" size={18} color={t.colors.highlight.ink} />
          </View>
          <Txt role="caption" style={[styles.markerLabel, { left: half - 40, top: half + MARKER / 2 + 2 }]}>{homeLabel}</Txt>

          {forecast.map((point, index) => {
            const p = at(point);
            return (
              <View key={`f${index}`} style={[styles.forecastDot, { left: p.left - FORECAST_DOT / 2, top: p.top - FORECAST_DOT / 2 }]}>
                <Txt role="caption" color={t.colors.surface} style={styles.forecastNumber}>{index + 1}</Txt>
              </View>
            );
          })}

          <View style={[styles.marker, styles.storm, { left: at(now).left - MARKER / 2, top: at(now).top - MARKER / 2 }]}>
            <Ionicons name="thunderstorm" size={20} color={t.colors.danger.ink} />
          </View>
          <Txt role="caption" style={[styles.markerLabel, { left: at(now).left - 40, top: at(now).top + MARKER / 2 + 2 }]}>{stormLabel}</Txt>
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  box: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: t.radius.panel,
    backgroundColor: t.colors.surfaceSunken,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderRadius: t.radius.pill,
    borderWidth: t.border.control,
    borderColor: t.colors.controlBorder,
    borderStyle: 'dashed',
  },
  ringInner: {
    borderColor: t.colors.hairline,
  },
  axis: {
    position: 'absolute',
    backgroundColor: t.colors.hairline,
  },
  north: {
    position: 'absolute',
    width: 12,
    textAlign: 'center',
  },
  scale: {
    position: 'absolute',
  },
  pathDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: t.colors.accentText,
  },
  forecastDot: {
    position: 'absolute',
    width: FORECAST_DOT,
    height: FORECAST_DOT,
    borderRadius: FORECAST_DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.accentText,
  },
  forecastNumber: {
    lineHeight: FORECAST_DOT,
  },
  marker: {
    position: 'absolute',
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: t.border.emphasis,
    borderColor: t.colors.stroke,
    boxShadow: t.shadow.sticker,
  },
  home: {
    backgroundColor: t.colors.highlight.fill,
  },
  storm: {
    backgroundColor: t.colors.danger.fill,
  },
  markerLabel: {
    position: 'absolute',
    width: 80,
    textAlign: 'center',
  },
});
