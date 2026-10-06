import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {useAppStore} from '../state/AppStore';
import {radii, spacing, Theme} from '../theme/theme';
import {Card, SectionTitle} from './components';

/**
 * Picks the book the block screen opens. Every reach for a blocked app becomes a
 * page of it, continuing where the last one stopped. "No book" keeps the countdown.
 */
export function ReadingSection({theme}: {theme: Theme}) {
  const {shelf, selectBook, t} = useAppStore();

  if (!shelf.books.length) {
    return null;
  }

  const options: Array<{id: string | null; title: string; detail: string; progress?: number}> = [
    ...shelf.books.map(book => ({
      id: book.id as string | null,
      title: book.title,
      detail: `${book.author} · ${book.year}`,
      progress: book.pageCount ? (book.page + 1) / book.pageCount : 0,
    })),
    {id: null, title: t('No book'), detail: t('Show the countdown and a quote instead')},
  ];

  return (
    <View style={styles.block}>
      <SectionTitle
        theme={theme}
        detail={t('{n} pages read', {n: shelf.pagesRead})}>
        {t('Read instead')}
      </SectionTitle>
      <Card theme={theme} style={styles.card}>
        <Text style={[styles.lead, {color: theme.textMuted}]}>
          {t('When you open a blocked app, Qoriqchi shows the next page of this book instead.')}
        </Text>
        {options.map(option => {
          const active = shelf.selected === option.id;
          return (
            <Pressable
              key={option.id ?? 'none'}
              accessibilityRole="radio"
              accessibilityState={{checked: active}}
              onPress={() => selectBook(option.id)}
              style={[
                styles.option,
                {
                  borderColor: active ? theme.primary : theme.border,
                  backgroundColor: active ? theme.primarySoft : theme.surfaceMuted,
                },
              ]}>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, {color: theme.text}]}>{option.title}</Text>
                <Text style={[styles.optionDetail, {color: theme.textMuted}]}>{option.detail}</Text>
                {option.progress !== undefined && option.progress > 0 && option.id !== null ? (
                  <View style={[styles.track, {backgroundColor: theme.surface}]}>
                    <View
                      style={[
                        styles.fill,
                        {backgroundColor: theme.primary, width: `${Math.min(100, option.progress * 100)}%`},
                      ]}
                    />
                  </View>
                ) : null}
              </View>
              <View style={[styles.radio, {borderColor: active ? theme.primary : theme.borderStrong}]}>
                {active ? <View style={[styles.radioDot, {backgroundColor: theme.primary}]} /> : null}
              </View>
            </Pressable>
          );
        })}
        <Text style={[styles.credit, {color: theme.textMuted}]}>
          {t('Public-domain texts from Wikisource. Stored on this phone; no internet needed.')}
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {marginBottom: spacing.lg},
  card: {gap: spacing.sm},
  lead: {fontSize: 13, lineHeight: 19, marginBottom: spacing.xs},
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  optionCopy: {flex: 1},
  optionTitle: {fontSize: 15, fontWeight: '700'},
  optionDetail: {fontSize: 12, marginTop: 2},
  track: {height: 4, borderRadius: 2, marginTop: spacing.xs, overflow: 'hidden'},
  fill: {height: 4, borderRadius: 2},
  radio: {width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  radioDot: {width: 10, height: 10, borderRadius: 5},
  credit: {fontSize: 11, lineHeight: 16, marginTop: spacing.xs},
});
