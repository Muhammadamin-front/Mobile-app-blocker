import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
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
import {radii, spacing, Theme} from '../../theme/theme';
import {
  AppIcon,
  Card,
  PrimaryButton,
  ScreenHeader,
  SectionTitle,
  StatusBadge,
} from '../components';

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
  // Native owns the status. Deriving it from the countdown made a just-started
  // session flash as scheduled for the first frame after the app opened.
  const isScheduled = activeSession?.status === 'SCHEDULED';
  const selectedPreview = useMemo(() => selectedApps.slice(0, 5), [selectedApps]);
  const endTime = new Date(
    Date.now() + (startDelayMinutes + durationMinutes) * 60_000,
  ).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});

  // Ending early throws the session away, so it asks twice before it does.
  const confirmEnd = () => {
    Alert.alert(
      'End focus session?',
      `${formatDuration(remaining)} still to go. Your blocked apps unlock the moment this ends.`,
      [
        {text: 'Keep focusing', style: 'cancel'},
        {text: 'End session', style: 'destructive', onPress: confirmEndAgain},
      ],
      {cancelable: true},
    );
  };

  const confirmEndAgain = () => {
    Alert.alert(
      'Are you sure?',
      'This session will be saved as stopped, not completed. This cannot be undone.',
      [
        {text: 'Stay focused', style: 'cancel'},
        {text: 'Yes, end it', style: 'destructive', onPress: () => stopSession()},
      ],
      {cancelable: true},
    );
  };

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={styles.activeHeader}>
          <StatusBadge
            label={
              !permission.ready
                ? 'Not enforcing'
                : isScheduled
                  ? 'Scheduled'
                  : 'Focus active'
            }
            theme={theme}
            tone={!permission.ready ? 'danger' : isScheduled ? 'warning' : 'success'}
          />
          <Text style={[styles.activeTitle, {color: theme.text}]}>
            {isScheduled ? 'Your session is ready.' : 'Stay with the moment.'}
          </Text>
          <Text style={[styles.activeSubtitle, {color: theme.textMuted}]}>
            {!permission.ready
              ? 'FocusGuard cannot enforce this session right now.'
              : isScheduled
                ? 'FocusGuard will begin automatically at the scheduled time.'
                : 'Everything is working. You can safely close this app.'}
          </Text>
        </View>

        <Card theme={theme} elevated style={styles.timerCard}>
          <View style={[styles.timerHalo, {backgroundColor: theme.primarySoft}]}>
            <View style={[styles.timerRing, {borderColor: theme.primary}]}>
              <Text style={[styles.timerLabel, {color: theme.textMuted}]}>
                {isScheduled ? 'STARTS IN' : 'REMAINING'}
              </Text>
              <Text style={[styles.timer, {color: theme.text}]}>
                {formatDuration(isScheduled ? startsIn : remaining)}
              </Text>
            </View>
          </View>
          <View style={[styles.timerDivider, {backgroundColor: theme.border}]} />
          <View style={styles.timerFooter}>
            <View>
              <Text style={[styles.timerFooterLabel, {color: theme.textSubtle}]}>ENDS AT</Text>
              <Text style={[styles.timerFooterValue, {color: theme.text}]}>
                {new Date(activeSession.endTimestamp).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}
              </Text>
            </View>
            <View style={styles.appStack}>
              {activeSession.blockedApps.slice(0, 4).map((app, index) => (
                <View key={app.packageName} style={index ? styles.stackedIcon : undefined}>
                  <AppIcon app={app} size={36} />
                </View>
              ))}
              {activeSession.blockedApps.length > 4 ? (
                <View style={[styles.stackCount, styles.stackedIcon, {backgroundColor: theme.surfaceMuted, borderColor: theme.surface}]}>
                  <Text style={[styles.stackCountText, {color: theme.text}]}>+{activeSession.blockedApps.length - 4}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Card>

        <Card theme={theme} tone="muted" style={styles.protectionCard}>
          <View
            style={[
              styles.protectionIcon,
              {backgroundColor: permission.ready ? theme.successSoft : theme.dangerSoft},
            ]}>
            <View
              style={[
                styles.protectionDot,
                {backgroundColor: permission.ready ? theme.success : theme.danger},
              ]}
            />
          </View>
          <View style={styles.protectionCopy}>
            <Text style={[styles.protectionTitle, {color: theme.text}]}>
              {permission.ready ? 'Native protection is on' : 'Blocking has stopped'}
            </Text>
            <Text style={[styles.protectionBody, {color: theme.textMuted}]}>
              {permission.ready
                ? 'Blocking continues even when FocusGuard is closed.'
                : 'Accessibility access is off, so blocked apps open normally. Turn it back on to resume this session.'}
            </Text>
          </View>
        </Card>

        {permission.ready ? null : (
          <View style={styles.resumeButton}>
            <PrimaryButton
              label="Turn blocking back on"
              onPress={openPermissionSettings}
              theme={theme}
            />
          </View>
        )}

        <PrimaryButton
          label="End focus session"
          onPress={confirmEnd}
          theme={theme}
          loading={busy}
          variant="danger"
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <ScreenHeader
        theme={theme}
        eyebrow="YOUR FOCUS SPACE"
        title="Protect the next hour."
        subtitle="Choose what stays quiet, then let FocusGuard hold the boundary."
      />

      {!permission.ready ? (
        <Pressable
          accessibilityRole="button"
          onPress={openPermissionSettings}
          style={({pressed}) => [
            styles.permissionCard,
            {backgroundColor: theme.warningSoft, borderColor: `${theme.warning}32`},
            pressed && styles.pressed,
          ]}>
          <View style={[styles.permissionIcon, {backgroundColor: `${theme.warning}1C`}]}>
            <Text style={[styles.permissionGlyph, {color: theme.warning}]}>!</Text>
          </View>
          <View style={styles.permissionCopy}>
            <Text style={[styles.permissionTitle, {color: theme.text}]}>Finish setup</Text>
            <Text style={[styles.permissionBody, {color: theme.textMuted}]}>Accessibility access is required before focus can start.</Text>
          </View>
          <Text style={[styles.permissionArrow, {color: theme.warning}]}>›</Text>
        </Pressable>
      ) : null}

      <View style={styles.sectionHeaderRow}>
        <SectionTitle theme={theme}>Distractions</SectionTitle>
        <Pressable hitSlop={10} onPress={onOpenApps} style={styles.editLinkTap}>
          <Text style={[styles.editLink, {color: theme.primary}]}>Edit list</Text>
        </Pressable>
      </View>
      <Card theme={theme} elevated style={styles.appsCard}>
        {selectedApps.length ? (
          <>
            <View style={styles.appsCardTop}>
              <View style={styles.appStack}>
                {selectedPreview.map((app, index) => (
                  <View key={app.packageName} style={index ? styles.stackedIcon : undefined}>
                    <AppIcon app={app} size={46} />
                  </View>
                ))}
              </View>
              <View style={[styles.countBadge, {backgroundColor: theme.primarySoft}]}>
                <Text style={[styles.countBadgeText, {color: theme.primary}]}>{selectedApps.length}</Text>
              </View>
            </View>
            <Text style={[styles.appsCardTitle, {color: theme.text}]}>Your block list is ready</Text>
            <Text style={[styles.selectionText, {color: theme.textMuted}]} numberOfLines={2}>
              {selectedApps.map(app => app.appName).join(' · ')}
            </Text>
          </>
        ) : (
          <Pressable onPress={onOpenApps} style={styles.emptyApps}>
            <View style={[styles.addIcon, {backgroundColor: theme.primarySoft}]}>
              <Text style={[styles.addIconText, {color: theme.primary}]}>+</Text>
            </View>
            <View style={styles.emptyAppsCopy}>
              <Text style={[styles.emptyTitle, {color: theme.text}]}>Choose apps to quiet</Text>
              <Text style={[styles.emptyBody, {color: theme.textMuted}]}>Social, video, games, or anything that pulls you away.</Text>
            </View>
            <Text style={[styles.chevron, {color: theme.textSubtle}]}>›</Text>
          </Pressable>
        )}
      </Card>

      <SectionTitle theme={theme}>Duration</SectionTitle>
      <View style={styles.durationGrid}>
        {DURATION_PRESETS.map(minutes => {
          const active = durationMinutes === minutes;
          return (
            <Pressable
              key={minutes}
              onPress={() => setDurationMinutes(minutes)}
              style={({pressed}) => [
                styles.durationChip,
                {
                  borderColor: active ? theme.primary : theme.border,
                  backgroundColor: active ? theme.primarySoft : theme.surface,
                },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.durationValue, {color: active ? theme.primary : theme.text}]}>
                {minutes < 60 ? minutes : minutes / 60}
              </Text>
              <Text style={[styles.durationUnit, {color: active ? theme.primary : theme.textMuted}]}>
                {minutes < 60 ? 'min' : minutes === 60 ? 'hour' : 'hours'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.customRow, {backgroundColor: theme.surface, borderColor: theme.border}]}>
        <View>
          <Text style={[styles.customLabel, {color: theme.text}]}>Custom duration</Text>
          <Text style={[styles.customHint, {color: theme.textSubtle}]}>1 minute to 24 hours</Text>
        </View>
        <View style={[styles.customInputWrap, {backgroundColor: theme.surfaceMuted}]}>
          <TextInput
            accessibilityLabel="Custom focus duration in minutes"
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
            selectTextOnFocus
            style={[styles.customInput, {color: theme.text}]}
          />
          <Text style={[styles.customSuffix, {color: theme.textMuted}]}>min</Text>
        </View>
      </View>

      <SectionTitle theme={theme} detail="Optional">Start time</SectionTitle>
      <View style={styles.scheduleRow}>
        {[0, 15, 60].map(delay => {
          const active = startDelayMinutes === delay;
          return (
            <Pressable
              key={delay}
              onPress={() => setStartDelayMinutes(delay)}
              style={({pressed}) => [
                styles.scheduleChip,
                {
                  borderColor: active ? theme.primary : theme.border,
                  backgroundColor: active ? theme.primarySoft : theme.surface,
                },
                pressed && styles.pressed,
              ]}>
              <View style={[styles.scheduleRadio, {borderColor: active ? theme.primary : theme.borderStrong}]}>
                {active ? <View style={[styles.scheduleRadioFill, {backgroundColor: theme.primary}]} /> : null}
              </View>
              <Text style={[styles.scheduleText, {color: active ? theme.primary : theme.text}]}>
                {delay === 0 ? 'Now' : `+${formatMinutes(delay)}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card theme={theme} tone="accent" style={styles.summaryCard}>
        <View>
          <Text style={[styles.summaryEyebrow, {color: theme.primary}]}>READY WHEN YOU ARE</Text>
          <Text style={[styles.summaryTitle, {color: theme.text}]}>{formatMinutes(durationMinutes)} of protected time</Text>
          <Text style={[styles.summaryMeta, {color: theme.textMuted}]}>Ends at {endTime}</Text>
        </View>
        <View style={[styles.summaryFocusIcon, {borderColor: theme.primary}]}>
          <View style={[styles.summaryFocusDot, {backgroundColor: theme.primary}]} />
        </View>
      </Card>

      <PrimaryButton
        label={`Start ${formatMinutes(durationMinutes)} focus`}
        trailing="→"
        onPress={start}
        theme={theme}
        disabled={!selectedApps.length || !permission.ready}
        loading={busy}
      />
      {!selectedApps.length ? (
        <Text style={[styles.startHint, {color: theme.textSubtle}]}>Choose at least one app to begin.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl},
  pressed: {opacity: 0.72, transform: [{scale: 0.99}]},
  permissionCard: {minHeight: 80, borderRadius: radii.lg, borderWidth: 1, padding: spacing.md, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl},
  permissionIcon: {width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  permissionGlyph: {fontSize: 20, fontWeight: '800'},
  permissionCopy: {flex: 1, marginHorizontal: spacing.sm},
  permissionTitle: {fontSize: 15, fontWeight: '700', marginBottom: 3},
  permissionBody: {fontSize: 12, lineHeight: 17},
  permissionArrow: {fontSize: 28, fontWeight: '300'},
  sectionHeaderRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  editLinkTap: {paddingBottom: spacing.sm, paddingLeft: spacing.sm},
  editLink: {fontSize: 13, fontWeight: '700'},
  appsCard: {marginBottom: spacing.xl},
  appsCardTop: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md},
  appStack: {flexDirection: 'row', alignItems: 'center'},
  stackedIcon: {marginLeft: -10},
  countBadge: {width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  countBadgeText: {fontSize: 14, fontWeight: '800'},
  appsCardTitle: {fontSize: 16, fontWeight: '700', marginBottom: 5},
  selectionText: {fontSize: 13, lineHeight: 19},
  emptyApps: {flexDirection: 'row', alignItems: 'center'},
  addIcon: {width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center'},
  addIconText: {fontSize: 28, fontWeight: '400', marginTop: -2},
  emptyAppsCopy: {flex: 1, marginHorizontal: spacing.md},
  emptyTitle: {fontSize: 15, fontWeight: '700', marginBottom: 3},
  emptyBody: {fontSize: 12, lineHeight: 17},
  chevron: {fontSize: 28, fontWeight: '300'},
  durationGrid: {flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm},
  durationChip: {flex: 1, minHeight: 72, borderWidth: 1.5, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center'},
  durationValue: {fontSize: 20, fontWeight: '800', letterSpacing: -0.4},
  durationUnit: {fontSize: 11, fontWeight: '600', marginTop: 2},
  customRow: {borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl},
  customLabel: {fontSize: 14, fontWeight: '700'},
  customHint: {fontSize: 11, marginTop: 3},
  customInputWrap: {height: 44, minWidth: 92, borderRadius: 13, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm},
  customInput: {minWidth: 44, fontSize: 16, fontWeight: '800', textAlign: 'right', paddingVertical: 0},
  customSuffix: {fontSize: 12, marginLeft: 4},
  scheduleRow: {flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xl},
  scheduleChip: {flex: 1, minHeight: 48, borderWidth: 1, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7},
  scheduleRadio: {width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center'},
  scheduleRadioFill: {width: 7, height: 7, borderRadius: 4},
  scheduleText: {fontSize: 12, fontWeight: '700'},
  summaryCard: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md},
  summaryEyebrow: {fontSize: 9, letterSpacing: 1.4, fontWeight: '800', marginBottom: 5},
  summaryTitle: {fontSize: 16, fontWeight: '700'},
  summaryMeta: {fontSize: 12, marginTop: 4},
  summaryFocusIcon: {width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  summaryFocusDot: {width: 12, height: 12, borderRadius: 6},
  startHint: {fontSize: 11, textAlign: 'center', marginTop: spacing.sm},
  activeHeader: {marginBottom: spacing.xl},
  activeTitle: {fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1, marginTop: spacing.md},
  activeSubtitle: {fontSize: 15, lineHeight: 22, marginTop: spacing.xs},
  timerCard: {padding: spacing.xl, marginBottom: spacing.md},
  timerHalo: {width: 244, height: 244, borderRadius: 122, alignSelf: 'center', alignItems: 'center', justifyContent: 'center'},
  timerRing: {width: 212, height: 212, borderRadius: 106, borderWidth: 7, alignItems: 'center', justifyContent: 'center'},
  timerLabel: {fontSize: 10, fontWeight: '800', letterSpacing: 1.6, marginBottom: spacing.xs},
  timer: {fontSize: 38, fontWeight: '300', letterSpacing: 0.5, fontVariant: ['tabular-nums']},
  timerDivider: {height: 1, marginVertical: spacing.lg},
  timerFooter: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  timerFooterLabel: {fontSize: 9, fontWeight: '800', letterSpacing: 1.3},
  timerFooterValue: {fontSize: 16, fontWeight: '700', marginTop: 3},
  stackCount: {width: 36, height: 36, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  stackCountText: {fontSize: 10, fontWeight: '800'},
  protectionCard: {flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md},
  resumeButton: {marginBottom: spacing.sm},
  protectionIcon: {width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  protectionDot: {width: 12, height: 12, borderRadius: 6},
  protectionCopy: {flex: 1, marginLeft: spacing.sm},
  protectionTitle: {fontSize: 14, fontWeight: '700', marginBottom: 3},
  protectionBody: {fontSize: 12, lineHeight: 17},
});
