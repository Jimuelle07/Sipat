import type { JSX } from 'react';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootNavigation } from '../navigation/types';
import type { HomeTag, Profile } from '../../engine';
import type { EngineContextValue } from '../context/useEngine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { AppBanners, StatusBadges } from '../context/AppChrome';
import { Button, Chip, EmptyState, Field, InlineError, MemberAvatar, Screen, SectionHeader, Tile, Txt } from '../components';
import { useLang, useT } from '../i18n';
import { commonStrings } from '../strings/common';
import { profileStrings } from '../strings/profile';
import { errorMessage } from '../strings/errors';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { fieldErrors } from './family/setupFlow';
import { AreaPicker } from './family/AreaPicker';
import { MAX_PETS, MIN_PETS, buildProfileInput, clampNumber, householdDraftFrom, initialsOf, toggleInList } from './family/profileModel';
import type { HouseholdDraft } from './family/profileModel';

type IconName = ComponentProps<typeof Ionicons>['name'];

const HOME_TAGS = ['near_river', 'near_sea', 'slope', 'low_lying', 'light_materials', 'concrete', 'upper_floor'] as const satisfies readonly HomeTag[];

function pick(copy: object, key: string): string {
  return (copy as Record<string, string>)[key] ?? key;
}

/**
 * The Family tab: the household, its members and their required photos, the home area and the
 * links to Settings and the account. Household editing, member editing, the area picker and
 * household removal are all on this one screen, framed in tiles.
 */
export function ProfileScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const t = useT(profileStrings);
  useEngineChange(['profiles', 'family']);
  const profile = engine.profiles.active();

  return (
    <Screen title={t.screenTitle} banner={<AppBanners />} right={<StatusBadges />}>
      {profile ? (
        <>
          <HouseholdTile engine={engine} profile={profile} />
          <MembersTile engine={engine} navigation={navigation} />
          <Tile title={t.areaTitle}>
            <AreaPicker />
          </Tile>
          <DangerTile engine={engine} profile={profile} />
          <LinksTile navigation={navigation} />
        </>
      ) : (
        <EmptyState icon="people-outline" title={t.noHousehold} body={t.noHouseholdBody} />
      )}
    </Screen>
  );
}

function HouseholdTile({ engine, profile }: { engine: EngineContextValue; profile: Profile }): JSX.Element {
  const t = useT(profileStrings);
  const common = useT(commonStrings);
  const { lang } = useLang();
  const styles = useThemedStyles(makeStyles);

  const [draft, setDraft] = useState<HouseholdDraft>(() => householdDraftFrom(profile));
  const [errors, setErrors] = useState<{ code: string; field: string }[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(householdDraftFrom(profile));
    setSaved(false);
  }, [profile.id, profile.updatedAt]);

  const messages = fieldErrors(lang, errors);
  const patch = (next: Partial<HouseholdDraft>): void => {
    setDraft((current) => ({ ...current, ...next }));
    setSaved(false);
  };
  const save = (): void => {
    const result = engine.profiles.save(buildProfileInput(profile, draft));
    if (result.ok) {
      setDraft(householdDraftFrom(result.value));
      setErrors([]);
      setSaved(true);
    } else {
      setErrors(result.errors);
      setSaved(false);
    }
  };

  return (
    <Tile title={t.householdTitle}>
      <Field
        label={common.householdName}
        value={draft.name}
        onChangeText={(value) => patch({ name: value })}
        error={messages['name']}
      />
      <Txt role="label">{common.petsCount}</Txt>
      <View style={styles.stepper}>
        <Button
          label={common.decrease}
          variant="tonal"
          icon="remove"
          accessibilityLabel={`${common.decrease} ${common.petsCount}`}
          onPress={() => patch({ petsCount: clampNumber(draft.petsCount - 1, MIN_PETS, MAX_PETS) })}
        />
        <Txt role="title" align="center" accessibilityLiveRegion="polite" style={styles.stepperValue}>{draft.petsCount}</Txt>
        <Button
          label={common.increase}
          variant="tonal"
          icon="add"
          accessibilityLabel={`${common.increase} ${common.petsCount}`}
          onPress={() => patch({ petsCount: clampNumber(draft.petsCount + 1, MIN_PETS, MAX_PETS) })}
        />
      </View>
      {messages['petsCount'] ? <InlineError message={messages['petsCount']} /> : null}
      <Txt role="label">{common.homeTags}</Txt>
      <View style={styles.chips}>
        {HOME_TAGS.map((tag) => (
          <Chip
            key={tag}
            label={pick(common, `home_${tag}`)}
            selected={draft.home.includes(tag)}
            onPress={() => patch({ home: toggleInList(draft.home, tag) })}
          />
        ))}
      </View>
      {saved ? <Txt role="bodySmall" tone="muted">{t.saved}</Txt> : null}
      <Button label={t.save} onPress={save} icon="checkmark" />
    </Tile>
  );
}

