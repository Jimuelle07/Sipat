import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AccessibilityInfo, Animated, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AnswerEvent } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { Button, Card, Chip, SafetyText, Screen } from '../components';
import { useLang, useT } from '../i18n';
import { askStrings } from '../strings/ask';
import { colors, font, minTouch, radius, space } from '../theme';
import { cancelEvents, canSubmitQuestion, chatReducer, sourceLine } from './ask/chat';
import type { ChatMessage } from './ask/chat';

const EXAMPLES = ['example_go_bag', 'example_flood', 'example_evacuation'] as const;
let sessionMessages: ChatMessage[] = [];
let nextMessageId = 1;

function timeNow(): string {
  return new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
}

function IconButton({ icon, label, onPress }: { icon: 'trash-outline' | 'time-outline'; label: string; onPress: () => void }): JSX.Element {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconButton}><Ionicons name={icon} size={21} color={colors.text} /></Pressable>;
}

function AssistantAvatar(): JSX.Element {
  return <View style={styles.avatar}><Ionicons name="shield-checkmark" size={17} color={colors.accent} /></View>;
}

function TypingBubble({ label }: { label: string }): JSX.Element {
  const dots = useRef([new Animated.Value(0.35), new Animated.Value(0.35), new Animated.Value(0.35)]).current;
  useEffect(() => {
    let disposed = false;
    let animations: Animated.CompositeAnimation[] = [];
    void AccessibilityInfo.isReduceMotionEnabled().then((reducedMotion) => {
      if (disposed || reducedMotion) return;
      animations = dots.map((dot, index) => {
        const animation = Animated.loop(Animated.sequence([
          Animated.delay(index * 110),
          Animated.timing(dot, { toValue: 1, duration: 260, useNativeDriver: false }),
          Animated.timing(dot, { toValue: 0.35, duration: 260, useNativeDriver: false }),
          Animated.delay((2 - index) * 110),
        ]));
        animation.start();
        return animation;
      });
    }).catch(() => undefined);
    return () => { disposed = true; animations.forEach((animation) => animation.stop()); };
  }, [dots]);
  return <View style={styles.typingBubble}><View style={styles.dots}>{dots.map((opacity, index) => <Animated.Text key={index} style={[styles.dot, { opacity }]}>•</Animated.Text>)}</View><Text style={styles.muted}>{label}</Text></View>;
}

