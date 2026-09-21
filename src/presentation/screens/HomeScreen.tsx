import React, {useEffect, useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createSessionId,
  DURATION_PRESETS,
  formatDuration,
  formatMinutes,
  getSessionRemainingMillis,
} from '../../domain/session';
import {useAppStore} from '../../state/AppStore';
import {Theme} from '../../theme/theme';
import {AppIcon, Card, PrimaryButton, SectionTitle} from '../components';

const monotonicTime = (): number =>
  (globalThis as typeof globalThis & {performance?: {now(): number}})
    .performance?.now() ?? Date.now();

export function HomeScreen({
  theme,
  onOpenApps,
}: {
  theme: Theme;
  onOpenApps(): void;
}) {
  const {
    activeSession,
    busy,
    permission,
    selectedApps,
    startSession,
    stopSession,
    openPermissionSettings,
    refresh,
  } = useAppStore();
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [custom, setCustom] = useState('45');
  const [startDelayMinutes, setStartDelayMinutes] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [monotonicNow, setMonotonicNow] = useState(monotonicTime());
  const [nativeTimerSnapshot, setNativeTimerSnapshot] = useState(() => ({
    remaining: activeSession?.remainingMillis,
    startsIn: activeSession?.startsInMillis,
    capturedAt: monotonicTime(),
  }));

  useEffect(() => {
    setNativeTimerSnapshot({
      remaining: activeSession?.remainingMillis,
      startsIn: activeSession?.startsInMillis,
      capturedAt: monotonicTime(),
    });
  }, [activeSession]);

  useEffect(() => {
    const timer = setInterval(() => {
      const next = Date.now();
      setNow(next);
      const nextMonotonic = monotonicTime();
      setMonotonicNow(nextMonotonic);
      const elapsed = nextMonotonic - nativeTimerSnapshot.capturedAt;
      const nativeRemaining = nativeTimerSnapshot.remaining;
      if (
        activeSession &&
        ((nativeRemaining !== undefined && nativeRemaining - elapsed <= 0) ||
          (nativeRemaining === undefined && next >= activeSession.endTimestamp))
      ) {
        refresh();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activeSession, nativeTimerSnapshot, refresh]);

  const elapsedSinceSnapshot = monotonicNow - nativeTimerSnapshot.capturedAt;
  const remaining = nativeTimerSnapshot.remaining === undefined
    ? getSessionRemainingMillis(activeSession, now)
    : Math.max(0, nativeTimerSnapshot.remaining - elapsedSinceSnapshot);
  const startsIn = nativeTimerSnapshot.startsIn === undefined
    ? Math.max(0, (activeSession?.startTimestamp ?? 0) - now)
    : Math.max(0, nativeTimerSnapshot.startsIn - elapsedSinceSnapshot);
  const isScheduled = Boolean(activeSession && startsIn > 0);
  const selectedPreview = useMemo(() => selectedApps.slice(0, 4), [selectedApps]);

  const start = () => {
    const startTimestamp = Date.now() + startDelayMinutes * 60_000;
    const safeMinutes = Math.min(1440, Math.max(1, durationMinutes));
    startSession({
      id: createSessionId(),
      startTimestamp,
      endTimestamp: startTimestamp + safeMinutes * 60_000,
      blockedApps: selectedApps,
    });
  };

  if (activeSession) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, {color: theme.primary}]}>{isScheduled ? 'SCHEDULED' : 'FOCUS MODE'}</Text>
        <Text style={[styles.title, {color: theme.text}]}>{isScheduled ? 'Your focus is queued.' : 'You’re in focus.'}</Text>
        <Card theme={theme} style={styles.timerCard}>
          <Text style={[styles.timerLabel, {color: theme.textMuted}]}>{isScheduled ? 'Starts in' : 'Remaining'}</Text>
          <Text style={[styles.timer, {color: theme.text}]}>
            {formatDuration(isScheduled ? startsIn : remaining)}
          </Text>
          <View style={[styles.rule, {backgroundColor: theme.border}]} />
          <Text style={[styles.activeApps, {color: theme.textMuted}]}>
            {activeSession.blockedApps.length} app{activeSession.blockedApps.length === 1 ? '' : 's'} blocked
          </Text>
          <View style={styles.iconRow}>
            {activeSession.blockedApps.slice(0, 6).map(app => (
              <AppIcon key={app.packageName} app={app} size={38} />
            ))}
          </View>
        </Card>
        <Text style={[styles.reassurance, {color: theme.textMuted}]}>
          Enforcement is running natively and continues if you close FocusGuard.
        </Text>
        <PrimaryButton label="End focus session" onPress={stopSession} loading={busy} destructive />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.eyebrow, {color: theme.primary}]}>FOCUS MODE</Text>
      <Text style={[styles.title, {color: theme.text}]}>Make space to focus.</Text>

      {!permission.ready && (
        <Pressable onPress={openPermissionSettings} style={[styles.warning, {backgroundColor: theme.primarySoft}]}>
          <Text style={[styles.warningTitle, {color: theme.text}]}>Accessibility access is off</Text>
          <Text style={[styles.warningBody, {color: theme.textMuted}]}>Enable it before starting so blocked apps can be detected. Tap to open settings.</Text>
        </Pressable>
      )}

      <View style={styles.sectionHeader}>
        <SectionTitle theme={theme}>Blocked apps</SectionTitle>
        <Pressable onPress={onOpenApps}><Text style={[styles.link, {color: theme.primary}]}>Edit</Text></Pressable>
      </View>
      <Card theme={theme}>
        {selectedApps.length ? (
          <>
            <View style={styles.iconRow}>
              {selectedPreview.map(app => <AppIcon key={app.packageName} app={app} />)}
              {selectedApps.length > selectedPreview.length && (
                <View style={[styles.moreIcon, {backgroundColor: theme.surfaceMuted}]}>
                  <Text style={[styles.moreText, {color: theme.text}]}>+{selectedApps.length - selectedPreview.length}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.selectionText, {color: theme.textMuted}]}>{selectedApps.map(app => app.appName).join(', ')}</Text>
          </>
        ) : (
          <Pressable onPress={onOpenApps} style={styles.emptyApps}>
            <Text style={[styles.emptyTitle, {color: theme.text}]}>Choose apps to block</Text>
            <Text style={[styles.emptyBody, {color: theme.textMuted}]}>Select social, video, or other distracting apps.</Text>
          </Pressable>
        )}
      </Card>

      <SectionTitle theme={theme}>Duration</SectionTitle>
      <View style={styles.chips}>
        {DURATION_PRESETS.map(minutes => (
          <Pressable
            key={minutes}
            onPress={() => setDurationMinutes(minutes)}
            style={[
              styles.chip,
              {borderColor: durationMinutes === minutes ? theme.primary : theme.border, backgroundColor: durationMinutes === minutes ? theme.primarySoft : theme.surface},
            ]}>
            <Text style={[styles.chipText, {color: durationMinutes === minutes ? theme.primary : theme.text}]}>{formatMinutes(minutes)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.customRow, {backgroundColor: theme.surface, borderColor: theme.border}]}>
        <Text style={[styles.customLabel, {color: theme.textMuted}]}>Custom minutes</Text>
        <TextInput
          value={custom}
          onChangeText={value => {
            const digits = value.replace(/[^0-9]/g, '');
            setCustom(digits);
            if (digits) {
              setDurationMinutes(Math.min(1440, Math.max(1, Number(digits))));
            }
          }}
          onFocus={() => custom && setDurationMinutes(Number(custom))}
          keyboardType="number-pad"
          maxLength={4}
          style={[styles.customInput, {color: theme.text, borderColor: durationMinutes === Number(custom) ? theme.primary : theme.border}]}
        />
      </View>

      <SectionTitle theme={theme}>Start time</SectionTitle>
      <View style={styles.chips}>
        {[0, 15, 60].map(delay => (
          <Pressable
            key={delay}
            onPress={() => setStartDelayMinutes(delay)}
            style={[
              styles.chip,
              {borderColor: startDelayMinutes === delay ? theme.primary : theme.border, backgroundColor: startDelayMinutes === delay ? theme.primarySoft : theme.surface},
            ]}>
            <Text style={[styles.chipText, {color: startDelayMinutes === delay ? theme.primary : theme.text}]}>{delay === 0 ? 'Now' : `In ${formatMinutes(delay)}`}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.endHint, {color: theme.textMuted}]}>
        Ends {new Date(Date.now() + (startDelayMinutes + durationMinutes) * 60_000).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}
      </Text>

      <PrimaryButton
        label={`Start ${formatMinutes(durationMinutes)} focus`}
        onPress={start}
        disabled={!selectedApps.length || !permission.ready}
        loading={busy}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {padding: 22, paddingBottom: 36},
  eyebrow: {fontSize: 12, fontWeight: '800', letterSpacing: 2, marginTop: 6, marginBottom: 8},
  title: {fontSize: 34, lineHeight: 41, fontWeight: '800', letterSpacing: -1, marginBottom: 24},
  warning: {padding: 16, borderRadius: 18, marginBottom: 24},
  warningTitle: {fontSize: 15, fontWeight: '700', marginBottom: 4},
  warningBody: {fontSize: 13, lineHeight: 19},
  sectionHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  link: {fontSize: 15, fontWeight: '700', marginBottom: 12},
  iconRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 9, alignItems: 'center'},
  moreIcon: {width: 44, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center'},
  moreText: {fontWeight: '700'},
  selectionText: {fontSize: 13, lineHeight: 19, marginTop: 13},
  emptyApps: {paddingVertical: 6},
  emptyTitle: {fontSize: 16, fontWeight: '700', marginBottom: 5},
  emptyBody: {fontSize: 14, lineHeight: 20},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 16},
  chip: {borderWidth: 1.5, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 14},
  chipText: {fontSize: 14, fontWeight: '700'},
  customRow: {borderWidth: 1, borderRadius: 18, padding: 12, paddingLeft: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24},
  customLabel: {fontSize: 14, fontWeight: '600'},
  customInput: {minWidth: 78, borderWidth: 1.5, borderRadius: 12, textAlign: 'center', fontSize: 16, fontWeight: '700', paddingVertical: 8},
  endHint: {fontSize: 13, marginBottom: 22, marginTop: -6},
  timerCard: {alignItems: 'center', paddingVertical: 32, marginBottom: 18},
  timerLabel: {fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5},
  timer: {fontSize: 51, fontWeight: '300', letterSpacing: 1, marginVertical: 10, fontVariant: ['tabular-nums']},
  rule: {height: 1, alignSelf: 'stretch', marginVertical: 18},
  activeApps: {fontSize: 14, marginBottom: 14},
  reassurance: {fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 22},
});
