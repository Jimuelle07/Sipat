import type { JSX } from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootNavigation, RootStackParamList } from '../navigation/types';
import type { AgeGroup, NeedTag, Relation } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { AppBanners } from '../context/AppChrome';
import { Button, Chip, Field, InlineError, MemberAvatar, Screen, Tile, Txt } from '../components';
import { useLang, useT } from '../i18n';
import { commonStrings } from '../strings/common';
import { profileStrings } from '../strings/profile';
import { errorMessage } from '../strings/errors';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { fieldErrors } from './family/setupFlow';
import { blankMemberDraft, initialsOf, memberDraftFrom, memberInputFrom } from './family/profileModel';
import type { MemberDraft } from './family/profileModel';

const RELATIONS = ['self', 'spouse', 'child', 'parent', 'grandparent', 'grandchild', 'sibling', 'relative', 'other'] as const satisfies readonly Relation[];
const AGE_GROUPS = ['infant', 'child', 'teen', 'adult', 'senior'] as const satisfies readonly AgeGroup[];
const NEED_TAGS = ['pregnant', 'pwd', 'maintenance_meds'] as const satisfies readonly NeedTag[];

const NOTE_MAX = 80;
const NAME_MAX = 40;

function pick(copy: object, key: string): string {
  return (copy as Record<string, string>)[key] ?? key;
}

/**
 * Add or edit one member. New members go straight to the required photo after saving, since
 * every member needs a face photo; existing members can replace or remove the photo here.
 */
export function MemberEditorScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'MemberEditor'>>();
  const memberId = route.params?.memberId;
  const t = useT(profileStrings);
  const common = useT(commonStrings);
  const { lang } = useLang();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['family']);

  const profile = engine.profiles.active();
  const member = memberId !== undefined ? engine.family.members().find((value) => value.id === memberId) : undefined;

  const [draft, setDraft] = useState<MemberDraft>(() => member ? memberDraftFrom(member) : blankMemberDraft());
  const [errors, setErrors] = useState<{ code: string; field: string }[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const isOwner = member !== undefined && profile?.ownerId === member.id;
  const messages = fieldErrors(lang, errors);
  const topMessages = errors
    .filter((error) => error.code === 'too_many_members' || error.code === 'owner_relation')
    .map((error) => errorMessage(lang, 'validation', error.code))
    .filter((message): message is string => message !== null);
  const relationOptions = isOwner ? RELATIONS : RELATIONS.filter((value) => value !== 'self');
  const title = memberId !== undefined ? t.memberEditTitle : t.memberAddTitle;

  const save = (): void => {
    const result = engine.family.saveMember(memberInputFrom(draft));
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    if (memberId === undefined) {
      navigation.replace('Photo', { memberId: result.value.id });
    } else {
      navigation.goBack();
    }
  };

  const removePhoto = (): void => {
    if (!member) return;
    const result = engine.family.photos.remove(member.id);
    setPhotoError(result.ok ? null : errorMessage(lang, 'family', result.error.code));
  };

  const removeMember = (): void => {
    if (!member) return;
    const result = engine.family.removeMember(member.id);
    if (result.ok) navigation.goBack();
    else setGeneralError(errorMessage(lang, 'family', result.error.code));
  };

  if (memberId !== undefined && member === undefined) {
    return (
      <Screen title={t.memberScreenTitle} back={{ label: t.back, onPress: navigation.goBack }} banner={<AppBanners />}>
        <Tile>
          <InlineError message={errorMessage(lang, 'family', 'not_found') ?? ''} />
          <Button label={t.back} variant="tonal" onPress={navigation.goBack} />
        </Tile>
      </Screen>
    );
  }

  return (
    <Screen title={t.memberScreenTitle} back={{ label: t.back, onPress: navigation.goBack }} banner={<AppBanners />}>
      <Tile title={title}>
        <Field
          label={common.memberName}
          value={draft.name}
          onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))}
          maxLength={NAME_MAX}
          error={messages['member.name']}
        />
        <Txt role="label">{common.relation}</Txt>
        <View style={styles.chips}>
          {relationOptions.map((item) => (
            <Chip
              key={item}
              label={pick(common, `relation_${item}`)}
              selected={draft.relation === item}
              onPress={() => setDraft((current) => ({ ...current, relation: item }))}
            />
          ))}
        </View>
        <Txt role="label">{common.ageGroup}</Txt>
        <View style={styles.chips}>
          {AGE_GROUPS.map((item) => (
            <Chip
              key={item}
              label={pick(common, `age_${item}`)}
              selected={draft.ageGroup === item}
              onPress={() => setDraft((current) => ({ ...current, ageGroup: item }))}
            />
          ))}
        </View>
        <Txt role="label">{common.needs}</Txt>
        <View style={styles.chips}>
          {NEED_TAGS.map((item) => (
            <Chip
              key={item}
              label={pick(common, `need_${item}`)}
              selected={draft.needs.includes(item)}
              onPress={() => setDraft((current) => ({
                ...current,
                needs: current.needs.includes(item) ? current.needs.filter((value) => value !== item) : [...current.needs, item],
              }))}
            />
          ))}
        </View>
        <Field
          label={t.memberNote}
          value={draft.note}
          onChangeText={(value) => setDraft((current) => ({ ...current, note: value }))}
          maxLength={NOTE_MAX}
          multiline
          error={messages['member.note']}
        />
        <Field
          label={t.memberPhone}
          value={draft.phone}
          onChangeText={(value) => setDraft((current) => ({ ...current, phone: value }))}
          keyboardType="phone-pad"
          error={messages['member.phone']}
        />
        {topMessages.map((message) => <InlineError key={message} message={message} />)}
        {generalError ? <InlineError message={generalError} /> : null}
        <Button label={t.saveMember} onPress={save} icon="checkmark" />
      </Tile>

      {member ? (
        <Tile title={t.photoTitle}>
          <View style={styles.photoRow}>
            <MemberAvatar
              photoUri={member.photo?.uri}
              initials={initialsOf(member.name)}
              size={theme.space.xxxl}
              pending={member.photoStatus === 'pending'}
              pendingLabel={t.memberAvatar}
              label={member.name}
            />
            {member.photoStatus === 'pending' ? (
              <Txt role="bodySmall" tone="muted" style={styles.photoNote}>
                {engine.copy('photo_pending', { vars: { name: member.name } })}
              </Txt>
            ) : null}
          </View>
          <Button label={t.changePhoto} variant="tonal" icon="camera" onPress={() => navigation.navigate('Photo', { memberId: member.id })} />
          {member.photo ? <Button label={t.removePhoto} variant="tonal" icon="trash-outline" onPress={removePhoto} /> : null}
          {photoError ? <InlineError message={photoError} /> : null}
          {!isOwner ? (
            confirmRemove ? (
              <View style={styles.actions}>
                <Button label={t.cancel} variant="tonal" onPress={() => { setConfirmRemove(false); setGeneralError(null); }} />
                <Button label={t.confirmRemove} variant="danger" icon="trash-outline" onPress={removeMember} />
              </View>
            ) : (
              <Button label={t.removeMember} variant="danger" icon="trash-outline" onPress={() => { setConfirmRemove(true); setGeneralError(null); }} />
            )
          ) : null}
        </Tile>
      ) : null}
    </Screen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.md },
  photoNote: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: t.space.sm },
});
