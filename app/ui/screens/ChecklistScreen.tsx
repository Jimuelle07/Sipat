import type { JSX } from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { ChecklistGroupId } from '../../engine';
import { useEngine, useEngineChange } from '../context/useEngine';
import { AppBanners } from '../context/AppChrome';
import { Button, ChecklistRow, EmptyState, ProgressBar, Screen, Tag, Tile, Txt } from '../components';
import { useT } from '../i18n';
import { checklistStrings } from '../strings/checklist';
import { commonStrings } from '../strings/common';
import { fill } from '../strings/format';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import type { RootNavigation } from '../navigation/types';

type GroupLabelKey = 'group_now' | 'group_go_bag' | 'group_home' | 'group_evacuate' | 'group_after';

const GROUP_LABELS: Record<ChecklistGroupId, GroupLabelKey> = {
  now: 'group_now',
  go_bag: 'group_go_bag',
  home: 'group_home',
  evacuate: 'group_evacuate',
  after: 'group_after',
};

export function ChecklistScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const t = useT(checklistStrings);
  const common = useT(commonStrings);
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [, setRevision] = useState(0);
  useEngineChange(['checklist', 'phase', 'context', 'profiles', 'family']);

  const [confirmReset, setConfirmReset] = useState(false);
  const view = engine.checklist.view();
  const { done, total } = view.progress;

  const toggle = (itemId: string, ticked: boolean): void => {
    const result = engine.checklist.tick(itemId, ticked);
    // 'unknown_item' is recorded, not shown: just re-read the engine's view.
    if (!result.ok) setRevision((value) => value + 1);
  };

  return (
    <Screen
      title={t.title}
      back={{ label: t.back, onPress: navigation.goBack }}
      banner={<AppBanners />}
    >
      <Txt role="bodySmall" tone="muted">{t.intro}</Txt>

      {view.warningCards.length > 0 ? (
        <View style={styles.warnings}>
          {view.warningCards.map((card) => (
            <Tag
              key={card.warningId}
              label={card.label}
              icon="warning"
              tone={card.stale ? theme.colors.dangerSurface : undefined}
            />
          ))}
        </View>
      ) : null}

      <Tile>
        <ProgressBar
          value={total === 0 ? 0 : done / total}
          label={fill(t.progressLabel, { done, total })}
        />
      </Tile>

      {view.groups.length === 0 ? (
        <Tile>
          <EmptyState icon="checkmark-done-outline" title={t.emptyTitle} body={t.emptyBody} />
        </Tile>
      ) : view.groups.map((group) => (
        <Tile
          key={group.id}
          title={t[GROUP_LABELS[group.id]]}
          tone={group.recommended ? 'accent' : 'default'}
          tag={group.recommended ? { label: common.recommended } : undefined}
        >
          {group.items.map((item) => (
            <ChecklistRow
              key={item.id}
              text={item.text}
              ticked={item.ticked}
              critical={item.critical}
              criticalLabel={t.critical}
              onToggle={() => toggle(item.id, !item.ticked)}
              tag={item.forMembers !== undefined && item.forMembers.length > 0
                ? { label: fill(t.forWho, { names: item.forMembers.map((member) => member.name).join(', ') }) }
                : undefined}
            />
          ))}
        </Tile>
      ))}

      {confirmReset ? (
        <Tile>
          <Txt role="body">{t.resetConfirm}</Txt>
          <View style={styles.actions}>
            <Button label={t.cancel} variant="tonal" onPress={() => setConfirmReset(false)} />
            <Button
              label={t.resetConfirmAction}
              variant="danger"
              icon="refresh"
              onPress={() => {
                engine.checklist.reset();
                setConfirmReset(false);
              }}
            />
          </View>
        </Tile>
      ) : (
        <Button
          label={t.reset}
          variant="text"
          icon="refresh"
          onPress={() => setConfirmReset(true)}
        />
      )}
    </Screen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  warnings: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.space.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: t.space.sm,
  },
});
