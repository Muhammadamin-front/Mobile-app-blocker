import React, {useState} from 'react';
import {Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {FocusSchedule} from '../domain/models';
import {
  createSchedule,
  DAY_KEYS,
  describeDays,
  EVERY_DAY,
  formatStartMinute,
  hasDay,
  shiftMinute,
  toggleDay,
  WEEKDAYS,
} from '../domain/schedules';
import {formatMinutes} from '../domain/session';
import {useAppStore} from '../state/AppStore';
import {radii, spacing, Theme} from '../theme/theme';
import {Card, PrimaryButton, SectionTitle} from './components';

const DURATIONS = [15, 30, 60, 120];

/**
 * Schedules reuse the block list rather than carrying their own, so setting one up
 * is a question of when, not what — and changing the list changes every schedule at
 * once, which is what people mean by "my distractions".
 */
export function SchedulesSection({theme}: {theme: Theme}) {
  const {schedules, saveSchedule, deleteSchedule, selectedApps, t} = useAppStore();
  const [draft, setDraft] = useState<FocusSchedule | null>(null);

  const close = () => setDraft(null);

  const commit = async () => {
    if (!draft) {
      return;
    }
    if (!(draft.days & EVERY_DAY)) {
      Alert.alert(t('Pick at least one day'), t('A schedule with no days never runs.'));
      return;
    }
    close();
    await saveSchedule(draft);
  };

  const confirmDelete = (schedule: FocusSchedule) => {
    Alert.alert(
      t('Delete this schedule?'),
      t('It will stop starting sessions on its own.'),
      [
        {text: t('Cancel'), style: 'cancel'},
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: () => {
            close();
            deleteSchedule(schedule.id);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <SectionTitle theme={theme}>{t('Schedules')}</SectionTitle>
        <Pressable hitSlop={10} onPress={() => setDraft(createSchedule())} style={styles.addTap}>
          <Text style={[styles.add, {color: theme.primary}]}>{t('Add')}</Text>
        </Pressable>
      </View>

      {schedules.length ? (
        <Card theme={theme} style={styles.list}>
          {schedules.map((schedule, index) => (
            <Pressable
              key={schedule.id}
              accessibilityRole="button"
              onPress={() => setDraft(schedule)}
              style={[
                styles.row,
                index ? {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border} : null,
              ]}>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTime, {color: schedule.enabled ? theme.text : theme.textSubtle}]}>
                  {formatStartMinute(schedule.startMinute)}
                </Text>
                <Text style={[styles.rowDays, {color: theme.textMuted}]}>
                  {describeDays(schedule.days, t)} · {formatMinutes(schedule.durationMinutes, t)}
                  {schedule.strict ? ` · ${t('Strict')}` : ''}
                </Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{checked: schedule.enabled}}
                hitSlop={8}
                onPress={() => saveSchedule({...schedule, enabled: !schedule.enabled})}
                style={[
                  styles.switch,
                  {
                    backgroundColor: schedule.enabled ? theme.primary : theme.surfaceMuted,
                    borderColor: schedule.enabled ? theme.primary : theme.border,
                  },
                ]}>
                <View
                  style={[
                    styles.knob,
                    {
                      backgroundColor: schedule.enabled ? theme.background : theme.textSubtle,
                      alignSelf: schedule.enabled ? 'flex-end' : 'flex-start',
                    },
                  ]}
                />
              </Pressable>
            </Pressable>
          ))}
        </Card>
      ) : (
        <Card theme={theme} tone="muted" style={styles.empty}>
          <Text style={[styles.emptyTitle, {color: theme.text}]}>{t('No schedules yet')}</Text>
          <Text style={[styles.emptyBody, {color: theme.textMuted}]}>
            {t('Set one and focus starts on its own, without you having to remember.')}
          </Text>
        </Card>
      )}

      <Modal visible={Boolean(draft)} transparent animationType="fade" onRequestClose={close}>
        <View style={[styles.backdrop, {backgroundColor: theme.overlay}]}>
          <View
            style={[
              styles.sheet,
              {backgroundColor: theme.surfaceRaised, borderColor: theme.border},
            ]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sheetTitle, {color: theme.text}]}>{t('Schedule')}</Text>
              <Text style={[styles.sheetBody, {color: theme.textMuted}]}>
                {selectedApps.length
                  ? t('Blocks the {n} apps on your list.', {n: selectedApps.length})
                  : t('Choose apps first — a schedule blocks your saved list.')}
              </Text>

              <Text style={[styles.label, {color: theme.textMuted}]}>{t('Days')}</Text>
              <View style={styles.days}>
                {DAY_KEYS.map((day, index) => {
                  const on = draft ? hasDay(draft.days, index) : false;
                  return (
                    <Pressable
                      key={day}
                      accessibilityRole="checkbox"
                      accessibilityState={{checked: on}}
                      onPress={() =>
                        setDraft(current =>
                          current ? {...current, days: toggleDay(current.days, index)} : current,
                        )
                      }
                      style={[
                        styles.day,
                        {
                          backgroundColor: on ? theme.primary : theme.surfaceMuted,
                          borderColor: on ? theme.primary : theme.border,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.dayText,
                          {color: on ? theme.background : theme.textMuted},
                        ]}>
                        {t(day).slice(0, 2)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.presetRow}>
                <Pressable
                  hitSlop={6}
                  onPress={() =>
                    setDraft(current => (current ? {...current, days: WEEKDAYS} : current))
                  }>
                  <Text style={[styles.preset, {color: theme.primary}]}>{t('Weekdays')}</Text>
                </Pressable>
                <Pressable
                  hitSlop={6}
                  onPress={() =>
                    setDraft(current => (current ? {...current, days: EVERY_DAY} : current))
                  }>
                  <Text style={[styles.preset, {color: theme.primary}]}>{t('Every day')}</Text>
                </Pressable>
              </View>

              <Text style={[styles.label, {color: theme.textMuted}]}>{t('Starts at')}</Text>
              <View style={[styles.stepper, {borderColor: theme.border}]}>
                <Pressable
                  accessibilityLabel={t('Earlier')}
                  hitSlop={8}
                  onPress={() =>
                    setDraft(current =>
                      current
                        ? {...current, startMinute: shiftMinute(current.startMinute, -15)}
                        : current,
                    )
                  }
                  style={styles.stepTap}>
                  <Text style={[styles.step, {color: theme.primary}]}>−</Text>
                </Pressable>
                <Text style={[styles.time, {color: theme.text}]}>
                  {draft ? formatStartMinute(draft.startMinute) : '--:--'}
                </Text>
                <Pressable
                  accessibilityLabel={t('Later')}
                  hitSlop={8}
                  onPress={() =>
                    setDraft(current =>
                      current
                        ? {...current, startMinute: shiftMinute(current.startMinute, 15)}
                        : current,
                    )
                  }
                  style={styles.stepTap}>
                  <Text style={[styles.step, {color: theme.primary}]}>+</Text>
                </Pressable>
              </View>

              <Text style={[styles.label, {color: theme.textMuted}]}>{t('Duration')}</Text>
              <View style={styles.durations}>
                {DURATIONS.map(minutes => {
                  const on = draft?.durationMinutes === minutes;
                  return (
                    <Pressable
                      key={minutes}
                      accessibilityRole="radio"
                      accessibilityState={{checked: on}}
                      onPress={() =>
                        setDraft(current =>
                          current ? {...current, durationMinutes: minutes} : current,
                        )
                      }
                      style={[
                        styles.duration,
                        {
                          backgroundColor: on ? theme.primarySoft : theme.surfaceMuted,
                          borderColor: on ? theme.primary : theme.border,
                        },
                      ]}>
                      <Text style={[styles.durationText, {color: on ? theme.primary : theme.textMuted}]}>
                        {formatMinutes(minutes, t)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                accessibilityRole="switch"
                accessibilityState={{checked: draft?.strict ?? false}}
                onPress={() =>
                  setDraft(current => (current ? {...current, strict: !current.strict} : current))
                }
                style={[
                  styles.strict,
                  {
                    backgroundColor: draft?.strict ? theme.primarySoft : theme.surfaceMuted,
                    borderColor: draft?.strict ? theme.primary : theme.border,
                  },
                ]}>
                <View
                  style={[
                    styles.strictBox,
                    {
                      borderColor: draft?.strict ? theme.primary : theme.borderStrong,
                      backgroundColor: draft?.strict ? theme.primary : 'transparent',
                    },
                  ]}>
                  {draft?.strict ? (
                    <Text style={[styles.strictTick, {color: theme.background}]}>✓</Text>
                  ) : null}
                </View>
                <Text style={[styles.strictText, {color: theme.text}]}>
                  {t('Start it as a strict session')}
                </Text>
              </Pressable>

              <View style={styles.actions}>
                <PrimaryButton label={t('Save schedule')} onPress={commit} theme={theme} />
                {draft && schedules.some(item => item.id === draft.id) ? (
                  <PrimaryButton
                    label={t('Delete')}
                    onPress={() => confirmDelete(draft)}
                    theme={theme}
                    variant="danger"
                  />
                ) : null}
                <PrimaryButton
                  label={t('Cancel')}
                  onPress={close}
                  theme={theme}
                  variant="ghost"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {marginBottom: spacing.xl},
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  addTap: {paddingBottom: spacing.sm, paddingLeft: spacing.sm},
  add: {fontSize: 13, fontWeight: '700'},
  list: {paddingVertical: 0},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  rowCopy: {flex: 1},
  rowTime: {fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums']},
  rowDays: {fontSize: 12.5, marginTop: 2},
  switch: {width: 46, height: 28, borderRadius: radii.pill, borderWidth: 1, padding: 3, justifyContent: 'center'},
  knob: {width: 20, height: 20, borderRadius: 10},
  empty: {paddingVertical: spacing.lg},
  emptyTitle: {fontSize: 15, fontWeight: '700', marginBottom: 4},
  emptyBody: {fontSize: 13, lineHeight: 19},
  backdrop: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg},
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '86%',
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.xl,
  },
  sheetTitle: {fontSize: 21, fontWeight: '800', letterSpacing: -0.4},
  sheetBody: {fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: spacing.lg},
  label: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  days: {flexDirection: 'row', gap: 6},
  day: {
    flex: 1,
    height: 42,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {fontSize: 12, fontWeight: '700'},
  presetRow: {flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.lg},
  preset: {fontSize: 12.5, fontWeight: '700'},
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    height: 56,
    marginBottom: spacing.lg,
  },
  stepTap: {width: 48, height: 48, alignItems: 'center', justifyContent: 'center'},
  step: {fontSize: 26, fontWeight: '700'},
  time: {fontSize: 26, fontWeight: '700', fontVariant: ['tabular-nums']},
  durations: {flexDirection: 'row', gap: 6, marginBottom: spacing.lg},
  duration: {
    flex: 1,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationText: {fontSize: 12.5, fontWeight: '700'},
  strict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  strictBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strictTick: {fontSize: 13, fontWeight: '900'},
  strictText: {flex: 1, fontSize: 13.5, fontWeight: '600'},
  actions: {gap: spacing.sm},
});
