import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {formatMinutes} from '../../domain/session';
import {useAppStore} from '../../state/AppStore';
import {spacing, Theme} from '../../theme/theme';
import {Card, EmptyState, ScreenHeader, SectionTitle, StatusBadge} from '../components';

function formatTotalFocus(milliseconds: number): string {
  const minutes = Math.round(milliseconds / 60_000);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function HistoryScreen({theme}: {theme: Theme}) {
  const {history, stats} = useAppStore();
  const topAttempts = stats.attemptsByPackage.slice(0, 3);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      <ScreenHeader
        theme={theme}
        eyebrow="YOUR PROGRESS"
        title="Momentum, made visible."
        subtitle="A quiet record of the time you protected and the impulses you outlasted."
      />

      <Card theme={theme} elevated style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={[styles.heroLabel, {color: theme.textMuted}]}>TOTAL FOCUS TIME</Text>
            <Text style={[styles.heroValue, {color: theme.text}]}>{formatTotalFocus(stats.totalFocusMillis)}</Text>
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
            <Text style={[styles.metricValue, {color: theme.text}]}>{stats.completedSessions}</Text>
            <Text style={[styles.metricLabel, {color: theme.textMuted}]}>Completed</Text>
          </View>
          <View style={[styles.metricDivider, {backgroundColor: theme.border}]} />
          <View style={styles.metric}>
            <Text style={[styles.metricValue, {color: theme.text}]}>{stats.totalBlockedAttempts}</Text>
            <Text style={[styles.metricLabel, {color: theme.textMuted}]}>Distractions stopped</Text>
          </View>
        </View>
      </Card>

      {topAttempts.length ? (
        <View style={styles.sectionBlock}>
          <SectionTitle theme={theme} detail="Most resisted">Top distractions</SectionTitle>
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
        <SectionTitle theme={theme} detail={`${history.length} total`}>Recent sessions</SectionTitle>
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
                    label={completed ? 'Completed' : 'Ended early'}
                    theme={theme}
                    tone={completed ? 'success' : 'neutral'}
                  />
                </View>
                <Text style={[styles.sessionDuration, {color: theme.text}]}>{formatMinutes(durationMinutes)}</Text>
                <View style={styles.sessionMetaRow}>
                  <Text style={[styles.sessionMeta, {color: theme.textMuted}]}>{session.blockedApps.length} apps quieted</Text>
                  <View style={[styles.metaDot, {backgroundColor: theme.textSubtle}]} />
                  <Text style={[styles.sessionMeta, {color: theme.textMuted}]}>{session.blockedAttempts} attempts stopped</Text>
                </View>
              </View>
            </Card>
          );
        }) : (
          <Card theme={theme}>
            <EmptyState
              theme={theme}
              symbol="◷"
              title="Your first session starts here"
              body="Completed and ended focus sessions will appear as your private progress timeline."
            />
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
