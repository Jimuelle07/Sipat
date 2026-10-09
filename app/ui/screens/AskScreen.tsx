import type { JSX, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import type { BulletinCardView, TopicGroup } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { AppBanners, StatusBadges } from '../context/AppChrome';
import { useLang, useT } from '../i18n';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import {
  AiBlock,
  AiStatusLine,
  BulletinCard,
  Button,
  Chip,
  ClosingLine,
  EmergencyCard,
  EmptyState,
  FixedReplyCard,
  PhaseChangeLine,
  PlanAnswerCard,
  RefusalCard,
  Screen,
  SummaryCard,
  Txt,
} from '../components';
import type { RootNavigation } from '../navigation/types';
import { askStrings } from '../strings/ask';
import { errorMessage, genericMessage } from '../strings/errors';
import { fill } from '../strings/format';
import { guideTopicLabels } from '../strings/guide';
import { canSend, counterText, usedIds } from './ask/chat';
import { EMPTY_PLAN, applyEvent, canStop, failPlan } from './ask/answerPlan';
import type { AnswerPlan, MainCard } from './ask/answerPlan';

const EXAMPLES = ['example_go_bag', 'example_flood', 'example_evacuation'] as const;

interface Line {
  label: string;
  value: string;
}

interface Call {
  id: string;
  label: string;
}

/**
 * Ask (the assistant tab). One question at a time against `ask.run()`: the event stream is folded
 * into one {@link AnswerPlan}, then stacked top to bottom — emergency card, one main card, the AI
 * block, the phase line and the closing line. History lives in Settings/Evaluation, not here.
 */
export function AskScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const theme = useTheme();
  const t = useT(askStrings);
  const labels = useT(guideTopicLabels);
  const { lang } = useLang();
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['status', 'phase']);

  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [plan, setPlan] = useState<AnswerPlan>(EMPTY_PLAN);
  const [sourceVisible, setSourceVisible] = useState(false);
  const [undoHidden, setUndoHidden] = useState(false);
  const mounted = useRef(true);
  const runId = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const emergencyPinned = useRef(false);
  const maxLength = engine.ask.maxLength;
  const canUndo = engine.context.get().undo !== undefined && !undoHidden;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      engine.ask.cancel();
    };
  }, [engine]);

  useFocusEffect(useCallback(() => { engine.ask.warm(); }, [engine]));

  const send = (raw: string): void => {
    const text = raw.trim().slice(0, maxLength);
    if (!canSend(text, maxLength)) return;
    Keyboard.dismiss();
    engine.ask.cancel();
    const id = ++runId.current;
    emergencyPinned.current = false;
    setQuestion('');
    setUndoHidden(false);
    setSourceVisible(false);
    setAsked(text);
    setPlan(EMPTY_PLAN);
    void (async () => {
      try {
        for await (const event of engine.ask.run(text)) {
          if (!mounted.current || id !== runId.current) return;
          setPlan((current) => applyEvent(current, event));
        }
      } catch {
        if (mounted.current && id === runId.current) setPlan((current) => failPlan(current));
      }
    })();
  };

  const bulletinLines = (view: BulletinCardView): Line[] => {
    const { bulletin } = view;
    const lines: Line[] = [
      { label: t.bulletinName, value: bulletin.storm.name },
      { label: t.bulletinCategory, value: bulletin.storm.category },
      { label: t.bulletinPosition, value: bulletin.position.text },
    ];
    if (bulletin.movement) lines.push({ label: t.bulletinMovement, value: bulletin.movement.text });
    for (const area of bulletin.signalAreas) {
      lines.push({ label: fill(t.bulletinSignal, { level: area.level }), value: area.psgc.join(', ') });
    }
    return lines;
  };

  const planContent = (main: Extract<MainCard, { kind: 'plan_answer' }>): { lines: Line[]; calls: Call[] } => {
    switch (main.field) {
      case 'evacuation_center': {
        const value = main.center ?? main.text;
        return { lines: value ? [{ label: t.planCenter, value }] : [], calls: [] };
      }
      case 'meeting_place':
        return { lines: main.text ? [{ label: t.planMeeting, value: main.text }] : [], calls: [] };
      case 'contacts': {
        const contacts = main.contacts ?? [];
        return {
          lines: contacts.map((contact) => ({
            label: contact.relation ? `${contact.name} · ${contact.relation}` : contact.name,
            value: contact.phone,
          })),
          calls: contacts.map((contact) => ({ id: contact.phone, label: contact.name })),
        };
      }
      case 'hotlines': {
        const hotlines = main.hotlines ?? [];
        return { lines: [], calls: hotlines.map((hotline) => ({ id: hotline.id, label: `${hotline.name} · ${hotline.number}` })) };
      }
      default:
        return { lines: [], calls: [] };
    }
  };

  const callHotline = (id: string): void => { void engine.plan.call(id); };

  const mainNode = (main: MainCard): ReactNode => {
    switch (main.kind) {
      case 'fixed_reply':
        return <FixedReplyCard text={main.text} />;
      case 'bulletin_card':
        return (
          <View style={styles.bulletinSourceGroup}>
            <BulletinCard
              title={main.card.bulletin.source.title}
              lines={bulletinLines(main.card)}
              ageText={main.card.ageText}
              staleText={main.card.stale ? engine.copy('stale_warning', { lang }) : undefined}
              sourceLabel={sourceVisible ? t.hideSource : engine.copy('source_link', { lang })}
              onSource={() => setSourceVisible((visible) => !visible)}
            />
            {sourceVisible ? (
              <Txt role="bodySmall" tone="muted" selectable>
                {main.card.bulletin.source.agency} · {main.card.bulletin.source.title} · {main.card.bulletin.source.url}
              </Txt>
            ) : null}
          </View>
        );
      case 'plan_answer': {
        const content = planContent(main);
        return (
          <PlanAnswerCard
            title={t.planTitle}
            lines={content.lines}
            calls={content.calls}
            onCall={callHotline}
            empty={main.empty}
            emptyText={t.planEmpty}
            fillLabel={main.empty ? t.planFill : undefined}
            onFill={main.empty ? () => navigation.navigate('Tabs', { screen: 'Hotlines' }) : undefined}
          />
        );
      }
      case 'refusal':
        return (
          <RefusalCard
            text={main.text}
            suggestions={main.suggestions.map((topic) => ({ topic, label: labels[topic] }))}
            onSuggestion={(topic) => navigation.navigate('Tabs', { screen: 'Guide', params: { topic: topic as TopicGroup } })}
          />
        );
      case 'summary':
        return (
          <SummaryCard
            title={main.title}
            text={main.text}
            pinned={main.pinned}
            pinnedLabel={t.fromGuide}
            sourceLinkLabel={engine.copy('source_link', { lang })}
            onSource={() => navigation.navigate('Passage', { passageId: main.passageId })}
          />
        );
      default:
        return null;
    }
  };

  const aiNode = (ai: AnswerPlan['ai']): ReactNode => {
    switch (ai.state) {
      case 'loading_model':
        return (
          <AiStatusLine
            busy
            text={errorMessage(lang, 'model_state', 'loading') ?? t.aiSkipped}
            stopLabel={canStop(plan) ? t.stop : undefined}
            onStop={() => engine.ask.cancel()}
          />
        );
      case 'thinking':
        return (
          <AiStatusLine
            busy
            text={errorMessage(lang, 'model_state', 'generating') ?? t.aiSkipped}
            stopLabel={canStop(plan) ? t.stop : undefined}
            onStop={() => engine.ask.cancel()}
          />
        );
      case 'skipped':
        return (
          <AiStatusLine
            text={ai.reason ? errorMessage(lang, 'ai', ai.reason) ?? t.aiSkipped : t.aiSkipped}
          />
        );
      case 'partial':
        return (
          <AiBlock
            state="partial"
            text={ai.text}
            checkingLabel={t.checking}
            stopLabel={canStop(plan) ? t.stop : undefined}
            onStop={() => engine.ask.cancel()}
            onSource={() => undefined}
          />
        );
      case 'final':
        return (
          <AiBlock
            state="final"
            text={ai.text}
            checkingLabel={t.checking}
            sourceLinks={usedIds(ai.used).map((id) => ({ id, label: engine.copy('source_link', { lang }) }))}
            onSource={(id) => navigation.navigate('Passage', { passageId: id })}
          />
        );
      case 'rejected':
        return (
          <AiBlock
            state="rejected"
            rejectedText={errorMessage(lang, 'verifier', ai.code) ?? t.aiSkipped}
            checkingLabel={t.checking}
            onSource={() => undefined}
          />
        );
      default:
        return null;
    }
  };

  const phaseNode = (phase: AnswerPlan['phase']): ReactNode => {
    if (!phase) return null;
    if (phase.kind === 'recommended') {
      return (
        <PhaseChangeLine
          kind="recommended"
          text={phase.text}
          actionLabel={engine.copy(`phase_${phase.to}`, { lang })}
          onAction={() => engine.context.setPhase(phase.to)}
        />
      );
    }
    if (!canUndo) return null;
    return (
      <PhaseChangeLine
        kind="switched"
        text={phase.text}
        actionLabel={t.undo}
        onAction={() => {
          const result = engine.context.undoPhase();
          if (!result.ok && result.error.code === 'nothing_to_undo') setUndoHidden(true);
        }}
      />
    );
  };

  const answer = (
    <>
      {plan.emergency ? (
        <EmergencyCard
          title={plan.emergency.title}
          steps={plan.emergency.steps}
          hotlines={plan.emergency.hotlines}
          callLabel={t.call}
          onCall={callHotline}
        />
      ) : null}
      {plan.main ? mainNode(plan.main) : null}
      {aiNode(plan.ai)}
      {plan.failed ? <Txt role="bodySmall" tone="muted">{genericMessage(lang)}</Txt> : null}
      {phaseNode(plan.phase)}
      {plan.closing ? <ClosingLine text={plan.closing} /> : null}
    </>
  );

  const empty = (
    <View style={styles.empty}>
      <EmptyState icon="chatbubbles-outline" title={t.emptyTitle} body={t.emptyBody} />
      <Txt role="bodySmall" tone="muted" align="center">{t.examplesTitle}</Txt>
      <View style={styles.chips}>
        {EXAMPLES.map((key) => (
          <Chip key={key} label={t[key]} onPress={() => send(t[key])} />
        ))}
      </View>
    </View>
  );

  return (
    <Screen title={t.title} scroll={false} banner={<AppBanners />} right={<StatusBadges />}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={asked ? styles.answerContent : styles.emptyContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (plan.emergency) {
            if (!emergencyPinned.current) {
              emergencyPinned.current = true;
              scrollRef.current?.scrollTo({ y: 0, animated: false });
            }
            return;
          }
          scrollRef.current?.scrollToEnd({ animated: false });
        }}
      >
        {asked ? answer : empty}
      </ScrollView>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.composer}>
          <View style={styles.inputWrap}>
            <TextInput
              accessibilityLabel={t.inputLabel}
              value={question}
              onChangeText={setQuestion}
              maxLength={maxLength}
              placeholder={t.placeholder}
              placeholderTextColor={theme.colors.textMuted}
              maxFontSizeMultiplier={theme.type.maxFontSizeMultiplier}
              multiline
              returnKeyType={Platform.OS === 'web' ? 'send' : 'default'}
              onSubmitEditing={Platform.OS === 'web' ? () => send(question) : undefined}
              style={styles.input}
            />
            {question.length > 0 ? (
              <Txt role="caption" tone="muted" style={styles.counter}>{counterText(t.counter, question.length, maxLength)}</Txt>
            ) : null}
          </View>
          <Button
            label={t.send}
            accessibilityLabel={t.send}
            icon="send"
            variant="highlight"
            disabled={!canSend(question, maxLength)}
            onPress={() => send(question)}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (t: Theme) => {
  const inputMax = t.border.control * 2 + t.space.md * 2 + t.type.roles.body.lineHeight * 4;
  return StyleSheet.create({
    scroll: { flex: 1 },
    answerContent: { gap: t.space.lg, paddingBottom: t.space.md },
    bulletinSourceGroup: { gap: t.space.sm },
    emptyContent: { flexGrow: 1, justifyContent: 'center' },
    empty: { gap: t.space.md },
    chips: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: t.space.sm },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: t.space.sm,
      borderTopWidth: t.border.hairline,
      borderTopColor: t.colors.hairline,
      paddingTop: t.space.md,
    },
    inputWrap: {
      flex: 1,
      minWidth: 0,
      minHeight: t.minTouch,
      maxHeight: inputMax,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: t.space.sm,
    },
    input: {
      flex: 1,
      minHeight: t.minTouch,
      maxHeight: inputMax,
      color: t.colors.text,
      fontSize: t.type.roles.body.fontSize,
      lineHeight: t.type.roles.body.lineHeight,
      paddingHorizontal: t.space.md,
      paddingVertical: t.space.md,
      textAlignVertical: 'top',
      backgroundColor: t.colors.surfaceSunken,
      borderColor: t.colors.controlBorder,
      borderWidth: t.border.control,
      borderRadius: t.radius.panel,
    },
    counter: { alignSelf: 'flex-end', paddingBottom: t.space.md },
  });
};
