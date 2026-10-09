import type { JSX } from 'react';
import { useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { CropRect } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import type { RootNavigation, RootStackParamList } from '../navigation/types';
import { errorMessage } from '../strings/errors';
import { photoStrings } from '../strings/photo';
import { useLang, useT } from '../i18n';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Button, CropFrame, InlineError, Screen, Txt } from '../components';
import { draftIdToDiscard, INITIAL_PHOTO_FLOW, photoReducer } from './photo/photoFlow';
import type { PhotoStep } from './photo/photoFlow';

/** Big round "is this the right person?" preview with a glyph fallback when the URI cannot load. */
function CircularPreview({ uri, label }: { uri: string; label: string }): JSX.Element {
  const t = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [uri]);
  const size = t.minTouch * 4;

  return (
    <View
      style={[styles.previewCircle, { width: size, height: size, borderRadius: size / 2 }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {failed ? (
        <Ionicons name="person" size={size * 0.4} color={t.colors.textMuted} />
      ) : (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
      )}
    </View>
  );
}

/**
 * Required member photo: a portrait-studio world (dark scrim stage, a circular face guide in the
 * highlight colour) that walks choose → crop → confirm → saving → done. There is no skip; "Mamaya na"
 * discards the draft and leaves the member pending, and hardware Back does the same.
 */
export function PhotoScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'Photo'>>();
  const t = useT(photoStrings);
  const { lang } = useLang();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['family']);
  const [flow, dispatch] = useReducer(photoReducer, INITIAL_PHOTO_FLOW);
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const savingDraftRef = useRef<string | null>(null);

  const memberId = route.params.memberId;
  const member = engine.family.members().find((value) => value.id === memberId);
  const memberName = member?.name ?? t.memberFallback;
  const current = flow.current;
  const notice = flow.notice ? errorMessage(lang, flow.notice.source, flow.notice.code) : null;

  const startPhoto = async (source: 'camera' | 'gallery'): Promise<void> => {
    dispatch({ type: 'pick', source });
    const result = await engine.family.photos.start({ memberId }, source);
    dispatch({ type: 'started', result });
  };

  const retake = (): void => {
    const discardId = draftIdToDiscard(flow);
    if (discardId !== null) engine.family.photos.discard(discardId);
    dispatch({ type: 'confirm', yes: false });
  };

  const later = (): void => {
    const discardId = draftIdToDiscard(flow);
    dispatch({ type: 'later' });
    if (discardId !== null) engine.family.photos.discard(discardId);
    navigation.goBack();
  };

  // Hardware Back / swipe away behaves like "Mamaya na": discard the pending draft on the way out.
  useEffect(
    () => navigation.addListener('beforeRemove', () => {
      const discardId = draftIdToDiscard(flowRef.current);
      if (discardId !== null) engine.family.photos.discard(discardId);
    }),
    [navigation, engine],
  );

  // Entering saving runs the engine save once; the reducer decides where the result goes.
  useEffect(() => {
    const step = flow.current;
    if (step.step !== 'saving') return;
    if (savingDraftRef.current === step.draft.draftId) return;
    savingDraftRef.current = step.draft.draftId;
    let active = true;
    void engine.family.photos.save(step.draft.draftId, step.crop).then((result) => {
      if (active) dispatch({ type: 'saved', result });
    });
    return () => { active = false; };
  }, [engine, flow.current]);

  // A saved photo returns to the member.
  useEffect(() => {
    if (flow.current.step === 'done') navigation.goBack();
  }, [flow.current.step, navigation]);

  const adjust = (crop: CropRect): void => dispatch({ type: 'adjust', crop });

  const renderStep = (step: PhotoStep): JSX.Element => {
    switch (step.step) {
      case 'choose':
        return (
          <View style={styles.step}>
            <View style={styles.stage} accessible accessibilityRole="image" accessibilityLabel={t.previewLabel}>
              <View style={styles.scrimWash} pointerEvents="none" />
              <Ionicons name="person" size={theme.minTouch * 2} color={theme.colors.highlight.fill} />
              <View style={styles.guideRing} pointerEvents="none" />
            </View>
            <View style={styles.copy}>
              <Txt role="headline">{memberName}</Txt>
              <Txt role="body">{engine.copy('photo_required')}</Txt>
              <Txt role="bodySmall" tone="muted">{engine.copy('photo_consent')}</Txt>
            </View>
            <View style={styles.actions}>
              <Button label={t.camera} variant="highlight" icon="camera" onPress={() => { void startPhoto('camera'); }} fullWidth />
              <Button label={t.gallery} variant="tonal" icon="images-outline" onPress={() => { void startPhoto('gallery'); }} fullWidth />
            </View>
          </View>
        );
      case 'starting':
        return (
          <View style={styles.busy}>
            <ActivityIndicator color={theme.colors.accentText} />
            <Txt role="body" tone="muted">{t.starting}</Txt>
          </View>
        );
      case 'crop':
        return (
          <View style={styles.step}>
            <CropFrame
              previewUri={step.draft.previewUri}
              faces={step.draft.faces}
              crop={step.crop}
              onChange={adjust}
              hint={t.cropHint}
              zoomInLabel={t.zoomIn}
              zoomOutLabel={t.zoomOut}
            />
            <Button label={t.use} variant="highlight" icon="crop" onPress={() => dispatch({ type: 'accept' })} fullWidth />
          </View>
        );
      case 'confirm': {
        const prompt = errorMessage(lang, 'face_detection', 'confirm');
        return (
          <View style={styles.step}>
            <CircularPreview uri={step.draft.previewUri} label={t.previewLabel} />
            {prompt !== null ? <Txt role="title" align="center">{prompt}</Txt> : null}
            <View style={styles.actions}>
              <Button label={t.confirmYes} variant="highlight" icon="checkmark" onPress={() => dispatch({ type: 'confirm', yes: true })} fullWidth />
              <Button label={t.retake} variant="tonal" icon="refresh-outline" onPress={retake} fullWidth />
            </View>
          </View>
        );
      }
      case 'saving':
        return (
          <View style={styles.busy}>
            <ActivityIndicator color={theme.colors.accentText} />
            <Txt role="body" tone="muted">{t.saving}</Txt>
          </View>
        );
      case 'done':
        return (
          <View style={styles.busy}>
            <Ionicons name="checkmark-circle" size={theme.minTouch * 2} color={theme.colors.accentText} />
            <Txt role="title" align="center">{t.saved}</Txt>
          </View>
        );
      case 'closed':
      default:
        return <View style={styles.step} />;
    }
  };

  return (
    <Screen
      title={t.photoTitle}
      hideLanguage
      back={{ label: t.back, onPress: navigation.goBack }}
    >
      {notice !== null ? <InlineError message={notice} /> : null}
      {renderStep(current)}
      {current.step !== 'done' ? (
        <Button label={t.later} variant="text" onPress={later} accessibilityLabel={t.later} />
      ) : null}
    </Screen>
  );
}

const makeStyles = (t: Theme) => {
  const ring = t.minTouch * 3;
  return StyleSheet.create({
    step: { gap: t.space.lg },
    stage: {
      width: '100%',
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.radius.panel,
      overflow: 'hidden',
      backgroundColor: t.colors.surfaceSunken,
    },
    scrimWash: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: t.colors.scrim,
      opacity: t.scrimOpacity,
    },
    guideRing: {
      position: 'absolute',
      width: ring,
      height: ring,
      borderRadius: ring / 2,
      borderWidth: t.border.emphasis,
      borderColor: t.colors.highlight.fill,
    },
    copy: { gap: t.space.xs },
    actions: { gap: t.space.sm },
    busy: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space.md },
    previewCircle: {
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: t.colors.surfaceSunken,
      borderWidth: t.border.hairline,
      borderColor: t.colors.controlBorder,
    },
  });
};
