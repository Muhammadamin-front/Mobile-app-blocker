import React, {useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';

import {daysUntil, Exam, EXAM_KINDS, ExamKind, examName} from '../domain/exam';
import {useAppStore} from '../state/AppStore';
import {radii, spacing, Theme} from '../theme/theme';
import {Card, PrimaryButton} from './components';

/**
 * The countdown to the exam a student is studying for. It is shown here and, more
 * pointedly, on the block screen, where "DTM in 87 days" is the argument for closing
 * the app that was just opened.
 */
export function ExamCard({theme}: {theme: Theme}) {
  const {exam, saveExam, pickDate, t} = useAppStore();
  const [draft, setDraft] = useState<Exam | null>(null);

  const days = exam ? daysUntil(exam.date) : null;
  const passed = days !== null && days < 0;

  const open = () =>
    setDraft(exam ?? {kind: 'dtm', label: '', date: ''});

  const chooseDate = async () => {
    const date = await pickDate(draft?.date || null);
    if (date) {
      setDraft(current => (current ? {...current, date} : current));
    }
  };

  const save = async () => {
    if (!draft?.date) {
      return;
    }
    setDraft(null);
    await saveExam({...draft, label: draft.label.trim()});
  };

  const remove = async () => {
    setDraft(null);
    await saveExam(null);
  };

  return (
    <>
      {exam && !passed && days !== null ? (
        <Pressable accessibilityRole="button" onPress={open} style={styles.tap}>
          <Card theme={theme} tone="accent" style={styles.card}>
            <View style={styles.count}>
              <Text style={[styles.days, {color: theme.primary}]}>{days}</Text>
              <Text style={[styles.daysUnit, {color: theme.textMuted}]}>{t('days')}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={[styles.title, {color: theme.text}]}>
                {days === 0
                  ? t('{exam} is today', {exam: examName(exam, t)})
                  : t('until {exam}', {exam: examName(exam, t)})}
              </Text>
              <Text style={[styles.body, {color: theme.textMuted}]}>
                {t('Shown on the block screen too. Tap to change.')}
              </Text>
            </View>
          </Card>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={open}
          style={[styles.prompt, {borderColor: theme.border, backgroundColor: theme.surface}]}>
          <View style={styles.copy}>
            <Text style={[styles.title, {color: theme.text}]}>
              {passed ? t('Your exam has passed') : t('Counting down to an exam?')}
            </Text>
            <Text style={[styles.body, {color: theme.textMuted}]}>
              {passed
                ? t('Set the next one and the countdown starts again.')
                : t('Add DTM, final exams or IELTS. The days left appear when you reach for a blocked app.')}
            </Text>
          </View>
          <Text style={[styles.add, {color: theme.primary}]}>{t('Add')}</Text>
        </Pressable>
      )}

      <Modal visible={Boolean(draft)} transparent animationType="fade" onRequestClose={() => setDraft(null)}>
        <View style={[styles.backdrop, {backgroundColor: theme.overlay}]}>
          <View style={[styles.sheet, {backgroundColor: theme.surfaceRaised, borderColor: theme.border}]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.sheetTitle, {color: theme.text}]}>{t('Exam')}</Text>
              <View style={styles.kinds}>
                {EXAM_KINDS.map(item => {
                  const on = draft?.kind === item.kind;
                  return (
                    <Pressable
                      key={item.kind}
                      accessibilityRole="radio"
                      accessibilityState={{checked: on}}
                      onPress={() =>
                        setDraft(current => (current ? {...current, kind: item.kind as ExamKind} : current))
                      }
                      style={[
                        styles.kind,
                        {
                          backgroundColor: on ? theme.primarySoft : theme.surfaceMuted,
                          borderColor: on ? theme.primary : theme.border,
                        },
                      ]}>
                      <Text style={[styles.kindText, {color: on ? theme.primary : theme.text}]}>
                        {t(item.name)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {draft?.kind === 'custom' ? (
                <TextInput
                  accessibilityLabel={t('Exam name')}
                  placeholder={t('Exam name')}
                  placeholderTextColor={theme.textSubtle}
                  value={draft.label}
                  maxLength={40}
                  onChangeText={label => setDraft(current => (current ? {...current, label} : current))}
                  style={[styles.input, {color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceMuted}]}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={chooseDate}
                style={[styles.dateRow, {borderColor: theme.border, backgroundColor: theme.surfaceMuted}]}>
                <Text style={[styles.dateLabel, {color: theme.textMuted}]}>{t('Date')}</Text>
                <Text style={[styles.dateValue, {color: draft?.date ? theme.text : theme.primary}]}>
                  {draft?.date ? formatDate(draft.date) : t('Choose a date')}
                </Text>
              </Pressable>
              <View style={styles.actions}>
                <PrimaryButton label={t('Save')} onPress={save} theme={theme} disabled={!draft?.date} />
                {exam ? (
                  <PrimaryButton label={t('Remove')} onPress={remove} theme={theme} variant="danger" />
                ) : null}
                <PrimaryButton label={t('Cancel')} onPress={() => setDraft(null)} theme={theme} variant="ghost" />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  tap: {marginBottom: spacing.xl},
  card: {flexDirection: 'row', alignItems: 'center', gap: spacing.md},
  count: {alignItems: 'center', minWidth: 64},
  days: {fontSize: 40, fontWeight: '900', letterSpacing: -1.2, fontVariant: ['tabular-nums']},
  daysUnit: {fontSize: 11, fontWeight: '700', marginTop: -2},
  copy: {flex: 1},
  title: {fontSize: 16, fontWeight: '800'},
  body: {fontSize: 12.5, lineHeight: 18, marginTop: 3},
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  add: {fontSize: 13, fontWeight: '800'},
  backdrop: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg},
  sheet: {width: '100%', maxWidth: 440, maxHeight: '86%', borderWidth: 1, borderRadius: radii.xl, padding: spacing.xl},
  sheetTitle: {fontSize: 21, fontWeight: '800', letterSpacing: -0.4, marginBottom: spacing.md},
  kinds: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md},
  kind: {borderWidth: 1, borderRadius: radii.pill, paddingVertical: 9, paddingHorizontal: spacing.md},
  kindText: {fontSize: 13, fontWeight: '700'},
  input: {borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, height: 48, fontSize: 15, marginBottom: spacing.md},
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 56,
    marginBottom: spacing.lg,
  },
  dateLabel: {fontSize: 12, fontWeight: '700'},
  dateValue: {fontSize: 15, fontWeight: '800'},
  actions: {gap: spacing.sm},
});
