import type { JSX, ReactNode } from 'react';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import type { AgeGroup, Contact, HomeTag, Member, MemberInput, NeedTag, Profile, ProfileInput, Relation, Settings } from '../../engine';
import type { EngineContextValue } from '../context/useEngine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { Button, Chip, Field, InlineError, MemberAvatar, Screen, SectionHeader, Tile, ToggleRow, Txt } from '../components';
import { useLang, useT } from '../i18n';
import { commonStrings } from '../strings/common';
import { profileStrings } from '../strings/profile';
import { useThemedStyles, useTheme } from '../theme';
import type { Theme } from '../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const HOME_TAGS = ['near_river', 'near_sea', 'slope', 'low_lying', 'light_materials', 'concrete', 'upper_floor'] as const satisfies readonly HomeTag[];
const RELATIONS = ['self', 'spouse', 'child', 'parent', 'grandparent', 'grandchild', 'sibling', 'relative', 'other'] as const satisfies readonly Relation[];
const AGE_GROUPS = ['infant', 'child', 'teen', 'adult', 'senior'] as const satisfies readonly AgeGroup[];
const NEED_TAGS = ['pregnant', 'pwd', 'maintenance_meds'] as const satisfies readonly NeedTag[];
const MAX_CONTACTS = 5;
const MAX_PETS = 20;
const MIN_PETS = 0;

export interface MemberDraft { id?: string; name: string; relation: Relation; ageGroup: AgeGroup; needs: NeedTag[]; note: string; phone: string }
export interface HouseholdDraft { name: string; petsCount: number; home: HomeTag[]; evacuationCenter: string; meetingPlace: string; contacts: Contact[] }

interface Copy extends Record<string, string> {
  screenTitle: string; household: string; setupTitle: string; setupIntro: string; householdStep: string; ownerStep: string;
  continue: string; back: string; ownerSection: string; householdSummary: string; headcount: string; editHousehold: string;
  doneEditing: string; plan: string; evacuationCenter: string; meetingPlace: string; contacts: string; contactName: string;
  contactPhone: string; contactRelation: string; addContact: string; noContacts: string; save: string; saving: string;
  saved: string; members: string; memberNote: string; memberPhone: string; edit: string; saveMember: string;
  cancelEdit: string; noMembers: string; addMember: string; settings: string; aiEnabled: string; on: string; off: string;
  lowBatteryThreshold: string; staleWarningHours: string; settingsHint: string; clearHistory: string; historyCleared: string;
  language: string; fieldName: string; fieldPhone: string; fieldRelation: string; fieldNote: string;
  memberAvatar: string; percentSign: string; hoursSign: string; langTl: string; langEn: string;
  error_owner_required: string; error_not_found: string; error_out_of_range: string; error_unknown: string;
}
interface BaseCopy extends Record<string, string> {
  householdName: string; personName: string; ageGroup: string; needs: string; createHousehold: string;
  error_name_required: string; error_too_long: string; error_pets_range: string; error_too_many_contacts: string;
  error_contact_phone_invalid: string; error_phone_invalid: string; error_too_many_members: string; error_owner_relation: string;
  petsCount: string; homeTags: string;
  remove: string; memberName: string; relation: string; emptyPlan: string; decrease: string; increase: string;
  doneMark: string; todoMark: string;
}

export function blankMemberDraft(): MemberDraft { return { name: '', relation: 'other', ageGroup: 'adult', needs: [], note: '', phone: '' }; }
export function memberDraftFrom(member: Member): MemberDraft {
  return { id: member.id, name: member.name, relation: member.relation, ageGroup: member.ageGroup, needs: [...member.needs], note: member.note ?? '', phone: member.phone ?? '' };
}
export function memberInputFrom(draft: MemberDraft): MemberInput {
  const input: MemberInput = { name: draft.name.trim(), relation: draft.relation, ageGroup: draft.ageGroup, needs: [...draft.needs] };
  if (draft.id !== undefined) input.id = draft.id;
  const note = draft.note.trim();
  if (note.length > 0) input.note = note;
  const phone = draft.phone.trim();
  if (phone.length > 0) input.phone = phone;
  return input;
}
export function toggleInList<T>(list: readonly T[], value: T): T[] { return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]; }
export function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
export function parseSettingNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}
export function householdDraftFrom(profile: Profile): HouseholdDraft {
  return { name: profile.name, petsCount: profile.petsCount, home: [...profile.home], evacuationCenter: profile.plan.evacuationCenter ?? '', meetingPlace: profile.plan.meetingPlace ?? '', contacts: profile.plan.contacts.map((contact) => ({ ...contact })) };
}
export function buildProfileInput(profile: Profile, draft: HouseholdDraft): ProfileInput {
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
  return { id: profile.id, name: draft.name.trim(), petsCount: clampNumber(draft.petsCount, MIN_PETS, MAX_PETS), home: [...draft.home], plan };
}

