import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import type { AccessibilityState } from 'react-native';
import type { AnswerEvent, TopicGroup } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { useLang, useT } from '../i18n';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import {
  AiBlock,
  AiStatusLine,
  Button,
  Chip,
  ClosingLine,
  EmergencyCard,
  EmptyState,
  FixedReplyCard,
  PlanAnswerCard,
  RefusalCard,
  Screen,
  SummaryCard,
  Txt,
} from '../components';
import { askStrings } from '../strings/ask';
import { cancelEvents, canSubmitQuestion, chatReducer, sourceLine } from './ask/chat';
import type { ChatMessage } from './ask/chat';

const EXAMPLES = ['example_go_bag', 'example_flood', 'example_evacuation'] as const;
let sessionMessages: ChatMessage[] = [];
let nextMessageId = 1;

function IconButton({ icon, label, onPress, accessibilityState }: { icon: 'trash-outline' | 'time-outline'; label: string; onPress: () => void; accessibilityState?: AccessibilityState }): JSX.Element {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={accessibilityState} onPress={onPress} style={styles.iconButton}>
      <Ionicons name={icon} size={theme.type.roles.label.fontSize} color={theme.colors.text} />
    </Pressable>
  );
}

function AssistantAvatar(): JSX.Element {
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.avatar}>
      <Ionicons name="shield-checkmark" size={theme.type.roles.label.fontSize} color={theme.colors.accentText} />
    </View>
  );
}

