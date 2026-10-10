import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {useAppStore} from '../state/AppStore';
import {radii, spacing, Theme} from '../theme/theme';
import {Card, SectionTitle} from './components';

interface Option {
  key: string;
  title: string;
  detail: string;
  progress?: number;
  active: boolean;
  choose(): void;
}

/**
 * Picks what the block screen shows: five English words to recall, the next page of a
 * book, or the countdown. Every reach for a blocked app becomes a little study instead.
 */
export function ReadingSection({theme}: {theme: Theme}) {
  const {shelf, selectBook, selectWords, t} = useAppStore();

  if (!shelf.books.length && !shelf.words.deckSize) {
    return null;
  }

  const options: Option[] = [
    ...(shelf.words.deckSize
      ? [
          {
            key: 'words',
            title: t('English words · B1–B2'),
            detail: t('{seen} of {total} seen · {learned} learned', {
              seen: shelf.words.seen,
              total: shelf.words.deckSize,
              learned: shelf.words.learned,
            }),
            progress: shelf.words.learned / shelf.words.deckSize,
            active: shelf.material === 'words',
            choose: () => selectWords(),
          },
        ]
      : []),
    ...shelf.books.map(book => ({
      key: book.id,
      title: book.title,
      detail: book.year ? `${book.author} · ${book.year}` : book.author,
      progress: book.pageCount ? (book.page + 1) / book.pageCount : 0,
      active: shelf.material === 'book' && shelf.selected === book.id,
      choose: () => selectBook(book.id),
    })),
    {
      key: 'none',
      title: t('No book'),
      detail: t('Show the countdown and a quote instead'),
      active: shelf.material === 'timer',
      choose: () => selectBook(null),
    },
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
          {t('When you open a blocked app, Qoriqchi shows this instead.')}
        </Text>
        {options.map(option => {
          const active = option.active;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{checked: active}}
              onPress={option.choose}
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
                {option.progress !== undefined && option.progress > 0 ? (
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
          {t('Books: public-domain texts from Wikisource. Words: New General Service List (CC BY-SA 4.0). Everything is stored on this phone.')}
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