function errorCopy(code: string, t: Copy, base: BaseCopy): string {
  const messages: Record<string, string> = {
    name_required: base.error_name_required, too_long: base.error_too_long, pets_range: base.error_pets_range,
    too_many_contacts: base.error_too_many_contacts, contact_phone_invalid: base.error_contact_phone_invalid,
    phone_invalid: base.error_phone_invalid, too_many_members: base.error_too_many_members,
    owner_relation: base.error_owner_relation, owner_required: t.error_owner_required,
    not_found: t.error_not_found, out_of_range: t.error_out_of_range,
  };
  return messages[code] ?? t.error_unknown;
}
export function errorMessage(code: string, t: Copy = profileStrings.tl, base: BaseCopy = commonStrings.tl): string { return errorCopy(code, t, base); }
function fieldLabel(field: string, t: Copy, base: BaseCopy): string {
  switch (field.split('.').pop() ?? field) {
    case 'name': return t.fieldName;
    case 'phone': return t.fieldPhone;
    case 'relation': return t.fieldRelation;
    case 'note': return t.fieldNote;
    case 'petsCount': return base.petsCount;
    case 'contacts': return t.contacts;
    case 'evacuationCenter': return t.evacuationCenter;
    case 'meetingPlace': return t.meetingPlace;
    default: return field;
  }
}
export function fieldErrorLines(errors: readonly { code: string; field: string }[], t: Copy = profileStrings.tl, base: BaseCopy = commonStrings.tl): string[] {
  return errors.map((error) => `${fieldLabel(error.field, t, base)}: ${errorCopy(error.code, t, base)}`);
}

function firstFieldError(errors: readonly { code: string; field: string }[], field: string, t: Copy, base: BaseCopy): string | undefined {
  const found = errors.find((error) => error.field.split('.').pop() === field);
  return found ? errorCopy(found.code, t, base) : undefined;
}
function dynamicCopy(copy: Record<string, string>, key: string): string { return copy[key] ?? key; }
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter((part) => part.length > 0);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? '' : '';
  return `${first}${last}`.toUpperCase();
}

export function ProfileScreen(): JSX.Element {
  const engine = useEngine();
  const t = useT(profileStrings);
  const base = useT(commonStrings);
  useEngineChange(['profiles', 'family', 'settings', 'history']);
  const profile = engine.profiles.active();
  return <Screen title={t.screenTitle}>
    {profile ? <>
      <HouseholdTile engine={engine} profile={profile} t={t} base={base} />
      <MembersSection engine={engine} profile={profile} t={t} base={base} />
      <SettingsSection engine={engine} t={t} />
    </> : <SetupForm engine={engine} t={t} base={base} />}
  </Screen>;
}

