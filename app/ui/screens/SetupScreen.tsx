import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootNavigation } from '../navigation/types';
import type { AgeGroup, MemberInput, NeedTag } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { Button, Chip, Field, MemberAvatar, Screen, Tile, Txt } from '../components';
import { useLang, useT } from '../i18n';
import { commonStrings } from '../strings/common';
import { setupStrings } from '../strings/setup';
import { useMinimalMotion, useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { SETUP_ORDER, fieldErrors, nextStep, previousStep, stepIndex } from './family/setupFlow';
import type { SetupStep } from './family/setupFlow';
import { AreaPicker } from './family/AreaPicker';
import { initialsOf } from './family/profileModel';

const AGE_GROUPS = ['infant', 'child', 'teen', 'adult', 'senior'] as const satisfies readonly AgeGroup[];
const NEED_TAGS = ['pregnant', 'pwd', 'maintenance_meds'] as const satisfies readonly NeedTag[];

function pick(copy: object, key: string): string {
  return (copy as Record<string, string>)[key] ?? key;
}

/**
 * First-run wizard: household and main person, the required owner photo, the member list,
 * the home area and a warm closing. It owns the whole screen until it resets the stack to
 * the tabs; there is no back to the tabs before the household exists.
 */
export function SetupScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const t = useT(setupStrings);
  const common = useT(commonStrings);
  const { lang } = useLang();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['profiles', 'family']);

  const [step, setStep] = useState<SetupStep>('household');
  const [householdName, setHouseholdName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerAge, setOwnerAge] = useState<AgeGroup>('adult');
  const [ownerNeeds, setOwnerNeeds] = useState<NeedTag[]>([]);
  const [ownerPhone, setOwnerPhone] = useState('');
  const [errors, setErrors] = useState<{ code: string; field: string }[]>([]);

  const profile = engine.profiles.active();
  const members = engine.family.members();
  const owner = profile ? members.find((member) => member.id === profile.ownerId) : undefined;
  const messages = fieldErrors(lang, errors);

  const createHousehold = (): void => {
    const ownerInput: MemberInput = {
      name: ownerName.trim(),
      relation: 'self',
      ageGroup: ownerAge,
      needs: [...ownerNeeds],
    };
    const phone = ownerPhone.trim();
    if (phone.length > 0) ownerInput.phone = phone;

    if (profile) {
      const ownerResult = engine.family.saveMember({ ...ownerInput, id: profile.ownerId });
      if (!ownerResult.ok) {
        setErrors(ownerResult.errors);
        return;
      }
      const saveResult = engine.profiles.save({
        id: profile.id,
        name: householdName,
        petsCount: profile.petsCount,
        home: profile.home,
        plan: profile.plan,
      });
      if (!saveResult.ok) {
        setErrors(saveResult.errors);
        return;
      }
      setErrors([]);
      setStep((current) => nextStep(current));
      return;
    }

    const result = engine.profiles.create({ name: householdName, owner: ownerInput });
    if (result.ok) {
      setErrors([]);
      setStep((current) => nextStep(current));
    } else {
      setErrors(result.errors);
    }
  };

  const goBack = (): void => {
    const previous = previousStep(step);
    if (previous !== null) setStep(previous);
  };

  const content = ((): JSX.Element => {
    switch (step) {
      case 'household':
        return (
          <Tile title={t.householdTitle} subtitle={t.householdBody}>
            <Field
              label={common.householdName}
              value={householdName}
              onChangeText={setHouseholdName}
              error={messages['name']}
            />
            <Field
              label={common.personName}
              value={ownerName}
              onChangeText={setOwnerName}
              error={messages['owner.name'] ?? messages['member.name']}
            />
            <Txt role="label">{common.ageGroup}</Txt>
            <View style={styles.chips}>
              {AGE_GROUPS.map((item) => (
                <Chip
                  key={item}
                  label={pick(common, `age_${item}`)}
                  selected={ownerAge === item}
                  onPress={() => setOwnerAge(item)}
                />
              ))}
            </View>
            <Txt role="label">{common.needs}</Txt>
            <View style={styles.chips}>
              {NEED_TAGS.map((item) => (
                <Chip
                  key={item}
                  label={pick(common, `need_${item}`)}
                  selected={ownerNeeds.includes(item)}
                  onPress={() => setOwnerNeeds((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item])}
                />
              ))}
            </View>
            <Field
              label={t.phoneOptional}
              value={ownerPhone}
              onChangeText={setOwnerPhone}
              keyboardType="phone-pad"
              error={messages['owner.phone'] ?? messages['member.phone']}
            />
            <Button label={t.continue} onPress={createHousehold} icon="arrow-forward" />
          </Tile>
        );

      case 'ownerPhoto':
        return (
          <Tile title={t.ownerPhotoTitle} subtitle={t.ownerPhotoBody}>
            <View style={styles.ownerRow}>
              <MemberAvatar
                photoUri={owner?.photo?.uri}
                initials={initialsOf(owner?.name ?? '')}
                size={theme.space.xxxl}
                pending={owner?.photoStatus === 'pending'}
                pendingLabel={t.photoPending}
              />
              <Txt role="bodySmall" tone="muted" style={styles.ownerName}>{owner?.name ?? ''}</Txt>
            </View>
            <Button
              label={t.takePhoto}
              variant="highlight"
              icon="camera"
              onPress={() => { if (owner) navigation.navigate('Photo', { memberId: owner.id }); }}
            />
            <Button
              label={owner?.photoStatus === 'done' ? t.continue : t.later}
              variant="text"
              onPress={() => setStep((current) => nextStep(current))}
            />
          </Tile>
        );

      case 'members':
        return (
          <Tile title={t.membersTitle} subtitle={t.membersBody}>
            {members.map((member) => (
              <View key={member.id} style={styles.memberRow}>
                <MemberAvatar
                  photoUri={member.photo?.uri}
                  initials={initialsOf(member.name)}
                  size={theme.space.xxl}
                  pending={member.photoStatus === 'pending'}
                  pendingLabel={t.photoPending}
                />
                <Txt role="body" style={styles.memberName} numberOfLines={1}>{member.name}</Txt>
              </View>
            ))}
            <Button label={t.addMember} variant="tonal" icon="add" onPress={() => navigation.navigate('MemberEditor', {})} />
            <Button label={t.continue} onPress={() => setStep((current) => nextStep(current))} icon="arrow-forward" />
          </Tile>
        );

      case 'area':
        return (
          <Tile title={t.areaTitle} subtitle={t.areaBody}>
            <AreaPicker onPicked={() => setStep((current) => nextStep(current))} />
            <Button label={t.skip} variant="text" onPress={() => setStep((current) => nextStep(current))} />
          </Tile>
        );

      case 'done':
        return (
          <Tile title={t.doneTitle} subtitle={t.doneBody}>
            <Button
              label={t.start}
              variant="highlight"
              icon="arrow-forward"
              onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })}
            />
          </Tile>
        );
    }
  })();

  const dots = SETUP_ORDER.length;
  const active = stepIndex(step);

  return (
    <Screen title={t.screenTitle}>
      <Txt role="body" tone="muted">{t.intro}</Txt>
      <ProgressDots count={dots} index={active} label={t.progressLabel} />
      <StepBody step={step} styles={styles}>{content}</StepBody>
      {previousStep(step) !== null ? (
        <Button label={t.back} variant="text" onPress={goBack} />
      ) : null}
    </Screen>
  );
}

