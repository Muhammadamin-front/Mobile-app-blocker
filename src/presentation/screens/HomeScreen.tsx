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
    t,
  } = useAppStore();
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [custom, setCustom] = useState('45');
  const [startDelayMinutes, setStartDelayMinutes] = useState(0);
  const [strict, setStrict] = useState(false);
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
      t('End focus session?'),
      `${formatDuration(remaining)} still to go. Your blocked apps unlock the moment this ends.`,
      [
        {text: t('Keep focusing'), style: 'cancel'},
        {text: t('End session'), style: 'destructive', onPress: confirmEndAgain},
      ],
      {cancelable: true},
    );
  };

  const confirmEndAgain = () => {
    Alert.alert(
      t('Are you sure?'),
      t('This session will be saved as stopped, not completed. This cannot be undone.'),
      [
        {text: t('Stay focused'), style: 'cancel'},
        {text: t('Yes, end it'), style: 'destructive', onPress: () => stopSession()},
      ],
      {cancelable: true},
    );
  };

  const begin = () => {
    const startTimestamp = Date.now() + startDelayMinutes * 60_000;
    const safeMinutes = Math.min(1440, Math.max(1, durationMinutes));
    startSession({
      id: createSessionId(),
      startTimestamp,
      endTimestamp: startTimestamp + safeMinutes * 60_000,
      blockedApps: selectedApps,
      strict,
    });
  };

  // Strict is the one choice here that cannot be taken back, so it is confirmed
  // before it starts rather than argued with afterwards.
  const start = () => {
    if (!strict) {
      begin();
      return;
    }
    Alert.alert(
      t('Start a strict session?'),
      t(
        'For the next {d} you will not be able to end it. Blocked apps stay blocked until the timer runs out.',
        {d: formatMinutes(durationMinutes, t)},
      ),
      [
        {text: t('Cancel'), style: 'cancel'},
        {text: t('Start strict'), style: 'destructive', onPress: begin},
      ],
      {cancelable: true},
    );
  };

  if (activeSession) {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, styles.activeContent]}>
        <View style={styles.activeHeader}>
          <View style={styles.activeMetaRow}>
            <StatusBadge
              label={
                !permission.ready
                  ? t('Not enforcing')
                  : isScheduled
                    ? t('Scheduled')
                    : t('Focus active')
              }
              theme={theme}
              tone={!permission.ready ? 'danger' : isScheduled ? 'warning' : 'success'}
              onBright
            />
            <View style={styles.sessionMonogram}>
              <View style={[styles.sessionMonogramLine, {backgroundColor: theme.background}]} />
              <Text style={[styles.sessionMonogramText, {color: `${theme.background}9E`}]}>QORIQCHI</Text>
            </View>
          </View>
          <Text style={[styles.activeTitle, {color: theme.background}]}> 
            {isScheduled ? t('Your session is ready.') : t('Stay with the moment.')}
          </Text>
          <Text style={[styles.activeSubtitle, {color: `${theme.background}C4`}]}> 
            {!permission.ready
              ? t('Qoriqchi cannot enforce this session right now.')
              : isScheduled
                ? t('Qoriqchi will begin automatically at the scheduled time.')
                : t('Everything is working. You can safely close this app.')}
          </Text>
        </View>

        <Card theme={theme} elevated style={[styles.timerCard, {borderColor: theme.borderStrong}]}> 
          <View pointerEvents="none" style={[styles.timerCornerGlow, {backgroundColor: theme.primary}]} />
          <View style={styles.timerCardHeader}>
            <Text style={[styles.timerCardEyebrow, {color: theme.textSubtle}]}>{t('FOCUS TIMER')}</Text>
            <View style={[styles.livePill, {backgroundColor: theme.primarySoft, borderColor: theme.borderStrong}]}> 
              <View style={[styles.liveDot, {backgroundColor: theme.primary}]} />
              <Text style={[styles.liveText, {color: theme.primary}]}>{isScheduled ? t('Scheduled') : t('LIVE')}</Text>
            </View>
          </View>
          <View style={[styles.timerHalo, {backgroundColor: theme.primarySoft, borderColor: `${theme.primary}24`}]}> 
            <View style={[styles.timerOuterRing, {borderColor: `${theme.primary}4A`}]}> 
              {Array.from({length: 12}).map((_, index) => (
                <View key={index} style={[styles.tickAnchor, {transform: [{rotate: `${index * 30}deg`}]}]}>
                  <View style={[styles.timerTick, {backgroundColor: index % 3 === 0 ? theme.primary : `${theme.primary}58`}]} />
                </View>
              ))}
            </View>
            <View style={[styles.timerRing, {borderColor: theme.primary, backgroundColor: theme.background}]}> 
              <Text style={[styles.timerLabel, {color: theme.textMuted}]}> 
                {isScheduled ? t('STARTS IN') : t('REMAINING')}
              </Text>
              <Text style={[styles.timer, {color: theme.text}]}> 
                {formatDuration(isScheduled ? startsIn : remaining)}
              </Text>
              <View style={styles.timerModeRow}>
                <View style={[styles.timerModeDot, {backgroundColor: permission.ready ? theme.success : theme.danger}]} />
                <Text style={[styles.timerModeText, {color: theme.textSubtle}]}>{t('DEEP FOCUS')}</Text>
              </View>
            </View>
          </View>
          <View style={[styles.timerDivider, {backgroundColor: theme.border}]} />
          <View style={styles.timerFooter}>
            <View style={styles.timerMetric}>
              <View style={[styles.metricIcon, {backgroundColor: theme.primarySoft}]}> 
                <View style={[styles.metricClock, {borderColor: theme.primary}]}> 
                  <View style={[styles.metricHand, {backgroundColor: theme.primary}]} />
                </View>
              </View>
              <View>
              <Text style={[styles.timerFooterLabel, {color: theme.textSubtle}]}>{t('ENDS AT')}</Text>
              <Text style={[styles.timerFooterValue, {color: theme.text}]}> 
                {new Date(activeSession.endTimestamp).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}
              </Text>
              </View>
            </View>
            <View style={styles.appsMetric}>
              <Text style={[styles.timerFooterLabel, {color: theme.textSubtle}]}>{t('PROTECTED APPS')}</Text>
              <View style={styles.appStack}>
                {activeSession.blockedApps.slice(0, 4).map((app, index) => (
                  <View key={app.packageName} style={index ? styles.stackedIcon : undefined}>
                    <AppIcon app={app} size={32} />
                  </View>
                ))}
                {activeSession.blockedApps.length > 4 ? (
                  <View style={[styles.stackCount, styles.stackedIcon, {backgroundColor: theme.surfaceMuted, borderColor: theme.surface}]}> 
                    <Text style={[styles.stackCountText, {color: theme.text}]}>+{activeSession.blockedApps.length - 4}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </Card>

        <Card theme={theme} tone="muted" style={styles.protectionCard}>
          <View
            style={[
              styles.protectionIcon,
              {backgroundColor: permission.ready ? theme.successSoft : theme.dangerSoft},
            ]}>
            <View style={[styles.shieldTop, {borderColor: permission.ready ? theme.success : theme.danger}]} />
            <Text style={[styles.shieldCheck, {color: permission.ready ? theme.success : theme.danger}]}>✓</Text>
          </View>
          <View style={styles.protectionCopy}>
            <Text style={[styles.protectionTitle, {color: theme.text}]}>
              {permission.ready ? t('Native protection is on') : t('Blocking has stopped')}
            </Text>
            <Text style={[styles.protectionBody, {color: theme.textMuted}]}>
              {permission.ready
                ? t('Blocking continues even when Qoriqchi is closed.')
                : t('Accessibility access is off, so blocked apps open normally. Turn it back on to resume this session.')}
            </Text>
          </View>
          <View style={[styles.protectionState, {backgroundColor: permission.ready ? theme.successSoft : theme.dangerSoft}]}> 
            <View style={[styles.protectionStateDot, {backgroundColor: permission.ready ? theme.success : theme.danger}]} />
            <Text style={[styles.protectionStateText, {color: permission.ready ? theme.success : theme.danger}]}>{permission.ready ? t('ON') : t('OFF')}</Text>
          </View>
        </Card>

        {permission.ready ? null : (
          <View style={styles.resumeButton}>
            <PrimaryButton
              label={t('Turn blocking back on')}
              onPress={openPermissionSettings}
              theme={theme}
            />
          </View>
        )}

        {activeSession.strict ? (
          <Card theme={theme} tone="muted" style={styles.lockedCard}>
            <Text style={[styles.lockedTitle, {color: theme.text}]}>
              {t('Strict session')}
            </Text>
            <Text style={[styles.lockedBody, {color: theme.textMuted}]}>
              {t(
                'You chose not to be able to stop this one. It ends on its own when the timer runs out.',
              )}
            </Text>
          </Card>
        ) : (
          <PrimaryButton
            label={t('End focus session')}
            onPress={confirmEnd}
            theme={theme}
            loading={busy}
            variant="danger"
            leading={<View style={[styles.stopGlyph, {borderColor: theme.danger}]} />}
          />
        )}
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
        eyebrow={t('YOUR FOCUS SPACE')}
        title={t('Protect the next hour.')}
        subtitle={t('Choose what stays quiet, then let Qoriqchi hold the boundary.')}
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
            <Text style={[styles.permissionTitle, {color: theme.text}]}>{t('Finish setup')}</Text>
            <Text style={[styles.permissionBody, {color: theme.textMuted}]}>{t('Accessibility access is required before focus can start.')}</Text>
          </View>
          <Text style={[styles.permissionArrow, {color: theme.warning}]}>›</Text>
        </Pressable>
      ) : null}

      <View style={styles.sectionHeaderRow}>
        <SectionTitle theme={theme}>{t('Distractions')}</SectionTitle>
        <Pressable hitSlop={10} onPress={onOpenApps} style={styles.editLinkTap}>
          <Text style={[styles.editLink, {color: theme.primary}]}>{t('Edit list')}</Text>
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
            <Text style={[styles.appsCardTitle, {color: theme.text}]}>{t('Your block list is ready')}</Text>
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
              <Text style={[styles.emptyTitle, {color: theme.text}]}>{t('Choose apps to quiet')}</Text>
              <Text style={[styles.emptyBody, {color: theme.textMuted}]}>{t('Social, video, games, or anything that pulls you away.')}</Text>
            </View>
            <Text style={[styles.chevron, {color: theme.textSubtle}]}>›</Text>
          </Pressable>
        )}
      </Card>

      <SectionTitle theme={theme}>{t('Duration')}</SectionTitle>
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
                {minutes < 60 ? t('min') : minutes === 60 ? t('hour') : t('hours')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.customRow, {backgroundColor: theme.surface, borderColor: theme.border}]}>
        <View>
          <Text style={[styles.customLabel, {color: theme.text}]}>{t('Custom duration')}</Text>
          <Text style={[styles.customHint, {color: theme.textSubtle}]}>{t('1 minute to 24 hours')}</Text>
        </View>
        <View style={[styles.customInputWrap, {backgroundColor: theme.surfaceMuted}]}>
          <TextInput
            accessibilityLabel={t('Custom focus duration in minutes')}
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
          <Text style={[styles.customSuffix, {color: theme.textMuted}]}>{t('min')}</Text>
        </View>
      </View>

      <SectionTitle theme={theme} detail={t('Optional')}>{t('Start time')}</SectionTitle>
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
                {delay === 0 ? t('Now') : `+${formatMinutes(delay, t)}`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Card theme={theme} tone="accent" style={styles.summaryCard}>
        <View>
          <Text style={[styles.summaryEyebrow, {color: theme.primary}]}>{t('READY WHEN YOU ARE')}</Text>
          <Text style={[styles.summaryTitle, {color: theme.text}]}>{t('{d} of protected time', {d: formatMinutes(durationMinutes, t)})}</Text>
          <Text style={[styles.summaryMeta, {color: theme.textMuted}]}>{t('Ends at {time}', {time: endTime})}</Text>
        </View>
        <View style={[styles.summaryFocusIcon, {borderColor: theme.primary}]}>
          <View style={[styles.summaryFocusDot, {backgroundColor: theme.primary}]} />
        </View>
      </Card>

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{checked: strict}}
        onPress={() => setStrict(value => !value)}
        style={({pressed}) => [
          styles.strictRow,
          {
            backgroundColor: strict ? theme.primarySoft : theme.surface,
            borderColor: strict ? theme.primary : theme.border,
          },
          pressed && styles.strictPressed,
        ]}>
        <View
          style={[
            styles.strictBox,
            {
              borderColor: strict ? theme.primary : theme.borderStrong,
              backgroundColor: strict ? theme.primary : 'transparent',
            },
          ]}>
          {strict ? (
            <Text style={[styles.strictTick, {color: theme.background}]}>✓</Text>
          ) : null}
        </View>
        <View style={styles.strictCopy}>
          <Text style={[styles.strictTitle, {color: theme.text}]}>{t('Strict session')}</Text>
          <Text style={[styles.strictBody, {color: theme.textMuted}]}>
            {strict
              ? t('You will not be able to end this session early.')
              : t('Make this session impossible to end early.')}
          </Text>
        </View>
      </Pressable>

      <PrimaryButton
        label={t('Start {d} focus', {d: formatMinutes(durationMinutes, t)})}
        trailing="→"
        onPress={start}
        theme={theme}
        disabled={!selectedApps.length || !permission.ready}
        loading={busy}
      />
      {!selectedApps.length ? (
        <Text style={[styles.startHint, {color: theme.textSubtle}]}>{t('Choose at least one app to begin.')}</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl},
  activeContent: {paddingTop: spacing.md},
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
  strictRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  strictPressed: {opacity: 0.75},
  strictBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  strictTick: {fontSize: 13, fontWeight: '900'},
  strictCopy: {flex: 1},
  strictTitle: {fontSize: 14.5, fontWeight: '700'},
  strictBody: {fontSize: 12.5, lineHeight: 18, marginTop: 2},
  lockedCard: {alignItems: 'flex-start'},
  lockedTitle: {fontSize: 15, fontWeight: '700', marginBottom: 4},
  lockedBody: {fontSize: 13, lineHeight: 19},
  summaryTitle: {fontSize: 16, fontWeight: '700'},
  summaryMeta: {fontSize: 12, marginTop: 4},
  summaryFocusIcon: {width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  summaryFocusDot: {width: 12, height: 12, borderRadius: 6},
  startHint: {fontSize: 11, textAlign: 'center', marginTop: spacing.sm},
  activeHeader: {marginBottom: spacing.lg},
  activeMetaRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  sessionMonogram: {flexDirection: 'row', alignItems: 'center', gap: 7},
  sessionMonogramLine: {width: 18, height: 2, borderRadius: 2},
  sessionMonogramText: {fontSize: 9, fontWeight: '900', letterSpacing: 1.7},
  activeTitle: {fontSize: 38, lineHeight: 44, fontWeight: '900', letterSpacing: -1.5, marginTop: spacing.lg},
  activeSubtitle: {fontSize: 15, lineHeight: 22, fontWeight: '500', marginTop: spacing.xs, maxWidth: 330},
  timerCard: {padding: spacing.lg, marginBottom: spacing.md, shadowOpacity: 0.38, shadowRadius: 28},
  timerCornerGlow: {position: 'absolute', width: 130, height: 130, borderRadius: 65, top: -86, right: -56, opacity: 0.14},
  timerCardHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md},
  timerCardEyebrow: {fontSize: 9, fontWeight: '900', letterSpacing: 1.8},
  livePill: {minHeight: 25, borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 6},
  liveDot: {width: 5, height: 5, borderRadius: 3},
  liveText: {fontSize: 9, fontWeight: '900', letterSpacing: 1},
  timerHalo: {width: 250, height: 250, borderRadius: 125, borderWidth: 1, alignSelf: 'center', alignItems: 'center', justifyContent: 'center'},
  timerOuterRing: {position: 'absolute', width: 230, height: 230, borderRadius: 115, borderWidth: 1},
  tickAnchor: {position: 'absolute', width: 230, height: 230, top: -1, left: -1, alignItems: 'center'},
  timerTick: {width: 2, height: 7, borderRadius: 2, marginTop: 7},
  timerRing: {width: 202, height: 202, borderRadius: 101, borderWidth: 4, alignItems: 'center', justifyContent: 'center', elevation: 9, shadowColor: '#000000', shadowOffset: {width: 0, height: 9}, shadowOpacity: 0.38, shadowRadius: 16},
  timerLabel: {fontSize: 9, fontWeight: '900', letterSpacing: 2.1, marginBottom: spacing.xs},
  timer: {fontSize: 39, fontWeight: '300', letterSpacing: -0.3, fontVariant: ['tabular-nums']},
  timerModeRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm},
  timerModeDot: {width: 5, height: 5, borderRadius: 3},
  timerModeText: {fontSize: 8, fontWeight: '800', letterSpacing: 1.3},
  timerDivider: {height: 1, marginVertical: spacing.lg, opacity: 0.8},
  timerFooter: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  timerMetric: {flexDirection: 'row', alignItems: 'center', gap: 10},
  metricIcon: {width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  metricClock: {width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, alignItems: 'center'},
  metricHand: {width: 1.5, height: 5, borderRadius: 1, marginTop: 3, transform: [{rotate: '-18deg'}]},
  appsMetric: {alignItems: 'flex-end', gap: 7},
  timerFooterLabel: {fontSize: 9, fontWeight: '800', letterSpacing: 1.3},
  timerFooterValue: {fontSize: 16, fontWeight: '700', marginTop: 3},
  stackCount: {width: 32, height: 32, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  stackCountText: {fontSize: 10, fontWeight: '800'},
  protectionCard: {flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, paddingVertical: 17},
  resumeButton: {marginBottom: spacing.sm},
  protectionIcon: {width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center'},
  shieldTop: {position: 'absolute', width: 20, height: 22, borderWidth: 1.5, borderRadius: 8, transform: [{rotate: '45deg'}]},
  shieldCheck: {fontSize: 13, fontWeight: '900'},
  protectionCopy: {flex: 1, marginLeft: spacing.sm},
  protectionTitle: {fontSize: 14, fontWeight: '700', marginBottom: 3},
  protectionBody: {fontSize: 12, lineHeight: 17},
  protectionState: {height: 25, borderRadius: radii.pill, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: spacing.xs},
  protectionStateDot: {width: 5, height: 5, borderRadius: 3},
  protectionStateText: {fontSize: 8, fontWeight: '900', letterSpacing: 0.8},
  stopGlyph: {width: 10, height: 10, borderRadius: 2, borderWidth: 2},
});
