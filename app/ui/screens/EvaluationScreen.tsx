import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { Outcome } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { AppBanners } from '../context/AppChrome';
import { useT } from '../i18n';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { evaluationStrings } from '../strings/evaluation';
import { fill } from '../strings/format';
import { EmptyState, Screen, SectionHeader, Tag, Tile, Txt } from '../components';
import type { RootNavigation } from '../navigation/types';

const outcomeKeys: Record<Outcome, keyof typeof evaluationStrings.tl> = {
  answered_ai: 'outcome_answered_ai',
  answered_summary: 'outcome_answered_summary',
  refused: 'outcome_refused',
  fixed_reply: 'outcome_fixed_reply',
  bulletin_card: 'outcome_bulletin_card',
  plan_answer: 'outcome_plan_answer',
  cancelled: 'outcome_cancelled',
};

function TableRow({ label, value }: { label: string; value: string }): JSX.Element {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Txt role="bodySmall" tone="muted" style={styles.rowLabel}>{label}</Txt>
      <Txt role="body" style={styles.rowValue}>{value}</Txt>
    </View>
  );
}

/** Tidies an ISO 8601 stamp for reading, without parsing it: "2026-10-10T05:54:29+08:00" -> "2026-10-10 05:54". */
function shortTime(iso: string): string {
  const [date, rest] = iso.split('T');
  if (date === undefined || rest === undefined || rest.length < 5) return iso;
  return `${date} ${rest.slice(0, 5)}`;
}

/**
 * Evaluation: the laptop report bundled at build time (retrieval, answers, phase cases and the
 * on-phone timings) as a quiet table, then the question history newest first. Every number is
 * shown exactly as the engine reports it.
 */
export function EvaluationScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const t = useT(evaluationStrings);
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['history']);

  const summary = engine.evaluation.summary();
  const history = engine.history.list();

  return (
    <Screen title={t.title} banner={<AppBanners />} back={{ label: t.back, onPress: navigation.goBack }}>
      {summary === null ? (
        <EmptyState icon="stats-chart-outline" title={t.empty} />
      ) : (
        <>
          <Txt role="bodySmall" tone="muted">{fill(t.generatedAt, { at: shortTime(summary.generatedAt) })}</Txt>

          <View style={styles.group}>
            <SectionHeader title={t.retrievalTitle} />
            <Tile>
              <TableRow label={t.hitAt2} value={String(summary.retrieval.hitAt2)} />
              <TableRow label={t.correctRefusal} value={String(summary.retrieval.correctRefusal)} />
              <TableRow label={t.emergencyTrigger} value={String(summary.retrieval.emergencyTrigger)} />
              <TableRow label={t.liveDataReply} value={String(summary.retrieval.liveDataReply)} />
            </Tile>
          </View>

          <View style={styles.group}>
            <SectionHeader title={t.answersTitle} />
            <Tile>
              <TableRow
                label={t.faithfulness}
                value={summary.answers.faithfulness === null ? t.noneValue : String(summary.answers.faithfulness)}
              />
              <TableRow label={t.numberCheckPass} value={String(summary.answers.numberCheckPass)} />
            </Tile>
          </View>

          <View style={styles.group}>
            <SectionHeader title={t.phaseTitle} />
            <Tile>
              <TableRow label={t.casesPassed} value={String(summary.phase.casesPassed)} />
              <TableRow label={t.casesTotal} value={String(summary.phase.casesTotal)} />
              <TableRow
                label={t.wrongDirection}
                value={String(summary.phase.wrongDirection)}
              />
              {summary.phase.wrongDirection > 0 ? <Tag label={t.wrongDirectionAlert} tone={theme.colors.dangerSurface} icon="alert-circle-outline" /> : null}
            </Tile>
          </View>

          {summary.device.summaryP50Ms !== undefined || summary.device.firstWordsP50Ms !== undefined
            || summary.device.fullAnswerP50Ms !== undefined || summary.device.peakRamMb !== undefined ? (
            <View style={styles.group}>
              <SectionHeader title={t.deviceTitle} />
              <Tile>
                {summary.device.summaryP50Ms !== undefined ? (
                  <TableRow label={t.summaryP50} value={`${summary.device.summaryP50Ms} ${t.msUnit}`} />
                ) : null}
                {summary.device.firstWordsP50Ms !== undefined ? (
                  <TableRow label={t.firstWordsP50} value={`${summary.device.firstWordsP50Ms} ${t.msUnit}`} />
                ) : null}
                {summary.device.fullAnswerP50Ms !== undefined ? (
                  <TableRow label={t.fullAnswerP50} value={`${summary.device.fullAnswerP50Ms} ${t.msUnit}`} />
                ) : null}
                {summary.device.peakRamMb !== undefined ? (
                  <TableRow label={t.peakRam} value={`${summary.device.peakRamMb} ${t.mbUnit}`} />
                ) : null}
                <Txt role="caption" tone="muted">{t.deviceNote}</Txt>
              </Tile>
            </View>
          ) : null}
        </>
      )}

      <View style={styles.group}>
        <SectionHeader title={t.historyTitle} />
        <Tile>
          {history.length === 0 ? <Txt role="bodySmall" tone="muted">{t.noHistory}</Txt> : history.map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <Txt role="body">{entry.question}</Txt>
              <View style={styles.historyMeta}>
                <Txt role="caption" tone="muted" style={styles.historyOutcome}>{t[outcomeKeys[entry.outcome]]}</Txt>
                <Txt role="caption" tone="muted">{shortTime(entry.at)}</Txt>
              </View>
            </View>
          ))}
        </Tile>
      </View>
    </Screen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  group: {
    gap: t.space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: t.space.gutter,
  },
  rowLabel: {
    flexShrink: 1,
  },
  rowValue: {
    flexShrink: 0,
    textAlign: 'right',
  },
  historyRow: {
    gap: t.space.xs,
    paddingVertical: t.space.xs,
    borderBottomWidth: t.border.hairline,
    borderBottomColor: t.colors.hairline,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
  },
  historyOutcome: {
    flexShrink: 1,
  },
});
