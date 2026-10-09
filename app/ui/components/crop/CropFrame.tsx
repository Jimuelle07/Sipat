import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../theme';
import type { Theme } from '../../theme';
import { Txt } from '../Txt';
import { Button } from '../Button';
import { moveCrop, scaleCrop, toPixels } from './cropGeometry';
import type { Rect } from './cropGeometry';

/** Zoom-in shrinks the crop square (a smaller crop of the preview reads as closer). */
const ZOOM_IN = 0.85;
const ZOOM_OUT = 1 / ZOOM_IN;

export interface CropFrameProps {
  previewUri: string;
  /** previewWidth / previewHeight; the frame keeps the same ratio so the crop maps 1:1. Defaults to a square studio preview. */
  aspect?: number;
  crop: Rect;
  /** optional detected face boxes, relative to the preview. */
  faces?: Rect[];
  onChange: (crop: Rect) => void;
  hint: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  /** Called when the preview cannot be decoded (fixture URIs, missing files). */
  onError?: () => void;
}

/**
 * Draggable square-crop frame for a member face photo (Photo screen).
 * Shows the photo, dims everything outside the crop, guides the face with a circle
 * and reports crop changes through `onChange`; zoom is two outline buttons.
 * A preview that cannot load shows a sunken placeholder but keeps the crop UI working.
 */
export function CropFrame({
  previewUri,
  aspect,
  crop,
  faces,
  onChange,
  hint,
  zoomInLabel,
  zoomOutLabel,
  onError,
}: CropFrameProps): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const ratio = aspect ?? 1;
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [previewUri]);
  const layoutRef = useRef({ width: 0, height: 0 });
  const cropRef = useRef(crop);
  cropRef.current = crop;
  const startRef = useRef<Rect>(crop);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startRef.current = cropRef.current;
        },
        onPanResponderMove: (_event, gesture) => {
          const { width, height } = layoutRef.current;
          if (width === 0 || height === 0) return;
          onChange(moveCrop(startRef.current, gesture.dx / width, gesture.dy / height, ratio));
        },
      }),
    [ratio, onChange],
  );

  const onLayout = (event: LayoutChangeEvent): void => {
    const { width, height } = event.nativeEvent.layout;
    layoutRef.current = { width, height };
    setLayout({ width, height });
  };

  const ready = layout.width > 0 && layout.height > 0;
  const px = ready ? toPixels(crop, layout.width, layout.height) : null;
  const guideSize = px ? Math.min(px.width, px.height) * 0.68 : 0;

  return (
    <View style={styles.root}>
      <View
        style={[styles.frame, { aspectRatio: ratio }]}
        onLayout={onLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={hint}
        {...panResponder.panHandlers}
      >
        {failed ? (
          <View style={styles.placeholder}>
            <Ionicons name="person" size={t.minTouch} color={t.colors.textMuted} />
          </View>
        ) : (
          <Image
            source={{ uri: previewUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => { setFailed(true); onError?.(); }}
          />
        )}
        {px ? (
          <>
            <View pointerEvents="none" style={[styles.scrim, { left: 0, top: 0, right: 0, height: px.top }]} />
            <View pointerEvents="none" style={[styles.scrim, { left: 0, top: px.top + px.height, right: 0, bottom: 0 }]} />
            <View pointerEvents="none" style={[styles.scrim, { left: 0, top: px.top, width: px.left, height: px.height }]} />
            <View pointerEvents="none" style={[styles.scrim, { left: px.left + px.width, top: px.top, right: 0, height: px.height }]} />
          </>
        ) : null}
        {ready
          ? (faces ?? []).map((face, index) => {
              const box = toPixels(face, layout.width, layout.height);
              return (
                <View
                  key={index}
                  pointerEvents="none"
                  style={[styles.faceBox, { left: box.left, top: box.top, width: box.width, height: box.height }]}
                />
              );
            })
          : null}
        {px ? (
          <View
            pointerEvents="none"
            style={[
              styles.faceGuide,
              {
                left: px.left + px.width / 2 - guideSize / 2,
                top: px.top + px.height / 2 - guideSize / 2,
                width: guideSize,
                height: guideSize,
                borderRadius: guideSize / 2,
              },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.controls}>
        <Button
          variant="outline"
          icon="remove"
          label={zoomOutLabel}
          accessibilityLabel={zoomOutLabel}
          onPress={() => onChange(scaleCrop(crop, ZOOM_OUT, ratio))}
        />
        <Button
          variant="outline"
          icon="add"
          label={zoomInLabel}
          accessibilityLabel={zoomInLabel}
          onPress={() => onChange(scaleCrop(crop, ZOOM_IN, ratio))}
        />
      </View>
      <Txt role="bodySmall" tone="muted">{hint}</Txt>
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  root: { gap: t.space.lg },
  frame: { width: '100%', borderRadius: t.radius.media, overflow: 'hidden', backgroundColor: t.colors.surfaceSunken },
  placeholder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.colors.surfaceSunken,
  },
  scrim: { position: 'absolute', backgroundColor: t.colors.scrim, opacity: t.scrimOpacity },
  faceBox: { position: 'absolute', borderWidth: t.border.control, borderColor: t.colors.focus, borderRadius: t.radius.media },
  faceGuide: { position: 'absolute', borderWidth: t.border.emphasis, borderColor: t.colors.highlight.fill },
  controls: { flexDirection: 'row', gap: t.space.lg },
})
