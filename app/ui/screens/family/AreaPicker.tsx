import type { JSX } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PlaceOption } from '../../../engine';
import { useEngine, useEngineChange } from '../../context/useEngine';
import { InlineError, Txt } from '../../components';
import { useLang, useT } from '../../i18n';
import { errorMessage } from '../../strings/errors';
import { profileStrings } from '../../strings/profile';
import { useTheme, useThemedStyles } from '../../theme';
import type { Theme } from '../../theme';

export interface AreaPickerProps {
  /** Called after a barangay is saved, so a wizard step can move on or a sheet can close. */
  onPicked?: () => void;
}

/** Depth-first search for the chain of places that ends at `psgc`, so the current area can be named. */
function pathTo(places: (parent?: string) => PlaceOption[], psgc: string): PlaceOption[] {
  const visit = (parent?: string): PlaceOption[] | null => {
    for (const place of places(parent)) {
      if (place.psgc === psgc) return [place];
      if (place.hasChildren) {
        const deeper = visit(place.psgc);
        if (deeper) return [place, ...deeper];
      }
    }
    return null;
  };
  return visit(undefined) ?? [];
}

/**
 * Household area drill-down: province, then municipality or city, then barangay. The current
 * area from `family.location.get()` is named at the top; picking a barangay saves it through
 * `family.location.setArea()`. Content only, so callers frame it in a Tile.
 */
export function AreaPicker({ onPicked }: AreaPickerProps): JSX.Element {
  const engine = useEngine();
  const t = useT(profileStrings);
  const { lang } = useLang();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['profiles', 'family']);

  const [path, setPath] = useState<PlaceOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const places = (parent?: string): PlaceOption[] => engine.family.location.places(parent);
  const location = engine.family.location.get();
  const currentPath = location ? pathTo(places, location.psgc) : [];
  const currentName = currentPath.length > 0 ? currentPath[currentPath.length - 1]?.name : undefined;

  const parentPsgc = path.length > 0 ? path[path.length - 1]?.psgc : undefined;
  const options = places(parentPsgc);
  const upLabel = path.length > 1 ? path[path.length - 2]?.name ?? t.areaRoot : t.areaRoot;

  const choose = (place: PlaceOption): void => {
    if (place.level === 'barangay') {
      const result = engine.family.location.setArea(place.psgc);
      if (result.ok) {
        setError(null);
        onPicked?.();
      } else {
        setError(errorMessage(lang, 'location', result.error.code));
      }
      return;
    }
    setError(null);
    setPath((current) => [...current, place]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.current}>
        <Txt role="label" tone="muted">{t.areaCurrent}</Txt>
        <Txt role="body">{currentName ?? t.areaNone}</Txt>
      </View>

      {path.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.areaBack}
          onPress={() => setPath((current) => current.slice(0, -1))}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-up" size={theme.type.roles.title.fontSize} color={theme.colors.accentText} />
          <Txt role="body" style={styles.rowLabel}>{upLabel}</Txt>
        </Pressable>
      ) : null}

      <Txt role="label" tone="muted">{t.areaChoose}</Txt>
      {options.length === 0 ? (
        <Txt role="bodySmall" tone="muted">{t.areaNoPlaces}</Txt>
      ) : (
        options.map((place) => (
          <Pressable
            key={place.psgc}
            accessibilityRole="button"
            accessibilityLabel={place.name}
            accessibilityHint={place.level === 'barangay' ? undefined : t.areaDrillHint}
            onPress={() => choose(place)}
            style={({ pressed }) => [styles.row, styles.option, pressed && styles.pressed]}
          >
            <Txt role="body" style={styles.rowLabel} numberOfLines={1}>{place.name}</Txt>
            <Ionicons
              name={place.level === 'barangay' ? 'checkmark' : 'chevron-forward'}
              size={theme.type.roles.title.fontSize}
              color={theme.colors.accentText}
            />
          </Pressable>
        ))
      )}

      {error ? <InlineError message={error} /> : null}
    </View>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  wrap: { gap: t.space.sm },
  current: { gap: t.space.xs },
  row: {
    minHeight: t.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.sm,
    paddingHorizontal: t.space.md,
  },
  option: {
    borderTopWidth: t.border.hairline,
    borderTopColor: t.colors.hairline,
  },
  rowLabel: { flex: 1 },
  pressed: { opacity: 0.86 },
});