function MembersTile({ engine, navigation }: { engine: EngineContextValue; navigation: RootNavigation }): JSX.Element {
  const t = useT(profileStrings);
  const common = useT(commonStrings);
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const members = engine.family.members();

  return (
    <Tile>
      <SectionHeader title={t.membersTitle} />
      {members.length === 0 ? <Txt role="bodySmall" tone="muted">{t.addMemberBody}</Txt> : null}
      {members.map((member) => {
        const pending = member.photoStatus === 'pending';
        return (
          <View key={member.id} style={styles.memberRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={member.name}
              onPress={() => navigation.navigate('MemberEditor', { memberId: member.id })}
              style={({ pressed }) => [styles.memberMain, pressed && styles.pressed]}
            >
              <MemberAvatar
                photoUri={member.photo?.uri}
                initials={initialsOf(member.name)}
                size={theme.space.xxxl}
                pending={pending}
                pendingLabel={t.memberAvatar}
              />
              <View style={styles.memberInfo}>
                <Txt role="title" numberOfLines={1}>{member.name}</Txt>
                <Txt role="bodySmall" tone="muted">{pick(common, `relation_${member.relation}`)} · {pick(common, `age_${member.ageGroup}`)}</Txt>
                {pending ? (
                  <Txt role="bodySmall" tone="muted">{engine.copy('photo_pending', { vars: { name: member.name } })}</Txt>
                ) : null}
              </View>
            </Pressable>
            <View style={styles.memberActions}>
              <IconButton
                label={`${t.memberPhoto}: ${member.name}`}
                icon="camera-outline"
                onPress={() => navigation.navigate('Photo', { memberId: member.id })}
              />
              <IconButton
                label={`${t.findMember}: ${member.name}`}
                icon="search-outline"
                onPress={() => navigation.navigate('MemberCard', { memberId: member.id })}
              />
            </View>
          </View>
        );
      })}
      <Button label={common.addMember} variant="tonal" icon="add" onPress={() => navigation.navigate('MemberEditor', {})} />
    </Tile>
  );
}

function DangerTile({ engine, profile }: { engine: EngineContextValue; profile: Profile }): JSX.Element {
  const t = useT(profileStrings);
  const { lang } = useLang();
  const styles = useThemedStyles(makeStyles);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = (): void => {
    const result = engine.profiles.remove(profile.id);
    if (!result.ok) setError(errorMessage(lang, 'profiles_remove', result.error.code));
  };

  return (
    <Tile title={t.removeHousehold}>
      <Txt role="bodySmall" tone="muted">{t.removeHouseholdBody}</Txt>
      {error ? <InlineError message={error} /> : null}
      {confirming ? (
        <View style={styles.actions}>
          <Button label={t.cancel} variant="tonal" onPress={() => { setConfirming(false); setError(null); }} />
          <Button label={t.confirmRemove} variant="danger" icon="trash-outline" onPress={remove} />
        </View>
      ) : (
        <Button label={t.removeHousehold} variant="danger" icon="trash-outline" onPress={() => { setConfirming(true); setError(null); }} />
      )}
    </Tile>
  );
}

function LinksTile({ navigation }: { navigation: RootNavigation }): JSX.Element {
  const t = useT(profileStrings);
  const styles = useThemedStyles(makeStyles);
  return (
    <Tile title={t.linksTitle}>
      <View style={styles.actions}>
        <Button label={t.settingsLink} variant="tonal" icon="settings-outline" onPress={() => navigation.navigate('Settings')} />
        <Button label={t.accountLink} variant="tonal" icon="person-circle-outline" onPress={() => navigation.navigate('Account')} />
      </View>
    </Tile>
  );
}

function IconButton({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }): JSX.Element {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={theme.type.roles.title.fontSize} color={theme.colors.accentText} />
    </Pressable>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: t.space.sm },
  stepper: { minHeight: t.minTouch, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: t.space.sm },
  stepperValue: { minWidth: t.space.xxxl + t.space.xl },
  memberRow: {
    minHeight: t.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    paddingVertical: t.space.md,
    borderTopWidth: t.border.hairline,
    borderTopColor: t.colors.hairline,
  },
  memberMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.space.md },
  memberInfo: { flex: 1, gap: t.space.xs },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  iconButton: {
    minWidth: t.minTouch,
    minHeight: t.minTouch,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: t.radius.form,
    backgroundColor: t.colors.surfaceSunken,
  },
  pressed: { opacity: 0.86 },
});