function SetupForm({ engine, t, base }: { engine: EngineContextValue; t: Copy; base: BaseCopy }): JSX.Element {
  const [step, setStep] = useState<1 | 2>(1);
  const [householdName, setHouseholdName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerAge, setOwnerAge] = useState<AgeGroup>('adult');
  const [ownerNeeds, setOwnerNeeds] = useState<NeedTag[]>([]);
  const [ownerPhone, setOwnerPhone] = useState('');
  const [errors, setErrors] = useState<readonly { code: string; field: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const styles = useThemedStyles(makeStyles);

  const next = (): void => {
    if (householdName.trim().length === 0) { setErrors([{ code: 'name_required', field: 'name' }]); return; }
    setErrors([]);
    setStep(2);
  };
  const create = async (): Promise<void> => {
    setBusy(true);
    await Promise.resolve();
    try {
      const owner: MemberInput = { name: ownerName, relation: 'self', ageGroup: ownerAge, needs: ownerNeeds };
      const phone = ownerPhone.trim();
      if (phone.length > 0) owner.phone = phone;
      const result = engine.profiles.create({ name: householdName, owner });
      setErrors(result.ok ? [] : result.errors);
      if (!result.ok && result.errors.some((error) => error.field === 'name')) setStep(1);
    } finally { setBusy(false); }
  };
  const label = step === 1 ? t.householdStep : t.ownerStep;
  return <Tile title={t.setupTitle} subtitle={t.setupIntro}>
    <Txt role="label" tone="accent">{label}</Txt>
    {step === 1 ? <>
      <Field label={base.householdName} value={householdName} onChangeText={setHouseholdName} error={firstFieldError(errors, 'name', t, base)} />
      <Button label={t.continue} onPress={next} icon="arrow-forward" />
    </> : <>
      <Field label={base.personName} value={ownerName} onChangeText={setOwnerName} error={firstFieldError(errors, 'name', t, base)} />
      <Txt role="label">{base.ageGroup}</Txt>
      <Selector>{AGE_GROUPS.map((item) => <Chip key={item} label={dynamicCopy(base, `age_${item}`)} selected={ownerAge === item} onPress={() => setOwnerAge(item)} />)}</Selector>
      <Txt role="label">{base.needs}</Txt>
      <Selector>{NEED_TAGS.map((item) => <Chip key={item} label={dynamicCopy(base, `need_${item}`)} selected={ownerNeeds.includes(item)} onPress={() => setOwnerNeeds((current) => toggleInList(current, item))} />)}</Selector>
      <Field label={t.memberPhone} value={ownerPhone} onChangeText={setOwnerPhone} keyboardType="phone-pad" error={firstFieldError(errors, 'phone', t, base)} />
      {errors.length > 0 && !errors.some((error) => ['name', 'phone'].includes(error.field.split('.').pop() ?? '')) ? <InlineError message={fieldErrorLines(errors, t, base).join('\n')} /> : null}
      <View style={styles.actions}>
        <Button label={t.back} variant="tonal" onPress={() => { setErrors([]); setStep(1); }} />
        <Button label={busy ? t.saving : base.createHousehold} onPress={() => { void create(); }} disabled={busy} icon="checkmark" />
      </View>
    </>}
  </Tile>;
}

function HouseholdTile({ engine, profile, t, base }: { engine: EngineContextValue; profile: Profile; t: Copy; base: BaseCopy }): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<HouseholdDraft>(() => householdDraftFrom(profile));
  const [errors, setErrors] = useState<readonly { code: string; field: string }[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const styles = useThemedStyles(makeStyles);
  useEffect(() => { setDraft(householdDraftFrom(profile)); setSaved(false); }, [profile.id]);
  const patch = (next: Partial<HouseholdDraft>): void => { setDraft((current) => ({ ...current, ...next })); setSaved(false); };
  const save = async (): Promise<void> => {
    setBusy(true);
    await Promise.resolve();
    try {
      const result = engine.profiles.save(buildProfileInput(profile, draft));
      if (result.ok) { setDraft(householdDraftFrom(result.value)); setErrors([]); setSaved(true); setEditing(false); }
      else { setErrors(result.errors); setSaved(false); }
    } finally { setBusy(false); }
  };
  const updateContact = (index: number, next: Partial<Contact>): void => patch({ contacts: draft.contacts.map((contact, i) => i === index ? { ...contact, ...next } : contact) });
  const summaryTags = [
    ...profile.home.map((tag) => dynamicCopy(base, `home_${tag}`)),
    ...profile.members.filter((tag) => tag !== 'pets').map((tag) => tag === 'pregnant' || tag === 'pwd' || tag === 'maintenance_meds' ? dynamicCopy(base, `need_${tag}`) : dynamicCopy(base, `age_${tag}`)),
    ...(profile.petsCount > 0 ? [`${profile.petsCount} ${base.petsCount}`] : []),
  ];
  return <Tile>
    <SectionHeader title={t.householdSummary} action={{ label: editing ? t.doneEditing : t.editHousehold, onPress: () => { setEditing((value) => !value); setErrors([]); } }} />
    {!editing ? <>
      <Txt role="title">{profile.name}</Txt>
      <Txt role="bodySmall" tone="muted">{profile.headcount} {t.headcount}</Txt>
      <Selector>{summaryTags.length > 0 ? summaryTags.map((tag, index) => <Chip key={`${tag}-${index}`} label={tag} />) : <Txt role="bodySmall" tone="muted">{base.emptyPlan}</Txt>}</Selector>
    </> : <>
      <Field label={base.householdName} value={draft.name} onChangeText={(value) => patch({ name: value })} error={firstFieldError(errors, 'name', t, base)} />
      <View style={styles.stepper}>
        <Txt role="label" style={styles.stepperLabel}>{base.petsCount}: {draft.petsCount}</Txt>
        <Button label={base.decrease} variant="tonal" onPress={() => patch({ petsCount: clampNumber(draft.petsCount - 1, MIN_PETS, MAX_PETS) })} accessibilityLabel={`${base.decrease} ${base.petsCount}`} />
        <Button label={base.increase} variant="tonal" onPress={() => patch({ petsCount: clampNumber(draft.petsCount + 1, MIN_PETS, MAX_PETS) })} accessibilityLabel={`${base.increase} ${base.petsCount}`} />
      </View>
      <Txt role="label">{base.homeTags}</Txt>
      <Selector>{HOME_TAGS.map((tag) => <Chip key={tag} label={dynamicCopy(base, `home_${tag}`)} selected={draft.home.includes(tag)} onPress={() => patch({ home: toggleInList(draft.home, tag) })} />)}</Selector>
      <Txt role="title">{t.plan}</Txt>
      <Field label={t.evacuationCenter} value={draft.evacuationCenter} onChangeText={(value) => patch({ evacuationCenter: value })} error={firstFieldError(errors, 'evacuationCenter', t, base)} />
      <Field label={t.meetingPlace} value={draft.meetingPlace} onChangeText={(value) => patch({ meetingPlace: value })} error={firstFieldError(errors, 'meetingPlace', t, base)} />
      <Txt role="label">{t.contacts}</Txt>
      {draft.contacts.length === 0 ? <Txt role="bodySmall" tone="muted">{t.noContacts}</Txt> : null}
      {draft.contacts.map((contact, index) => <View key={`contact-${index}`} style={styles.nestedCard}>
        <Field label={t.contactName} value={contact.name} onChangeText={(value) => updateContact(index, { name: value })} error={firstFieldError(errors, 'contacts', t, base)} />
        <Field label={t.contactPhone} value={contact.phone} onChangeText={(value) => updateContact(index, { phone: value })} keyboardType="phone-pad" error={firstFieldError(errors, 'phone', t, base)} />
        <Field label={t.contactRelation} value={contact.relation ?? ''} onChangeText={(value) => updateContact(index, { relation: value })} />
        <IconButton label={base.remove} icon="trash-outline" onPress={() => patch({ contacts: draft.contacts.filter((_, i) => i !== index) })} danger />
      </View>)}
      {draft.contacts.length < MAX_CONTACTS ? <Button label={t.addContact} variant="tonal" icon="add" onPress={() => patch({ contacts: [...draft.contacts, { name: '', phone: '' }] })} /> : null}
      {errors.length > 0 && errors.some((error) => !['name', 'evacuationCenter', 'meetingPlace', 'contacts', 'phone'].includes(error.field.split('.').pop() ?? '')) ? <InlineError message={fieldErrorLines(errors, t, base).join('\n')} /> : null}
      {saved ? <Txt role="bodySmall" tone="muted">{t.saved}</Txt> : null}
      <Button label={busy ? t.saving : t.save} onPress={() => { void save(); }} disabled={busy} icon="checkmark" />
    </>}
  </Tile>;
}

function MembersSection({ engine, profile, t, base }: { engine: EngineContextValue; profile: Profile; t: Copy; base: BaseCopy }): JSX.Element {
  const members = engine.family.members();
  const [draft, setDraft] = useState<MemberDraft | null>(null);
  const [errors, setErrors] = useState<readonly { code: string; field: string }[]>([]);
  const [generalError, setGeneralError] = useState('');
  const [busy, setBusy] = useState(false);
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const editing = draft?.id !== undefined;
  const submit = async (): Promise<void> => {
    if (!draft) return;
    setBusy(true);
    await Promise.resolve();
    try {
      const result = engine.family.saveMember(memberInputFrom(draft));
      if (result.ok) { setDraft(null); setErrors([]); setGeneralError(''); }
      else { setErrors(result.errors); setGeneralError(''); }
    } finally { setBusy(false); }
  };
  const remove = (memberId: string): void => {
    const result = engine.family.removeMember(memberId);
    if (result.ok) { setErrors([]); setGeneralError(''); }
    else { setGeneralError(errorCopy(result.error.code, t, base)); setErrors([]); }
  };
  const translatedRelation = (value: Relation): string => dynamicCopy(base, `relation_${value}`);
  return <Tile>
    <SectionHeader title={t.members} />
    {members.length === 0 ? <Txt role="bodySmall" tone="muted">{t.noMembers}</Txt> : null}
    {members.map((member) => <View key={member.id} style={styles.memberRow}>
      <MemberAvatar
        photoUri={member.photo?.uri}
        initials={initialsOf(member.name)}
        size={theme.space.xxxl}
        pending={member.photo === undefined}
        pendingLabel={t.memberAvatar}
      />
      <View style={styles.memberInfo}>
        <Txt role="title" numberOfLines={1}>{member.name}</Txt>
        <Txt role="bodySmall" tone="muted">{translatedRelation(member.relation)} · {dynamicCopy(base, `age_${member.ageGroup}`)}</Txt>
        {member.note ? <Txt role="bodySmall" tone="muted">{member.note}</Txt> : null}
        {member.needs.length > 0 ? <Selector>{member.needs.map((need) => <Chip key={need} label={dynamicCopy(base, `need_${need}`)} />)}</Selector> : null}
      </View>
      <View style={styles.iconActions}>
        <IconButton label={t.edit} icon="create-outline" onPress={() => { setDraft(memberDraftFrom(member)); setErrors([]); setGeneralError(''); }} />
        <IconButton label={base.remove} icon="trash-outline" onPress={() => remove(member.id)} danger />
      </View>
    </View>)}
    {generalError ? <InlineError message={generalError} /> : null}
    {!draft ? <Button label={t.addMember} onPress={() => { setDraft(blankMemberDraft()); setErrors([]); }} icon="add" /> : <Tile title={editing ? t.edit : t.addMember}>
      <Field label={base.memberName} value={draft.name} onChangeText={(value) => setDraft((current) => current ? { ...current, name: value } : current)} error={firstFieldError(errors, 'name', t, base)} />
      <Txt role="label">{base.relation}</Txt>
      <Selector>{RELATIONS.filter((item) => item !== 'self').map((item) => <Chip key={item} label={dynamicCopy(base, `relation_${item}`)} selected={draft.relation === item} onPress={() => setDraft((current) => current ? { ...current, relation: item } : current)} />)}</Selector>
      <Txt role="label">{base.ageGroup}</Txt>
      <Selector>{AGE_GROUPS.map((item) => <Chip key={item} label={dynamicCopy(base, `age_${item}`)} selected={draft.ageGroup === item} onPress={() => setDraft((current) => current ? { ...current, ageGroup: item } : current)} />)}</Selector>
      <Txt role="label">{base.needs}</Txt>
      <Selector>{NEED_TAGS.map((item) => <Chip key={item} label={dynamicCopy(base, `need_${item}`)} selected={draft.needs.includes(item)} onPress={() => setDraft((current) => current ? { ...current, needs: toggleInList(current.needs, item) } : current)} />)}</Selector>
      <Field label={t.memberNote} value={draft.note} onChangeText={(value) => setDraft((current) => current ? { ...current, note: value } : current)} error={firstFieldError(errors, 'note', t, base)} />
      <Field label={t.memberPhone} value={draft.phone} onChangeText={(value) => setDraft((current) => current ? { ...current, phone: value } : current)} keyboardType="phone-pad" error={firstFieldError(errors, 'phone', t, base)} />
      {errors.length > 0 && errors.some((error) => !['name', 'note', 'phone'].includes(error.field.split('.').pop() ?? '')) ? <InlineError message={fieldErrorLines(errors, t, base).join('\n')} /> : null}
      <View style={styles.actions}>
        <Button label={t.cancelEdit} variant="tonal" onPress={() => { setDraft(null); setErrors([]); }} />
        <Button label={busy ? t.saving : t.saveMember} onPress={() => { void submit(); }} disabled={busy} icon="checkmark" />
      </View>
    </Tile>}
  </Tile>;
}

function SettingsSection({ engine, t }: { engine: EngineContextValue; t: Copy }): JSX.Element {
  const settings = engine.settings.get();
  const base = useT(commonStrings);
  const { lang, setLang } = useLang();
  const [error, setError] = useState('');
  const [historyCleared, setHistoryCleared] = useState(false);
  const styles = useThemedStyles(makeStyles);
  const updateSetting = (patch: Partial<Settings>): void => {
    const result = engine.settings.update(patch);
    setError(result.ok ? '' : t.error_out_of_range);
  };
  const step = (key: 'lowBatteryThreshold' | 'staleWarningHours', amount: number): void => {
    const bounds = key === 'lowBatteryThreshold' ? { min: 5, max: 50 } : { min: 1, max: 12 };
    const result = engine.settings.update({ [key]: settings[key] + amount });
    if (!result.ok) setError(t.error_out_of_range);
    else setError('');
    if (settings[key] < bounds.min || settings[key] > bounds.max) setError(t.error_out_of_range);
  };
  const clearHistory = (): void => { engine.history.clear(); setHistoryCleared(true); };
  const langLabel: Record<'tl' | 'en', string> = { tl: t.langTl, en: t.langEn };
  return <Tile title={t.settings}>
    <View style={styles.settingRow}>
      <Txt role="label">{t.language}</Txt>
      <View style={styles.languageChoices}>{(['tl', 'en'] as const).map((item) => <Chip key={item} label={langLabel[item]} selected={lang === item} onPress={() => setLang(item)} />)}</View>
    </View>
    <ToggleRow label={t.aiEnabled} description={settings.aiEnabled ? t.on : t.off} value={settings.aiEnabled} onValueChange={(value) => updateSetting({ aiEnabled: value })} />
    <SettingStepper label={t.lowBatteryThreshold} value={settings.lowBatteryThreshold} suffix={t.percentSign} stepDown={`${base.decrease} ${t.lowBatteryThreshold}`} stepUp={`${base.increase} ${t.lowBatteryThreshold}`} onStep={(amount) => step('lowBatteryThreshold', amount)} />
    <SettingStepper label={t.staleWarningHours} value={settings.staleWarningHours} suffix={t.hoursSign} stepDown={`${base.decrease} ${t.staleWarningHours}`} stepUp={`${base.increase} ${t.staleWarningHours}`} onStep={(amount) => step('staleWarningHours', amount)} />
    <Txt role="bodySmall" tone="muted">{t.settingsHint}</Txt>
    {error ? <InlineError message={error} /> : null}
    <Button label={t.clearHistory} variant="tonal" icon="trash-outline" onPress={clearHistory} />
    {historyCleared ? <Txt role="bodySmall" tone="muted">{t.historyCleared}</Txt> : null}
  </Tile>;
}

function SettingStepper({ label, value, suffix, stepDown, stepUp, onStep }: { label: string; value: number; suffix: string; stepDown: string; stepUp: string; onStep: (amount: number) => void }): JSX.Element {
  const base = useT(commonStrings);
  const styles = useThemedStyles(makeStyles);
  return <View style={styles.stepper}>
    <Txt role="label" style={styles.stepperLabel}>{label}</Txt>
    <Button label={base.decrease} variant="tonal" onPress={() => onStep(-1)} accessibilityLabel={stepDown} />
    <Txt role="title" align="center" accessibilityLiveRegion="polite" style={styles.stepValue}>{value}{suffix}</Txt>
    <Button label={base.increase} variant="tonal" onPress={() => onStep(1)} accessibilityLabel={stepUp} />
  </View>;
}

function Selector({ children }: { children: ReactNode }): JSX.Element {
  const styles = useThemedStyles(makeStyles);
  return <View style={styles.selector}>{children}</View>;
}

function IconButton({ label, icon, onPress, danger = false, disabled = false }: { label: string; icon: IconName; onPress: () => void; danger?: boolean; disabled?: boolean }): JSX.Element {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.iconButton, disabled && styles.disabled, pressed && !disabled && styles.pressed]}
  >
    <Ionicons name={icon} size={theme.type.roles.title.fontSize} color={danger ? theme.colors.danger.fill : theme.colors.accentText} />
  </Pressable>;
}

const makeStyles = (t: Theme) => StyleSheet.create({
  selector: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: t.space.sm },
  stepper: { minHeight: t.minTouch, flexDirection: 'row', alignItems: 'center', gap: t.space.sm },
  stepperLabel: { flex: 1 },
  stepValue: { minWidth: t.space.xxxl + t.space.xl },
  nestedCard: { gap: t.space.sm, padding: t.space.md, borderRadius: t.radius.form, backgroundColor: t.colors.surfaceSunken },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: t.space.md, paddingVertical: t.space.md, borderTopWidth: t.border.hairline, borderTopColor: t.colors.hairline },
  memberInfo: { flex: 1, gap: t.space.xs },
  iconActions: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
  iconButton: { minWidth: t.minTouch, minHeight: t.minTouch, justifyContent: 'center', alignItems: 'center', borderRadius: t.radius.form, backgroundColor: t.colors.surfaceSunken },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.86 },
  settingRow: { minHeight: t.minTouch, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: t.space.md },
  languageChoices: { flexDirection: 'row', gap: t.space.xs },
});