function StepBody({ step, styles, children }: { step: SetupStep; styles: ReturnType<typeof makeStyles>; children: JSX.Element }): JSX.Element {
  const theme = useTheme();
  const minimal = useMinimalMotion();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: minimal ? theme.motion.fast : theme.motion.base,
      easing: Easing.bezier(...theme.motion.enter),
      useNativeDriver: true,
    }).start();
  }, [step, minimal, theme.motion.fast, theme.motion.base, theme.motion.enter, opacity]);

  return <Animated.View style={[styles.step, { opacity }]}>{children}</Animated.View>;
}

function ProgressDots({ count, index, label }: { count: number; index: number; label: string }): JSX.Element {
  const styles = useThemedStyles(makeStyles);
  return (
    <View
      style={styles.dots}
      accessible
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, i <= index && styles.dotActive]} />
      ))}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  step: { gap: t.space.gutter },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.md },
  ownerName: { flex: 1 },
  memberRow: {
    minHeight: t.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.md,
    paddingVertical: t.space.sm,
    borderTopWidth: t.border.hairline,
    borderTopColor: t.colors.hairline,
  },
  memberName: { flex: 1 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs, minHeight: t.space.xl },
  dot: {
    flex: 1,
    height: t.space.sm,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceSunken,
  },
  dotActive: { backgroundColor: t.colors.accentText },
});
