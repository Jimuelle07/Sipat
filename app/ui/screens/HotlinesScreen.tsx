import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { Contact, Profile, ProfileInput } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { AppBanners, StatusBadges } from '../context/AppChrome';
import { Button, EmptyState, Field, HotlineRow, InlineError, Screen, SectionHeader, Tile, Txt } from '../components';
import { useLang, useT } from '../i18n';
import { hotlineStrings } from '../strings/hotlines';
import { errorMessage } from '../strings/errors';
import { fill } from '../strings/format';
import { useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import type { RootNavigation } from '../navigation/types';

export interface PlanDraft {
  evacuationCenter: string;
  meetingPlace: string;
  contacts: Contact[];
}

export type PlanErrors = readonly { code: string; field: string }[];

export function planDraftFrom(profile: Profile): PlanDraft {
  return {
    evacuationCenter: profile.plan.evacuationCenter ?? '',
    meetingPlace: profile.plan.meetingPlace ?? '',
    contacts: profile.plan.contacts.map((contact) => ({ ...contact })),
  };
}

export function isPlanEmpty(plan: Profile['plan']): boolean {
  return !plan.evacuationCenter?.trim() && !plan.meetingPlace?.trim() && plan.contacts.length === 0;
}

/** Builds the save payload from the draft, keeping the untouched household fields from the profile. */
export function buildPlanInput(profile: Profile, draft: PlanDraft): ProfileInput {
  const contacts: Contact[] = [];
  for (const contact of draft.contacts) {
    const name = contact.name.trim();
    if (name.length === 0) continue;
    const next: Contact = { name, phone: contact.phone.trim() };
    const relation = contact.relation?.trim();
    if (relation !== undefined && relation.length > 0) next.relation = relation;
    contacts.push(next);
  }
  const plan: Profile['plan'] = { ...profile.plan, contacts };
  const evacuationCenter = draft.evacuationCenter.trim();
  if (evacuationCenter.length > 0) plan.evacuationCenter = evacuationCenter;
  else delete plan.evacuationCenter;
  const meetingPlace = draft.meetingPlace.trim();
  if (meetingPlace.length > 0) plan.meetingPlace = meetingPlace;
  else delete plan.meetingPlace;
  return { id: profile.id, name: profile.name, petsCount: profile.petsCount, home: [...profile.home], plan };
}

/** The per-field error copy for a contact's phone, if the engine flagged it. */
export function contactPhoneError(errors: PlanErrors, index: number, lang: 'tl' | 'en'): string | undefined {
  const field = `plan.contacts.${index}.phone`;
  const found = errors.find((error) => error.field === field);
  return found ? errorMessage(lang, 'validation', found.code) ?? undefined : undefined;
}

/** True when the engine rejected the plan for having too many contacts. */
export function hasContactsError(errors: PlanErrors): boolean {
  return errors.some((error) => error.code === 'too_many_contacts');
}

export function HotlinesScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const t = useT(hotlineStrings);
  const { lang } = useLang();
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['profiles', 'packs', 'feed']);

  const [callError, setCallError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [errors, setErrors] = useState<PlanErrors>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const profile = engine.profiles.active();
  const hotlines = engine.plan.hotlines();

  useEffect(() => {
    setEditing(false);
    setDraft(null);
    setErrors([]);
    setSaved(false);
  }, [profile?.id]);

  const call = async (target: string): Promise<void> => {
    setCallError(null);
    try {
      const result = await engine.plan.call(target);
      if (!result.ok) setCallError(errorMessage(lang, 'plan', result.error.code));
    } catch {
      setCallError(errorMessage(lang, 'plan', 'failed'));
    }
  };

  const startEditing = (source: Profile): void => {
    setDraft(planDraftFrom(source));
    setErrors([]);
    setSaved(false);
    setEditing(true);
  };

  const save = async (): Promise<void> => {
    if (profile === null || draft === null) return;
    setBusy(true);
    await Promise.resolve();
    try {
      const result = engine.profiles.save(buildPlanInput(profile, draft));
      if (result.ok) {
        setDraft(planDraftFrom(result.value));
        setErrors([]);
        setSaved(true);
        setEditing(false);
      } else {
        setErrors(result.errors);
        setSaved(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const patchContact = (index: number, patch: Partial<Contact>): void => {
    setDraft((current) => current
      ? { ...current, contacts: current.contacts.map((contact, i) => i === index ? { ...contact, ...patch } : contact) }
      : current);
  };

  const planTile = profile === null ? (
    <Tile>
      <EmptyState
        icon="home-outline"
        title={t.noHouseholdTitle}
        body={t.noHouseholdBody}
        action={{ label: t.goFamily, onPress: () => navigation.navigate('Tabs', { screen: 'Family' }) }}
      />
    </Tile>
  ) : !editing && isPlanEmpty(profile.plan) ? (
    <Tile>
      <EmptyState
        icon="map-outline"
        title={t.emptyPlanTitle}
        body={t.emptyPlanBody}
        action={{ label: t.fillPlan, onPress: () => startEditing(profile) }}
      />
    </Tile>
  ) : editing && draft !== null ? (
    <Tile>
      <Field
        label={t.evacuationCenter}
        value={draft.evacuationCenter}
        onChangeText={(value) => setDraft({ ...draft, evacuationCenter: value })}
      />
      <Field
        label={t.meetingPlace}
        value={draft.meetingPlace}
        onChangeText={(value) => setDraft({ ...draft, meetingPlace: value })}
      />
      <Txt role="label">{t.contacts}</Txt>
      {draft.contacts.map((contact, index) => (
        <View key={`contact-${index}`} style={styles.contactEditor}>
          <Field label={t.contactName} value={contact.name} onChangeText={(value) => patchContact(index, { name: value })} />
          <Field
            label={t.contactPhone}
            value={contact.phone}
            keyboardType="phone-pad"
            onChangeText={(value) => patchContact(index, { phone: value })}
            error={contactPhoneError(errors, index, lang)}
          />
          <Field label={t.contactRelation} value={contact.relation ?? ''} onChangeText={(value) => patchContact(index, { relation: value })} />
          <Button
            label={t.removeContact}
            variant="text"
            icon="trash-outline"
            onPress={() => setDraft({ ...draft, contacts: draft.contacts.filter((_item, i) => i !== index) })}
          />
        </View>
      ))}
      {/* The limit is the engine's: saving more than it allows returns too_many_contacts (shown below). */}
      <Button
        label={t.addContact}
        variant="tonal"
        icon="add"
        onPress={() => setDraft({ ...draft, contacts: [...draft.contacts, { name: '', phone: '' }] })}
      />
      {hasContactsError(errors) ? (
        <InlineError message={errorMessage(lang, 'validation', 'too_many_contacts') ?? ''} />
      ) : null}
      <View style={styles.actions}>
        <Button
          label={t.cancel}
          variant="tonal"
          onPress={() => {
            setEditing(false);
            setDraft(null);
            setErrors([]);
          }}
        />
        <Button label={busy ? t.saving : t.save} icon="checkmark" disabled={busy} onPress={() => { void save(); }} />
      </View>
    </Tile>
  ) : profile !== null ? (
    <Tile>
      <View style={styles.summaryRow}>
        <Txt role="label" tone="muted">{t.evacuationCenter}</Txt>
        {profile.plan.evacuationCenter ? (
          <Txt role="lead">{profile.plan.evacuationCenter}</Txt>
        ) : (
          <Txt role="bodySmall" tone="muted">{t.notSet}</Txt>
        )}
      </View>
      <View style={styles.summaryRow}>
        <Txt role="label" tone="muted">{t.meetingPlace}</Txt>
        {profile.plan.meetingPlace ? (
          <Txt role="lead">{profile.plan.meetingPlace}</Txt>
        ) : (
          <Txt role="bodySmall" tone="muted">{t.notSet}</Txt>
        )}
      </View>
      <Txt role="label" tone="muted">{t.contacts}</Txt>
      {profile.plan.contacts.length === 0 ? (
        <Txt role="bodySmall" tone="muted">{t.noContacts}</Txt>
      ) : profile.plan.contacts.map((contact, index) => (
        <View key={`${contact.name}-${index}`} style={styles.contactRow}>
          <View style={styles.contactInfo}>
            <Txt role="title" numberOfLines={1}>{contact.name}</Txt>
            {contact.relation !== undefined && contact.relation.length > 0 ? (
              <Txt role="bodySmall" tone="muted">{contact.relation}</Txt>
            ) : null}
            <Txt role="lead" tone="accent" style={styles.number}>{contact.phone}</Txt>
          </View>
          <Button
            label={t.call}
            icon="call"
            variant="tonal"
            accessibilityLabel={fill(t.callContact, { name: contact.name })}
            onPress={() => { void call(contact.phone); }}
          />
        </View>
      ))}
    </Tile>
  ) : null;

  return (
    <Screen key={editing ? 'editing' : 'view'} title={t.title} banner={<AppBanners />} right={<StatusBadges />}>
      <SectionHeader
        title={t.familyPlan}
        action={profile !== null
          ? {
            label: editing ? t.doneEditing : t.edit,
            accessibilityState: { expanded: editing },
            onPress: () => {
              if (editing) {
                setEditing(false);
                setDraft(null);
                setErrors([]);
              } else {
                startEditing(profile);
              }
            },
          }
          : undefined}
      />
      {!editing ? <Txt role="bodySmall" tone="muted">{t.planHint}</Txt> : null}
      {planTile}
      {!editing && saved ? <Txt role="bodySmall" tone="muted">{t.saved}</Txt> : null}

      <SectionHeader title={t.hotlines} />
      {hotlines.length === 0 ? (
        <Tile><EmptyState icon="call-outline" title={t.noHotlines} /></Tile>
      ) : hotlines.map((hotline) => (
        <Tile key={hotline.id}>
          <HotlineRow
            name={hotline.name}
            number={hotline.number}
            callLabel={t.call}
            onCall={() => { void call(hotline.id); }}
          />
        </Tile>
      ))}

      {callError !== null ? <InlineError message={callError} /> : null}
    </Screen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: t.space.sm,
  },
  contactEditor: {
    gap: t.space.sm,
    paddingTop: t.space.md,
    borderTopWidth: t.border.hairline,
    borderTopColor: t.colors.hairline,
  },
  contactRow: {
    minHeight: t.minTouch,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: t.space.md,
    paddingVertical: t.space.md,
    borderTopWidth: t.border.hairline,
    borderTopColor: t.colors.hairline,
  },
  contactInfo: {
    flex: 1,
    minWidth: t.minTouch * 3,
    gap: t.space.xs,
  },
  summaryRow: {
    gap: t.space.xs,
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
});