export function AskScreen(): JSX.Element {
  const engine = useEngine();
  const t = useT(askStrings);
  const { lang } = useLang();
  useEngineChange(['history', 'status']);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(sessionMessages);
  const [running, setRunning] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openSources, setOpenSources] = useState<Record<string, boolean>>({});
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
    const createdAt = timeNow();
    activeId.current = answerId;
    commit([...sessionMessages,
      { id: questionId, kind: 'question', text, time: createdAt },
      { id: answerId, kind: 'answer', question: text, time: createdAt, events: [] },
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

  const renderSource = (passageId: string): JSX.Element => {
    const open = openSources[passageId] === true;
    const detail = open ? engine.guide.passage(passageId) : null;
    return <View style={styles.sourceBlock}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => toggleSource(passageId)} style={styles.sourceToggle}>
        {open ? <Text style={styles.sourceLink}>{t.hideSource}</Text> : <View><Text style={styles.sourceLink}>{engine.copy('source_link')}</Text>{lang === 'en' ? <Text style={styles.sourceTranslation}>{engine.copy('source_link', 'en')}</Text> : null}</View>}
      </Pressable>
      {open ? detail ? <View style={styles.sourceDetail}>
        <Text style={styles.text}>{detail.source.agency} · {detail.source.title} · {detail.source.date}</Text>
        <Text selectable style={styles.url}>{detail.source.url}</Text>
        <Text style={styles.muted}>{t.reviewedBy}: {detail.reviewedBy} · {t.reviewedAt}: {detail.reviewedAt}</Text>
      </View> : <Text style={styles.muted}>{t.sourceUnavailable}</Text> : null}
    </View>;
  };

  const renderEvent = (event: AnswerEvent, index: number): JSX.Element | null => {
    switch (event.type) {
      case 'emergency_card': return <View key={`event-${index}`} style={[styles.answerBubble, styles.emergencyBubble]}>
        <Text style={styles.answerTitle}>{event.card.title}</Text>
        {event.card.steps.map((step, stepIndex) => <Text key={`${stepIndex}-${step}`} style={styles.text}>{stepIndex + 1}. {step}</Text>)}
        {event.card.hotlines.map((hotline) => <Pressable key={hotline.id} accessibilityRole="button" onPress={() => { void engine.plan.call(hotline.id); }} style={styles.hotlineRow}>
          <Ionicons name="call-outline" size={18} color={colors.danger} /><Text style={styles.text}>{hotline.name} · {hotline.number}</Text>
        </Pressable>)}
        <Text style={styles.muted}>{sourceLine(event.card.source)}</Text>
      </View>;
      case 'fixed_reply': return <View key={`event-${index}`} style={styles.answerBubble}><SafetyText copyKey={event.copyKey} /></View>;
      case 'refusal': return <View key={`event-${index}`} style={styles.answerBubble}>
        <SafetyText copyKey={event.copyKey} />
        {event.suggestions.length ? <View style={styles.suggestions}><Text style={styles.muted}>{t.suggestions}</Text><View style={styles.chips}>{event.suggestions.map((topic) => {
          const label = t[`topic_${topic}`];
          return <Chip key={topic} label={label} onPress={() => { void sendQuestion(`${t.askAbout} ${label}?`); }} />;
        })}</View></View> : null}
      </View>;
      case 'plan_answer': return <View key={`event-${index}`} style={styles.answerBubble}>
        {event.text ? <Text style={styles.text}>{event.text}</Text> : null}
        {event.center ? <Text style={styles.text}>{event.center.name} · {event.center.landmark}</Text> : null}
        {event.contacts?.map((contact, i) => <Text key={`${i}-${contact.name}`} style={styles.text}>{contact.name}{contact.phone ? ` · ${contact.phone}` : ''}</Text>)}
        {event.hotlines?.map((hotline) => <Pressable key={hotline.id} onPress={() => { void engine.plan.call(hotline.id); }} style={styles.hotlineRow}><Ionicons name="call-outline" size={18} color={colors.accent} /><Text style={styles.text}>{hotline.name} · {hotline.number}</Text></Pressable>)}
        {event.empty ? <Text style={styles.text}>{t.planEmpty}</Text> : null}
      </View>;
      case 'summary': return <View key={`event-${index}`} style={[styles.answerBubble, event.pinned && styles.pinnedBubble]}>
        {event.pinned ? <View style={styles.tag}><Text style={styles.tagText}>{t.pinned}</Text></View> : null}
        <Text style={styles.answerTitle}>{event.title}</Text><Text style={styles.text}>{event.text}</Text>
        {renderSource(event.passageId)}
      </View>;
      case 'ai_status': if (event.status === 'skipped') return <Text key={`event-${index}`} style={styles.muted}>{event.reason ? t[`aiReason_${event.reason}`] : t.aiSkipped}</Text>;
        return <TypingBubble key={`event-${index}`} label={event.status === 'loading_model' ? t.aiLoading : t.aiThinking} />;
      case 'ai_partial': return <View key={`event-${index}`} style={styles.answerBubble}><Text style={styles.aiLabel}>{t.aiLabel}</Text><Text style={styles.text}>{event.text}</Text></View>;
      case 'ai_final': return <View key={`event-${index}`} style={styles.answerBubble}><Text style={styles.aiLabel}>{t.aiLabel}</Text><Text style={styles.text}>{event.text}</Text>{event.used.map((passageId) => <View key={passageId}>{renderSource(passageId)}</View>)}</View>;
      case 'ai_rejected': return <View key={`event-${index}`} style={styles.answerBubble}><Text style={styles.muted}>{t.aiRejected}</Text>{renderSource(event.fallbackPassageId)}</View>;
      case 'closing': return <View key={`event-${index}`} style={styles.closing}><SafetyText copyKey={event.copyKey} /></View>;
      case 'done': return null;
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }): JSX.Element => item.kind === 'question' ? <View style={styles.questionRow}>
    <View style={styles.questionBubble}><Text style={styles.text}>{item.text}</Text><Text style={styles.questionTime}>{item.time}</Text></View>
  </View> : <View style={styles.assistantRow}>
    <AssistantAvatar />
    <View style={styles.answerColumn}>
      <Text style={styles.assistantName}>{t.assistantName}</Text>
      {item.events.map(renderEvent)}
      {lang === 'en' && item.events.some((event) => event.type === 'summary') ? <Text style={styles.muted}>{t.filipinoNote}</Text> : null}
      {item.error ? <View style={styles.answerBubble}><Text style={styles.errorText}>{t.failed}</Text><Button label={t.retry} icon="refresh-outline" variant="secondary" onPress={() => retry(item.question)} /></View> : null}
      <Text style={styles.muted}>{item.time}</Text>
    </View>
  </View>;

  const emptyThread = <View style={styles.welcomeWrap}>
    <AssistantAvatar />
    <View style={styles.welcomeBubble}><Text style={styles.answerTitle}>{t.assistantName}</Text><Text style={styles.text}>{t.welcome}</Text></View>
    <Text style={styles.suggestionTitle}>{t.suggestionTitle}</Text>
    <View style={styles.chips}>{EXAMPLES.map((key) => <Chip key={key} label={t[key]} onPress={() => { void sendQuestion(t[key]); }} />)}</View>
  </View>;

  const headerRight = <View style={styles.headerActions}>
    <IconButton icon="time-outline" label={t.historyTitle} onPress={() => setHistoryOpen((open) => !open)} />
    <IconButton icon="trash-outline" label={t.clearChat} onPress={clearChat} />
  </View>;

  return <Screen title={t.title} scroll={false} right={headerRight}>
    {historyOpen ? <View style={styles.historyPanel}>
      <View style={styles.historyHeader}><Text style={styles.answerTitle}>{t.historyTitle}</Text><Pressable accessibilityRole="button" onPress={() => { engine.history.clear(); }} style={styles.clearHistory}><Text style={styles.sourceLink}>{t.clearHistory}</Text></Pressable></View>
      {history.length === 0 ? <Text style={styles.muted}>{t.historyEmpty}</Text> : history.map((entry) => <Pressable key={entry.id} onPress={() => { void sendQuestion(entry.question); }} style={styles.historyRow}>
        <Text numberOfLines={1} style={styles.text}>{entry.question}</Text><Text style={styles.muted}>{t[`outcome_${entry.outcome}`]} · {entry.at}</Text>
      </Pressable>)}
    </View> : null}
    <FlatList ref={listRef} style={styles.thread} contentContainerStyle={messages.length === 0 ? styles.emptyContent : styles.threadContent}
      data={messages} keyExtractor={(item) => item.id} renderItem={renderMessage} ListEmptyComponent={emptyThread}
      keyboardShouldPersistTaps="handled" onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <View style={styles.composer}>
        <View style={styles.inputWrap}>
          <TextInput accessibilityLabel={t.inputLabel} value={question} onChangeText={setQuestion} maxLength={maxLength}
            placeholder={t.placeholder} placeholderTextColor={colors.muted} multiline returnKeyType={Platform.OS === 'web' ? 'send' : 'default'}
            onSubmitEditing={Platform.OS === 'web' ? () => { void sendQuestion(question); } : undefined}
            style={styles.input} />
          {question.length > 150 ? <Text style={styles.counter}>{question.length}/{maxLength}</Text> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={running ? t.cancel : t.ask} disabled={!running && !canSubmitQuestion(question)}
          onPress={running ? cancel : () => { void sendQuestion(question); }} style={[styles.sendButton, !running && !canSubmitQuestion(question) && styles.sendDisabled]}>
          <Ionicons name={running ? 'stop' : 'send'} size={20} color={colors.accentText} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  </Screen>;
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  iconButton: { width: minTouch, height: minTouch, justifyContent: 'center', alignItems: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  thread: { flex: 1 }, threadContent: { gap: space.lg, paddingBottom: space.md }, emptyContent: { flexGrow: 1, justifyContent: 'center' },
  welcomeWrap: { alignItems: 'center', gap: space.md, paddingVertical: space.xl },
  welcomeBubble: { maxWidth: '90%', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  suggestionTitle: { color: colors.muted, fontSize: font.sm, marginTop: space.md }, chips: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: space.sm },
  questionRow: { alignItems: 'flex-end' }, questionBubble: { maxWidth: '84%', backgroundColor: colors.accent, borderRadius: radius.lg, borderBottomRightRadius: radius.sm, padding: space.md, gap: space.xs },
  questionTime: { color: '#16463F', fontSize: font.xs, textAlign: 'right' }, text: { color: colors.text, fontSize: font.md, lineHeight: 25 },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }, avatar: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  answerColumn: { flex: 1, gap: space.sm, alignItems: 'flex-start' }, assistantName: { color: colors.muted, fontSize: font.xs, fontWeight: '700', marginLeft: 2 },
  answerBubble: { maxWidth: '100%', alignSelf: 'stretch', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, borderTopLeftRadius: radius.sm, padding: space.md, gap: space.sm },
  pinnedBubble: { borderColor: colors.accent }, emergencyBubble: { backgroundColor: colors.dangerSurface, borderColor: colors.danger }, answerTitle: { color: colors.text, fontSize: font.lg, fontWeight: '700' },
  tag: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised }, tagText: { color: colors.accent, fontSize: font.xs, fontWeight: '700' },
  sourceBlock: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.xs }, sourceToggle: { minHeight: minTouch, justifyContent: 'center' }, sourceLink: { color: colors.accent, fontSize: font.sm, fontWeight: '700' }, sourceTranslation: { color: colors.muted, fontSize: font.xs },
  sourceDetail: { gap: space.xs, paddingVertical: space.sm }, url: { color: colors.accent, fontSize: font.sm }, muted: { color: colors.muted, fontSize: font.sm, lineHeight: 21 },
  closing: { paddingHorizontal: space.sm }, aiLabel: { color: colors.accent, fontSize: font.xs, fontWeight: '700' }, typingBubble: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.lg, backgroundColor: colors.surface, padding: space.md }, dots: { flexDirection: 'row', gap: 2 }, dot: { color: colors.accent, fontSize: font.lg, lineHeight: font.lg },
  suggestions: { gap: space.xs }, hotlineRow: { minHeight: minTouch, flexDirection: 'row', alignItems: 'center', gap: space.sm }, errorText: { color: colors.danger, fontSize: font.md },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md }, inputWrap: { flex: 1, minHeight: minTouch, maxHeight: 150, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'flex-end' },
  input: { flex: 1, minHeight: minTouch, maxHeight: 145, color: colors.text, fontSize: font.md, paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.md, textAlignVertical: 'center' }, counter: { color: colors.muted, fontSize: font.xs, alignSelf: 'flex-end', paddingBottom: space.sm, paddingRight: space.sm },
  sendButton: { width: minTouch, height: minTouch, borderRadius: radius.pill, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }, sendDisabled: { opacity: 0.42 },
  historyPanel: { maxHeight: 190, gap: space.sm, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: space.md }, historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, clearHistory: { minHeight: minTouch, justifyContent: 'center', paddingHorizontal: space.sm }, historyRow: { minHeight: minTouch, justifyContent: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.xs },
});