export function AskScreen(): JSX.Element {
  const engine = useEngine();
  const theme = useTheme();
  const t = useT(askStrings);
  const styles = useThemedStyles(makeStyles);
  const { lang } = useLang();
  useEngineChange(['history', 'status']);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(sessionMessages);
  const [running, setRunning] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openSources, setOpenSources] = useState<Record<string, boolean>>({});
  const [composerFocused, setComposerFocused] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const mounted = useRef(true);
  const runId = useRef(0);
  const activeId = useRef<string | null>(null);
  const maxLength = engine.ask.maxLength;
  const history = engine.history.list(10);

  const commit = (next: ChatMessage[]): void => {
    sessionMessages = next;
    setMessages(next);
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; engine.ask.cancel(); };
  }, [engine]);

  useFocusEffect(useCallback(() => { engine.ask.warm(); }, [engine]));

  const sendQuestion = async (rawQuestion: string): Promise<void> => {
    const text = rawQuestion.trim().slice(0, maxLength);
    if (!canSubmitQuestion(text) || running) return;
    Keyboard.dismiss();
    setQuestion('');
    setHistoryOpen(false);
    setOpenSources({});
    const questionId = `q-${nextMessageId++}`;
    const answerId = `a-${nextMessageId++}`;
    activeId.current = answerId;
    commit([...sessionMessages,
      { id: questionId, kind: 'question', text },
      { id: answerId, kind: 'answer', question: text, events: [] },
    ]);
    const id = ++runId.current;
    setRunning(true);
    try {
      for await (const event of engine.ask.run(text)) {
        if (!mounted.current || id !== runId.current) return;
        commit(chatReducer(sessionMessages, event));
      }
    } catch {
      if (mounted.current && id === runId.current) {
        commit(sessionMessages.map((message) => message.id === answerId && message.kind === 'answer' ? { ...message, error: true } : message));
      }
    } finally {
      if (mounted.current && id === runId.current) setRunning(false);
    }
  };

  const cancel = (): void => {
    runId.current += 1;
    engine.ask.cancel();
    const id = activeId.current;
    if (id) commit(sessionMessages.map((message) => message.id === id && message.kind === 'answer' ? { ...message, events: cancelEvents(message.events) } : message));
    setRunning(false);
  };

  const clearChat = (): void => {
    runId.current += 1;
    engine.ask.cancel();
    activeId.current = null;
    setRunning(false);
    commit([]);
    setOpenSources({});
  };

  const retry = (text: string): void => {
    const failed = sessionMessages.at(-1);
    if (failed?.kind === 'answer' && failed.error) commit(sessionMessages.slice(0, -2));
    void sendQuestion(text);
  };

  const toggleSource = (id: string): void => setOpenSources((current) => ({ ...current, [id]: !current[id] }));

  const topicLabel = (topic: string): string => t[`topic_${topic as TopicGroup}`];

  const renderSourceDetail = (passageId: string): JSX.Element => {
    const detail = engine.guide.passage(passageId);
    if (detail === null) return <Txt role="bodySmall" tone="muted">{t.sourceUnavailable}</Txt>;
    return (
      <View style={styles.sourceDetail}>
        <Txt role="bodySmall" tone="muted">{detail.source.agency} · {detail.source.title} · {detail.source.date}</Txt>
        <Txt role="bodySmall" tone="brand" selectable>{detail.source.url}</Txt>
        <Txt role="bodySmall" tone="muted">{t.reviewedBy}: {detail.reviewedBy} · {t.reviewedAt}: {detail.reviewedAt}</Txt>
      </View>
    );
  };

  const planLines = (event: Extract<AnswerEvent, { type: 'plan_answer' }>): { label: string; value: string }[] => {
    if (event.field === 'evacuation_center') {
      const value = event.center ?? event.text;
      return value ? [{ label: t.planLabel_evacuation_center, value }] : [];
    }
    if (event.field === 'meeting_place') {
      return event.text ? [{ label: t.planLabel_meeting_place, value: event.text }] : [];
    }
    if (event.field === 'contacts') {
      return event.text ? [{ label: t.planLabel_contacts, value: event.text }] : [];
    }
    return [];
  };

  const renderEvent = (event: AnswerEvent, index: number): JSX.Element | null => {
    const key = `event-${index}`;
    switch (event.type) {
      case 'emergency_card':
        return (
          <View key={key} style={styles.eventBlock}>
            <EmergencyCard
              title={event.card.title}
              steps={event.card.steps}
              hotlines={event.card.hotlines}
              callLabel={t.call}
              onCall={(id) => { void engine.plan.call(id); }}
            />
            <Txt role="bodySmall" tone="muted" style={styles.sourceLine}>{sourceLine(event.card.source)}</Txt>
          </View>
        );
      case 'fixed_reply':
        return <FixedReplyCard key={key} text={event.text} />;
      case 'plan_answer':
        return (
          <PlanAnswerCard
            key={key}
            title={t.planAnswerTitle}
            lines={planLines(event)}
            calls={event.hotlines?.map((hotline) => ({ id: hotline.id, label: `${hotline.name} · ${hotline.number}` }))}
            onCall={(id) => { void engine.plan.call(id); }}
            empty={event.empty}
            emptyText={t.planEmpty}
          />
        );
      case 'refusal':
        return (
          <RefusalCard
            key={key}
            text={event.text}
            suggestions={event.suggestions.map((topic) => ({ topic, label: topicLabel(topic) }))}
            onSuggestion={(topic) => { void sendQuestion(`${t.askAbout} ${topicLabel(topic)}?`); }}
          />
        );
      case 'summary': {
        const open = openSources[event.passageId] === true;
        return (
          <View key={key} style={styles.eventBlock}>
            <SummaryCard
              title={event.title}
              text={event.text}
              pinned={event.pinned}
              pinnedLabel={t.fromGuide}
              sourceLinkLabel={open ? t.hideSource : engine.copy('source_link')}
              onSource={() => toggleSource(event.passageId)}
            />
            {open ? renderSourceDetail(event.passageId) : null}
          </View>
        );
      }
      case 'ai_status':
        return event.status === 'skipped'
          ? <AiStatusLine key={key} text={event.reason ? t[`aiReason_${event.reason}`] : t.aiSkipped} />
          : <AiStatusLine key={key} text={event.status === 'loading_model' ? t.aiLoading : t.aiThinking} busy />;
      case 'ai_partial':
        return (
          <AiBlock
            key={key}
            state="partial"
            text={event.text}
            checkingLabel={t.checking}
            stopLabel={t.cancel}
            onStop={cancel}
            onSource={toggleSource}
          />
        );
      case 'ai_final':
        return (
          <View key={key} style={styles.eventBlock}>
            <AiBlock
              state="final"
              text={event.text}
              checkingLabel={t.checking}
              sourceLinks={event.used.map((passageId) => ({ id: passageId, label: engine.copy('source_link') }))}
              onSource={toggleSource}
            />
            {event.used.filter((passageId) => openSources[passageId] === true).map((passageId) => (
              <View key={passageId}>{renderSourceDetail(passageId)}</View>
            ))}
          </View>
        );
      case 'ai_rejected':
        return (
          <AiBlock
            key={key}
            state="rejected"
            rejectedText={t.aiRejected}
            checkingLabel={t.checking}
            onSource={toggleSource}
          />
        );
      case 'closing':
        return <ClosingLine key={key} text={event.text} />;
      case 'done':
        return null;
      default:
        return null;
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }): JSX.Element => item.kind === 'question' ? (
    <View style={styles.questionRow}>
      <View style={styles.questionBubble}>
        <Txt role="body" color={theme.colors.selected.ink}>{item.text}</Txt>
      </View>
    </View>
  ) : (
    <View style={styles.assistantRow}>
      <AssistantAvatar />
      <View style={styles.answerColumn}>
        <Txt role="caption" tone="muted" style={styles.assistantName}>{t.assistantName}</Txt>
        {item.events.map(renderEvent)}
        {lang === 'en' && item.events.some((event) => event.type === 'summary') ? <Txt role="bodySmall" tone="muted">{t.filipinoNote}</Txt> : null}
        {item.error ? (
          <View style={styles.errorTile}>
            <Txt role="body" tone="muted">{t.failed}</Txt>
            <Button label={t.retry} icon="refresh-outline" variant="tonal" onPress={() => retry(item.question)} />
          </View>
        ) : null}
      </View>
    </View>
  );

  const emptyThread = (
    <View style={styles.welcomeWrap}>
      <EmptyState icon="chatbubbles-outline" title={t.assistantName} body={t.welcome} />
      <Txt role="bodySmall" tone="muted" align="center">{t.suggestionTitle}</Txt>
      <View style={styles.chips}>
        {EXAMPLES.map((key) => <Chip key={key} label={t[key]} onPress={() => { void sendQuestion(t[key]); }} />)}
      </View>
    </View>
  );

  const headerRight = (
    <View style={styles.headerActions}>
      <IconButton icon="time-outline" label={t.historyTitle} accessibilityState={{ expanded: historyOpen }} onPress={() => setHistoryOpen((open) => !open)} />
      <IconButton icon="trash-outline" label={t.clearChat} onPress={clearChat} />
    </View>
  );

  const disabled = !running && !canSubmitQuestion(question);

  return (
    <Screen title={t.title} scroll={false} right={headerRight}>
      {historyOpen ? (
        <View style={styles.historyPanel}>
          <View style={styles.historyHeader}>
            <Txt role="title">{t.historyTitle}</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel={t.clearHistory} onPress={() => { engine.history.clear(); }} style={styles.clearHistory}>
              <Txt role="label" tone="brand">{t.clearHistory}</Txt>
            </Pressable>
          </View>
          {history.length === 0 ? <Txt role="bodySmall" tone="muted">{t.historyEmpty}</Txt> : history.map((entry) => (
            <Pressable key={entry.id} accessibilityRole="button" accessibilityLabel={entry.question} onPress={() => { void sendQuestion(entry.question); }} style={styles.historyRow}>
              <Txt role="body" numberOfLines={1}>{entry.question}</Txt>
              <Txt role="bodySmall" tone="muted">{t[`outcome_${entry.outcome}`]} · {entry.at}</Txt>
            </Pressable>
          ))}
        </View>
      ) : null}
      <FlatList
        ref={listRef}
        style={styles.thread}
        contentContainerStyle={messages.length === 0 ? styles.emptyContent : styles.threadContent}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        ListEmptyComponent={emptyThread}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
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
              onSubmitEditing={Platform.OS === 'web' ? () => { void sendQuestion(question); } : undefined}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              style={[styles.input, composerFocused && styles.inputFocused]}
            />
            {question.length > 0 ? <Txt role="caption" tone="muted" style={styles.counter}>{question.length}/{maxLength}</Txt> : null}
          </View>
          <Button
            label={running ? t.cancel : t.ask}
            accessibilityLabel={running ? t.cancel : t.ask}
            icon={running ? 'stop' : 'send'}
            variant={running ? 'outline' : 'highlight'}
            disabled={disabled}
            onPress={running ? cancel : () => { void sendQuestion(question); }}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const makeStyles = (t: Theme) => {
  const avatar = t.type.roles.title.lineHeight + t.space.md;
  const inputMax = t.minTouch * 3;
  return StyleSheet.create({
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: t.space.xs },
    iconButton: {
      width: t.minTouch,
      height: t.minTouch,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.surface,
      borderColor: t.colors.hairline,
      borderWidth: t.border.hairline,
    },
    thread: { flex: 1 },
    threadContent: { gap: t.space.lg, paddingBottom: t.space.md },
    emptyContent: { flexGrow: 1, justifyContent: 'center' },
    welcomeWrap: { alignItems: 'center', gap: t.space.md, paddingVertical: t.space.xl },
    chips: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: t.space.sm },
    questionRow: { alignItems: 'flex-end' },
    questionBubble: {
      maxWidth: '84%',
      backgroundColor: t.colors.selected.fill,
      borderRadius: t.radius.panel,
      padding: t.space.md,
      gap: t.space.xs,
    },
    assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: t.space.sm },
    avatar: {
      width: avatar,
      height: avatar,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.surface,
      borderColor: t.colors.hairline,
      borderWidth: t.border.hairline,
      justifyContent: 'center',
      alignItems: 'center',
    },
    answerColumn: { flex: 1, gap: t.space.sm, alignItems: 'flex-start' },
    assistantName: { marginLeft: t.space.xs },
    eventBlock: { alignSelf: 'stretch', gap: t.space.sm },
    sourceLine: { paddingHorizontal: t.space.xs },
    sourceDetail: {
      gap: t.space.xs,
      padding: t.space.md,
      backgroundColor: t.colors.surfaceSunken,
      borderRadius: t.radius.form,
    },
    errorTile: {
      alignSelf: 'stretch',
      gap: t.space.md,
      padding: t.space.tile,
      backgroundColor: t.colors.surface,
      borderColor: t.colors.danger.fill,
      borderWidth: t.border.hairline,
      borderRadius: t.radius.panel,
    },
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
      minHeight: t.minTouch,
      maxHeight: inputMax,
      flexDirection: 'row',
      alignItems: 'flex-end',
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
    inputFocused: {
      borderColor: t.colors.focus,
    },
    counter: { alignSelf: 'flex-end', paddingBottom: t.space.sm, paddingRight: t.space.sm },
    historyPanel: {
      maxHeight: t.minTouch * 4,
      gap: t.space.sm,
      backgroundColor: t.colors.surface,
      borderColor: t.colors.hairline,
      borderWidth: t.border.hairline,
      borderRadius: t.radius.panel,
      padding: t.space.md,
    },
    historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    clearHistory: { minHeight: t.minTouch, justifyContent: 'center', paddingHorizontal: t.space.sm },
    historyRow: {
      minHeight: t.minTouch,
      justifyContent: 'center',
      borderTopWidth: t.border.hairline,
      borderTopColor: t.colors.hairline,
      paddingTop: t.space.xs,
    },
  });
};
