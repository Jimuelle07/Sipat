import type { JSX } from 'react';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useEngine, useEngineChange } from '../context/useEngine';
import type { RootNavigation, RootStackParamList } from '../navigation/types';
import { errorMessage } from '../strings/errors';
import { fill } from '../strings/format';
import { photoStrings } from '../strings/photo';
import { useLang, useT } from '../i18n';
import { useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { Button, EmptyState, InlineError, MemberCardView, Screen, Txt } from '../components';

/**
 * "Hinahanap": the offline full-screen poster a family shows to find a member. The rendered
 * card is captured by the engine when sharing; a pending photo offers a path back to Photo.
 */
export function MemberCardScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'MemberCard'>>();
  const t = useT(photoStrings);
  const { lang } = useLang();
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['family', 'profiles']);
  const cardRef = useRef<View>(null);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);

  const memberId = route.params.memberId;
  const card = engine.family.card(memberId);

  if (card === null) {
    return (
      <Screen title={t.cardTitle} hideLanguage back={{ label: t.back, onPress: navigation.goBack }}>
        <EmptyState icon="person-outline" title={t.missingMember} body={t.missingMemberBody} />
      </Screen>
    );
  }

  const pending = card.member.photoStatus === 'pending';
  const isOwnerCard = engine.profiles.active()?.ownerId === card.member.id;
  const lines = [
    ...(isOwnerCard
      ? []
      : [{ label: t.ownerLabel, value: card.ownerPhone ? `${card.ownerName} · ${card.ownerPhone}` : card.ownerName }]),
    ...(card.evacuationCenter ? [{ label: t.centerLabel, value: card.evacuationCenter }] : []),
    ...(card.meetingPlace ? [{ label: t.meetingLabel, value: card.meetingPlace }] : []),
  ];

  const share = async (): Promise<void> => {
    setSharing(true);
    const result = await engine.family.shareCard(memberId, cardRef);
    setSharing(false);
    if (!result.ok) setError(errorMessage(lang, 'share', result.error.code) ?? '');
  };

  const callOwner = async (): Promise<void> => {
    if (card.ownerPhone === undefined) return;
    const result = await engine.plan.call(card.ownerPhone);
    if (!result.ok) setError(errorMessage(lang, 'plan', result.error.code) ?? '');
  };

  return (
    <Screen title={t.cardTitle} hideLanguage back={{ label: t.back, onPress: navigation.goBack }}>
      <MemberCardView
        ref={cardRef}
        heading={t.cardHeading}
        name={card.member.name}
        photoUri={card.member.photo?.uri}
        note={card.member.note}
        lines={lines}
      />
      {pending ? (
        <View style={styles.pendingBlock}>
          <Txt role="body" tone="muted" align="center">
            {engine.copy('photo_pending', { vars: { name: card.member.name } })}
          </Txt>
          <Button
            label={t.addPhoto}
            variant="tonal"
            icon="camera"
            onPress={() => navigation.navigate('Photo', { memberId })}
            fullWidth
          />
        </View>
      ) : null}
      {error !== '' ? <InlineError message={error} /> : null}
      <View style={styles.actions}>
        <Button
          label={t.share}
          variant="highlight"
          icon="share-social-outline"
          disabled={sharing}
          onPress={() => { void share(); }}
          fullWidth
        />
        {card.ownerPhone !== undefined ? (
          <Button
            label={fill(t.callOwner, { name: card.ownerName })}
            variant="tonal"
            icon="call-outline"
            onPress={() => { void callOwner(); }}
            fullWidth
          />
        ) : null}
      </View>
    </Screen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  pendingBlock: { gap: t.space.sm, alignItems: 'center' },
  actions: { gap: t.space.sm },
});
