import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { RankedCenter } from '../../engine';
import type { RootNavigation } from '../navigation/types';
import { useEngine, useEngineChange } from '../context/useEngine';
import { AppBanners } from '../context/AppChrome';
import { BulletinCard, Button, InlineError, Screen, StormTrack, Tag, Tile, Txt } from '../components';
import { useLang, useT } from '../i18n';
import { errorMessage } from '../strings/errors';
import { fill } from '../strings/format';
import { stormStrings } from '../strings/storm';
import { useTheme, useThemedStyles } from '../theme';
import type { Theme } from '../theme';
import { bulletinAge, bulletinLines, clockText, kmText, trackPoints } from './storm/stormModel';

/**
 * Evacuation and bagyo screen: the latest cached PAGASA bulletin, the bagyo around the household
 * (a map-free track view) and the recommended evacuation centers under "Ang barangay ang
 * magsasabi kung kailan lilikas." Everything is rendered from `evacuation.view()` and
 * `feed.get()`; pull to refresh calls `feed.refresh()`. No arrival time is ever shown.
 */
export function StormScreen(): JSX.Element {
  const engine = useEngine();
  const navigation = useNavigation<RootNavigation>();
  const t = useT(stormStrings);
  const { lang } = useLang();
  const theme = useTheme();
  const styles = useThemedStyles(makeStyles);
  useEngineChange(['feed', 'profiles', 'settings', 'phase']);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [sourceVisible, setSourceVisible] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const view = engine.evacuation.view();
  const feed = engine.feed.get();
  const profile = engine.profiles.active();
  const places = useMemo(
    () => new Map(engine.family.location.places().map((place) => [place.psgc, place.name])),
    [engine],
  );

  const refresh = (): void => {
    setRefreshing(true);
    void engine.feed.refresh().then((result) => {
      if (!mounted.current) return;
      setRefreshing(false);
      setRefreshError(result.ok ? null : errorMessage(lang, 'feed', result.error.code));
    });
  };

  const bulletin = view.bulletin;
  const bulletinSection = bulletin ? (
    <View style={styles.group}>
      <BulletinCard
        title={bulletin.bulletin.source.title}
        lines={bulletinLines(bulletin, t, places)}
        ageText={bulletinAge(bulletin, engine.copy, lang, t)}
        staleText={bulletin.stale ? engine.copy('stale_warning', { lang }) : undefined}
        sourceLabel={sourceVisible ? t.hideSource : engine.copy('source_link', { lang })}
        onSource={() => setSourceVisible((visible) => !visible)}
      />
      {sourceVisible ? (
        <Txt role="bodySmall" tone="muted" selectable>
          {bulletin.bulletin.source.agency} · {bulletin.bulletin.source.title} · {bulletin.bulletin.source.url}
        </Txt>
      ) : null}
      <Tile title={t.bulletinText}>
        <Txt role="body" serif selectable>{bulletin.bulletin.text}</Txt>
      </Tile>
    </View>
  ) : (
    <Tile>
      <Txt role="body">
        {feed.status === 'off' ? errorMessage(lang, 'feed', 'disabled') : engine.copy('no_live_data', { lang })}
      </Txt>
    </Tile>
  );

  const storm = view.storm;
  const track = storm ? trackPoints(storm) : null;
  const nowText = storm ? fill(t.trackNow, { km: kmText(storm.now.distanceKm), direction: t[`dir_${storm.now.direction}`] }) : '';
  const trackSection = storm && track ? (
    <Tile title={t.trackTitle}>
      {storm.signalHere !== null ? (
        <Tag
          label={fill(t.signalHere, { level: storm.signalHere })}
          icon="warning"
          tone={theme.warning.tcws[storm.signalHere]}
        />
      ) : (
        <Txt role="bodySmall" tone="muted">{t.noSignalHere}</Txt>
      )}
      <StormTrack
        now={track.now}
        forecast={track.forecast}
        scaleLabel={fill(t.trackScale, { km: kmText(track.scaleKm) })}
        northLabel={t.trackNorth}
        homeLabel={t.trackHome}
        stormLabel={t.trackStorm}
        accessibilityLabel={nowText}
      />
      <Txt role="title" tone="accent">{nowText}</Txt>
      <Txt role="bodySmall">{fill(t.trackClosest, { km: kmText(storm.closestKm) })}</Txt>
      {storm.forecast.length > 0 ? (
        <View style={styles.forecast}>
          <Txt role="label" tone="muted">{t.trackForecast}</Txt>
          {storm.forecast.map((fix, index) => (
            <View key={fix.at} style={styles.forecastRow}>
              <View style={styles.forecastIndex}>
                <Txt role="caption" color={theme.colors.surface}>{index + 1}</Txt>
              </View>
              <Txt role="bodySmall" style={styles.flex}>
                {fill(t.trackPoint, { time: clockText(fix.at, t), km: kmText(fix.distanceKm), direction: t[`dir_${fix.direction}`] })}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
      <Txt role="caption" tone="muted">{t.trackNoArrival}</Txt>
    </Tile>
  ) : null;

  const familyCenterId = profile?.plan.evacuationCenterId;
  const centerRow = ({ center, distanceKm, direction }: RankedCenter): JSX.Element => {
    const isFamily = center.id === familyCenterId;
    return (
      <View key={center.id} style={[styles.center, isFamily && styles.centerFamily]}>
        <View style={styles.centerHead}>
          <Ionicons name="business" size={theme.type.roles.title.fontSize} color={theme.colors.accentText} />
          <Txt role="title" style={styles.flex}>{center.name}</Txt>
        </View>
        <Txt role="bodySmall">
          {fill(t.centerDistance, { km: kmText(distanceKm), direction: t[`dir_${direction}`] })}
          {center.landmark ? ` · ${center.landmark}` : ''}
        </Txt>
        <View style={styles.tags}>
          {isFamily ? <Tag label={t.centerFamily} icon="home" tone={theme.colors.highlight} /> : null}
          {center.capacity !== undefined ? <Tag label={fill(t.centerCapacity, { count: center.capacity })} icon="people" /> : null}
          {center.accessible ? <Tag label={t.centerAccessible} icon="accessibility" /> : null}
          {center.accepts_pets ? <Tag label={t.centerPets} icon="paw" /> : null}
        </View>
      </View>
    );
  };

  const centersSection = (
    <Tile title={t.centersTitle}>
      <View style={[styles.barangay, { backgroundColor: theme.colors.dangerSurface.fill }]}>
        <Ionicons name="megaphone" size={theme.type.roles.body.fontSize} color={theme.colors.dangerSurface.ink} />
        <Txt role="body" color={theme.colors.dangerSurface.ink} style={styles.flex}>
          {engine.copy(view.barangayCopyKey, { lang })}
        </Txt>
      </View>
      {view.needsLocation ? (
        <>
          <Txt role="bodySmall" tone="muted">{t.needsLocation}</Txt>
          <Button label={t.setLocation} icon="location-outline" variant="tonal" onPress={() => navigation.navigate('Tabs', { screen: 'Family' })} />
        </>
      ) : view.centers.length === 0 ? (
        <Txt role="bodySmall" tone="muted">{t.centersEmpty}</Txt>
      ) : (
        <View style={styles.centers}>{view.centers.map(centerRow)}</View>
      )}
    </Tile>
  );

  return (
    <Screen
      title={t.title}
      back={{ label: t.back, onPress: navigation.goBack }}
      banner={<AppBanners />}
      refresh={{ refreshing, onRefresh: refresh }}
    >
      <View style={styles.sections}>
        <Button
          label={refreshing ? t.refreshing : t.refresh}
          icon="refresh"
          variant="outline"
          disabled={refreshing}
          onPress={refresh}
        />
        {refreshError ? <InlineError message={refreshError} /> : null}
        {view.centersFirst ? centersSection : null}
        {bulletinSection}
        {trackSection}
        {view.centersFirst ? null : centersSection}
      </View>
    </Screen>
  );
}

const makeStyles = (t: Theme) => StyleSheet.create({
  sections: {
    gap: t.space.section,
  },
  group: {
    gap: t.space.gutter,
  },
  flex: {
    flex: 1,
  },
  forecast: {
    gap: t.space.sm,
  },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.md,
  },
  forecastIndex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.accentText,
  },
  barangay: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.space.md,
    padding: t.space.md,
    borderRadius: t.radius.menu,
  },
  centers: {
    gap: t.space.md,
  },
  center: {
    gap: t.space.sm,
    padding: t.space.xl,
    borderRadius: t.radius.menu,
    borderWidth: t.border.hairline,
    borderColor: t.colors.hairline,
    backgroundColor: t.colors.surface,
  },
  centerFamily: {
    borderWidth: t.border.emphasis,
    borderColor: t.colors.stroke,
  },
  centerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.md,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.space.xs,
  },
});
