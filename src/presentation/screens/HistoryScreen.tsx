import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {formatDuration} from '../../domain/session';
import {useAppStore} from '../../state/AppStore';
import {Theme} from '../../theme/theme';
import {Card} from '../components';

export function HistoryScreen({theme}: {theme: Theme}) {
  const {history, stats} = useAppStore();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, {color: theme.text}]}>Your progress</Text>
      <View style={styles.statsRow}>
        <Card theme={theme} style={styles.statCard}>
          <Text style={[styles.statValue, {color: theme.text}]}>{stats.completedSessions}</Text>
          <Text style={[styles.statLabel, {color: theme.textMuted}]}>Completed</Text>
        </Card>
        <Card theme={theme} style={styles.statCard}>
          <Text style={[styles.statValue, {color: theme.text}]}>{Math.round(stats.totalFocusMillis / 3_600_000 * 10) / 10}h</Text>
          <Text style={[styles.statLabel, {color: theme.textMuted}]}>Focused</Text>
        </Card>
        <Card theme={theme} style={styles.statCard}>
          <Text style={[styles.statValue, {color: theme.text}]}>{stats.totalBlockedAttempts}</Text>
          <Text style={[styles.statLabel, {color: theme.textMuted}]}>Blocks</Text>
        </Card>
      </View>

      <Text style={[styles.sectionTitle, {color: theme.text}]}>Sessions</Text>
      {history.length ? history.map(session => (
        <Card key={session.id} theme={theme} style={styles.sessionCard}>
          <View style={styles.sessionTop}>
            <View>
              <Text style={[styles.sessionDate, {color: theme.text}]}>{new Date(session.startTimestamp).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</Text>
              <Text style={[styles.sessionTime, {color: theme.textMuted}]}>{new Date(session.startTimestamp).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}</Text>
            </View>
            <View style={[styles.status, {backgroundColor: session.status === 'COMPLETED' ? `${theme.success}20` : theme.surfaceMuted}]}>
              <Text style={[styles.statusText, {color: session.status === 'COMPLETED' ? theme.success : theme.textMuted}]}>{session.status.toLowerCase()}</Text>
            </View>
          </View>
          <Text style={[styles.sessionDuration, {color: theme.text}]}>{formatDuration(session.endTimestamp - session.startTimestamp)}</Text>
          <Text style={[styles.sessionMeta, {color: theme.textMuted}]}>{session.blockedApps.length} apps · {session.blockedAttempts} blocked attempts</Text>
        </Card>
      )) : (
        <Card theme={theme}><Text style={[styles.emptyTitle, {color: theme.text}]}>No sessions yet</Text><Text style={[styles.emptyBody, {color: theme.textMuted}]}>Finished and stopped focus sessions will appear here.</Text></Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {padding: 22, paddingBottom: 36},
  title: {fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginBottom: 20},
  statsRow: {flexDirection: 'row', gap: 8, marginBottom: 28},
  statCard: {flex: 1, padding: 13},
  statValue: {fontSize: 23, fontWeight: '800', marginBottom: 3},
  statLabel: {fontSize: 11, fontWeight: '600'},
  sectionTitle: {fontSize: 19, fontWeight: '700', marginBottom: 12},
  sessionCard: {marginBottom: 11},
  sessionTop: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'},
  sessionDate: {fontSize: 15, fontWeight: '700'},
  sessionTime: {fontSize: 12, marginTop: 2},
  status: {paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999},
  statusText: {fontSize: 11, fontWeight: '700', textTransform: 'capitalize'},
  sessionDuration: {fontSize: 25, fontWeight: '600', marginTop: 18, fontVariant: ['tabular-nums']},
  sessionMeta: {fontSize: 12, marginTop: 5},
  emptyTitle: {fontSize: 16, fontWeight: '700', marginBottom: 5},
  emptyBody: {fontSize: 14, lineHeight: 20},
});
