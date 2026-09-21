import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {TrendRange} from '../../domain/models';
import {formatFocusHm, formatMinutes, formatSpanHm} from '../../domain/session';
import {useAppStore} from '../../state/AppStore';
import {radii, spacing, Theme} from '../../theme/theme';
import {FocusChart} from '../FocusChart';
import {Card, EmptyState, PrimaryButton, ScreenHeader, SectionTitle, StatusBadge} from '../components';

const RANGES: Array<{id: TrendRange; label: string; caption: string}> = [
  {id: 'week', label: 'Week', caption: 'Last 7 days'},
  {id: 'month', label: 'Month', caption: 'Last 30 days'},
  {id: 'year', label: 'Year', caption: 'Last 12 months'},
];

export function HistoryScreen({theme}: {theme: Theme}) {
  const {
    history,
    permission,
    screenTime,
    stats,
    trends,
    trendRange,
    trendsLoading,
    openUsageAccessSettings,
    setTrendRange,
    t,
  } = useAppStore();
  const topAttempts = trends.topApps;
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null);
  const range = RANGES.find(item => item.id === trendRange) ?? RANGES[0];

  useEffect(() => setSelectedBucket(null), [trendRange]);

  const peakIndex = trends.buckets.reduce(
    (best, bucket, index) =>
      bucket.focusMillis > (trends.buckets[best]?.focusMillis ?? -1) ? index : best,
    -1,
  );
  const shown = selectedBucket ?? (peakIndex >= 0 ? peakIndex : null);
  const shownBucket = shown === null ? null : trends.buckets[shown];
  const hasFocus = trends.totalFocusMillis > 0;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      <ScreenHeader
        theme={theme}
        eyebrow={t('YOUR PROGRESS')}
        title={t('Momentum, made visible.')}
        subtitle={t('A quiet record of the time you protected and the impulses you outlasted.')}
      />

      <View style={[styles.rangeRow, {backgroundColor: theme.surfaceMuted, borderColor: theme.border}]}>
        {RANGES.map(item => {
          const active = item.id === trendRange;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{selected: active}}
              onPress={() => setTrendRange(item.id)}
              style={[
                styles.rangeTab,
                active && {backgroundColor: theme.surface, borderColor: theme.border},
              ]}>
              <Text
                style={[
                  styles.rangeLabel,
                  {color: active ? theme.text : theme.textMuted},
                  active && styles.rangeLabelActive,
                ]}>
                {t(item.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card theme={theme} elevated style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={[styles.heroLabel, {color: theme.textMuted}]}>{range.caption.toUpperCase()}</Text>
            <Text style={[styles.heroValue, {color: theme.text}]}>{formatFocusHm(trends.totalFocusMillis)}</Text>
          </View>
          <View style={[styles.heroIcon, {backgroundColor: theme.primarySoft}]}>
            <View style={[styles.heroRing, {borderColor: theme.primary}]}>
              <View style={[styles.heroDot, {backgroundColor: theme.primary}]} />
            </View>
          </View>
        </View>
        <View style={[styles.heroDivider, {backgroundColor: theme.border}]} />
        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={[styles.metricValue, {color: theme.text}]}>{trends.completedSessions}</Text>
            <Text style={[styles.metricLabel, {color: theme.textMuted}]}>{t('Completed')}</Text>
          </View>
          <View style={[styles.metricDivider, {backgroundColor: theme.border}]} />
          <View style={styles.metric}>
            <Text style={[styles.metricValue, {color: theme.text}]}>{trends.blockedAttempts}</Text>
            <Text style={[styles.metricLabel, {color: theme.textMuted}]}>{t('Distractions stopped')}</Text>
          </View>
        </View>
        <Text style={[styles.heroFootnote, {color: theme.textMuted}]}>
          {formatFocusHm(stats.totalFocusMillis)} protected all time
        </Text>
      </Card>

      <View style={styles.sectionBlock}>
        <SectionTitle theme={theme}>{t('Focus time')}</SectionTitle>
        <Card theme={theme} style={[styles.chartCard, trendsLoading && styles.chartLoading]}>
          <View style={styles.readout}>
            <Text style={[styles.readoutValue, {color: theme.text}]}>
              {shownBucket ? formatFocusHm(shownBucket.focusMillis) : '0m'}
            </Text>
            <Text style={[styles.readoutLabel, {color: theme.textMuted}]}>
              {!hasFocus
                ? 'No focus time in this window yet'
                : shownBucket
                  ? `${selectedBucket === null ? 'Best so far · ' : ''}${new Date(
                      shownBucket.startTimestamp,
                    ).toLocaleDateString(undefined, {
                      month: 'short',
                      ...(trendRange === 'year' ? {year: 'numeric'} : {day: 'numeric'}),
                    })}`
                  : ''}
            </Text>
          </View>
          <FocusChart
            theme={theme}
            buckets={trends.buckets}
            range={trendRange}
            selectedIndex={selectedBucket}
            onSelect={setSelectedBucket}
          />
        </Card>
      </View>

      {topAttempts.length ? (
        <View style={styles.sectionBlock}>
          <SectionTitle theme={theme} detail={t(range.caption)}>{t('Top distractions')}</SectionTitle>
          <Card theme={theme} style={styles.attemptsCard}>
            {topAttempts.map((attempt, index) => {
              const max = topAttempts[0]?.attempts || 1;
              return (
                <View key={attempt.packageName} style={styles.attemptRow}>
                  <View style={[styles.rank, {backgroundColor: theme.surfaceMuted}]}>
                    <Text style={[styles.rankText, {color: theme.textMuted}]}>{index + 1}</Text>
                  </View>
                  <View style={styles.attemptCopy}>
                    <View style={styles.attemptLabelRow}>
                      <Text style={[styles.attemptName, {color: theme.text}]} numberOfLines={1}>{attempt.appName}</Text>
                      <Text style={[styles.attemptCount, {color: theme.textMuted}]}>{attempt.attempts}</Text>
                    </View>
                    <View style={[styles.attemptTrack, {backgroundColor: theme.surfaceMuted}]}>
                      <View
                        style={[
                          styles.attemptFill,
                          {backgroundColor: theme.primary, width: `${Math.max(12, attempt.attempts / max * 100)}%`},
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      ) : null}

      <View style={styles.sectionBlock}>
        <SectionTitle theme={theme} detail={permission.usageAccessEnabled ? t(range.caption) : t('Optional')}>
          Screen time
        </SectionTitle>
        {!permission.usageAccessEnabled ? (
          <Card theme={theme} style={styles.usageCard}>
            <Text style={[styles.usageTitle, {color: theme.text}]}>{t('See where the time actually goes')}</Text>
            <Text style={[styles.usageBody, {color: theme.textMuted}]}>
              Android can tell Qoriqchi how long each app was on screen. Turning this
              on adds the breakdown below; leaving it off changes nothing about blocking.
              The numbers stay on this phone either way.
            </Text>
            <PrimaryButton
              label={t('Turn on screen time')}
              onPress={openUsageAccessSettings}
              theme={theme}
              variant="secondary"
            />
          </Card>
        ) : screenTime.apps.length ? (
          <Card theme={theme} style={styles.attemptsCard}>
            {screenTime.apps.map((app, index) => {
              const max = screenTime.apps[0]?.usageMillis || 1;
              return (
                <View key={app.packageName} style={styles.attemptRow}>
                  <View style={[styles.rank, {backgroundColor: theme.surfaceMuted}]}>
                    <Text style={[styles.rankText, {color: theme.textMuted}]}>{index + 1}</Text>
                  </View>
                  <View style={styles.attemptCopy}>
                    <View style={styles.attemptLabelRow}>
                      <Text style={[styles.attemptName, {color: theme.text}]} numberOfLines={1}>{app.appName}</Text>
                      <Text style={[styles.attemptCount, {color: theme.textMuted}]}>{formatSpanHm(app.usageMillis)}</Text>
                    </View>
                    <View style={[styles.attemptTrack, {backgroundColor: theme.surfaceMuted}]}>
                      <View
                        style={[
                          styles.attemptFill,
                          {backgroundColor: theme.chartSeries, width: `${Math.max(12, app.usageMillis / max * 100)}%`},
                        ]}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
            <Text style={[styles.usageFootnote, {color: theme.textMuted}]}>
              Android keeps less detail the further back a window reaches, so long
              ranges show the best it can still account for.
            </Text>
          </Card>
        ) : (
          <Card theme={theme}>
            <EmptyState
              theme={theme}
              symbol="◴"
              title={t('Nothing recorded yet')}
              body={t('Android has no screen-time data for this window.')}
            />
          </Card>
        )}
      </View>

      <View style={styles.sectionBlock}>
        <SectionTitle theme={theme} detail={t('{n} total', {n: history.length})}>{t('Recent sessions')}</SectionTitle>
        {history.length ? history.map(session => {
          const durationMinutes = Math.max(1, Math.round((session.endTimestamp - session.startTimestamp) / 60_000));
          const completed = session.status === 'COMPLETED';
          return (
            <Card key={session.id} theme={theme} style={styles.sessionCard}>
              <View style={[styles.sessionRail, {backgroundColor: completed ? theme.success : theme.textSubtle}]} />
              <View style={styles.sessionContent}>
                <View style={styles.sessionTop}>
                  <View>
                    <Text style={[styles.sessionDate, {color: theme.text}]}>
                      {new Date(session.startTimestamp).toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'})}
                    </Text>
                    <Text style={[styles.sessionTime, {color: theme.textSubtle}]}>
                      {new Date(session.startTimestamp).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}
                    </Text>
                  </View>
                  <StatusBadge
                    label={completed ? t('Completed') : t('Ended early')}
                    theme={theme}
                    tone={completed ? 'success' : 'neutral'}
                  />
                </View>
                <Text style={[styles.sessionDuration, {color: theme.text}]}>{formatMinutes(durationMinutes, t)}</Text>
                <View style={styles.sessionMetaRow}>
                  <Text style={[styles.sessionMeta, {color: theme.textMuted}]}>{t('{n} apps quieted', {n: session.blockedApps.length})}</Text>
                  <View style={[styles.metaDot, {backgroundColor: theme.textSubtle}]} />
                  <Text style={[styles.sessionMeta, {color: theme.textMuted}]}>{t('{n} attempts stopped', {n: session.blockedAttempts})}</Text>
                </View>
              </View>
            </Card>
          );
        }) : (
          <Card theme={theme}>
            <EmptyState
              theme={theme}
              symbol="◷"
              title={t('Your first session starts here')}
              body={t('Completed and ended focus sessions will appear as your private progress timeline.')}
            />
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rangeRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 4,
    marginBottom: spacing.lg,
    gap: 4,
  },
  rangeTab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rangeLabel: {fontSize: 14, fontWeight: '600'},
  rangeLabelActive: {fontWeight: '800'},
  heroFootnote: {fontSize: 12, marginTop: spacing.md},
  chartCard: {paddingTop: spacing.md},
  chartLoading: {opacity: 0.6},
  readout: {marginBottom: spacing.md},
  readoutValue: {fontSize: 26, fontWeight: '800', letterSpacing: -0.5},
  readoutLabel: {fontSize: 12, fontWeight: '600', marginTop: 2},
  usageCard: {gap: spacing.sm},
  usageTitle: {fontSize: 16, fontWeight: '700'},
  usageBody: {fontSize: 13, lineHeight: 20},
  usageFootnote: {fontSize: 11, lineHeight: 16, marginTop: spacing.xs},
  content: {paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl},
  heroCard: {marginBottom: spacing.xxl, padding: spacing.xl},
  heroTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  heroLabel: {fontSize: 10, fontWeight: '800', letterSpacing: 1.5},
  heroValue: {fontSize: 38, fontWeight: '800', letterSpacing: -1.4, marginTop: 6},
  heroIcon: {width: 62, height: 62, borderRadius: 21, alignItems: 'center', justifyContent: 'center'},
  heroRing: {width: 34, height: 34, borderRadius: 17, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center'},
  heroDot: {width: 10, height: 10, borderRadius: 5},
  heroDivider: {height: 1, marginVertical: spacing.lg},
  metricRow: {flexDirection: 'row', alignItems: 'center'},
  metric: {flex: 1},
  metricDivider: {width: 1, height: 38, marginHorizontal: spacing.lg},
  metricValue: {fontSize: 21, fontWeight: '800'},
  metricLabel: {fontSize: 11, marginTop: 3},
  sectionBlock: {marginBottom: spacing.xl},
  attemptsCard: {paddingVertical: spacing.sm},
  attemptRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm},
  rank: {width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm},
  rankText: {fontSize: 11, fontWeight: '800'},
  attemptCopy: {flex: 1},
  attemptLabelRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7},
  attemptName: {fontSize: 13, fontWeight: '700', flex: 1},
  attemptCount: {fontSize: 11, fontWeight: '700', marginLeft: spacing.sm},
  attemptTrack: {height: 5, borderRadius: 3, overflow: 'hidden'},
  attemptFill: {height: 5, borderRadius: 3},
  sessionCard: {marginBottom: spacing.sm, padding: 0, flexDirection: 'row', overflow: 'hidden'},
  sessionRail: {width: 4},
  sessionContent: {flex: 1, padding: spacing.lg},
  sessionTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  sessionDate: {fontSize: 14, fontWeight: '700'},
  sessionTime: {fontSize: 11, marginTop: 3},
  sessionDuration: {fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginTop: spacing.lg},
  sessionMetaRow: {flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap'},
  sessionMeta: {fontSize: 11},
  metaDot: {width: 3, height: 3, borderRadius: 2, marginHorizontal: 7},
});
