import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {InstalledApp} from '../../domain/models';
import {useAppStore} from '../../state/AppStore';
import {radii, spacing, Theme} from '../../theme/theme';
import {AppIcon, EmptyState, ScreenHeader} from '../components';

function AppSeparator() {
  return <View style={styles.separator} />;
}

export function AppsScreen({theme}: {theme: Theme}) {
  const {busy, installedApps, selectedApps, loadInstalledApps, setSelectedApps, t} =
    useAppStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadInstalledApps();
  }, [loadInstalledApps]);

  const selected = useMemo(() => new Set(selectedApps.map(app => app.packageName)), [selectedApps]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) {
      return installedApps;
    }
    return installedApps.filter(app =>
      `${app.appName} ${app.packageName}`.toLocaleLowerCase().includes(normalized),
    );
  }, [installedApps, query]);

  const toggle = (app: InstalledApp) => {
    if (selected.has(app.packageName)) {
      setSelectedApps(selectedApps.filter(item => item.packageName !== app.packageName));
    } else {
      setSelectedApps([...selectedApps, app]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topContent}>
        <ScreenHeader
          theme={theme}
          eyebrow={t('BLOCK LIST')}
          title={t('Quiet the noise.')}
          subtitle={t('Choose the apps that are most likely to interrupt your intention.')}
        />

        <View
          style={[
            styles.search,
            {backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow},
          ]}>
          <View style={styles.searchGlyph}>
            <View style={[styles.searchCircle, {borderColor: theme.textSubtle}]} />
            <View style={[styles.searchHandle, {backgroundColor: theme.textSubtle}]} />
          </View>
          <TextInput
            accessibilityLabel={t('Search installed apps')}
            value={query}
            onChangeText={setQuery}
            placeholder={t('Search apps or package names')}
            placeholderTextColor={theme.textSubtle}
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.searchInput, {color: theme.text}]}
          />
          {query ? (
            <Pressable accessibilityLabel={t('Clear search')} hitSlop={10} onPress={() => setQuery('')}>
              <View style={[styles.clearSearch, {backgroundColor: theme.surfaceMuted}]}>
                <Text style={[styles.clearSearchText, {color: theme.textMuted}]}>×</Text>
              </View>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.selectionBar, {backgroundColor: theme.primarySoft}]}>
          <View style={styles.selectionCountRow}>
            <View style={[styles.selectionCount, {backgroundColor: theme.primary}]}>
              <Text style={[styles.selectionCountText, {color: theme.inverseText}]}>{selectedApps.length}</Text>
            </View>
            <View>
              <Text style={[styles.selectionTitle, {color: theme.text}]}>{t('Apps selected')}</Text>
              <Text style={[styles.selectionSubtitle, {color: theme.textMuted}]}>{t('Saved automatically')}</Text>
            </View>
          </View>
          <View style={styles.selectionActions}>
            <Pressable hitSlop={8} onPress={() => setSelectedApps(installedApps)}>
              <Text style={[styles.actionText, {color: theme.primary}]}>{t('All')}</Text>
            </Pressable>
            <View style={[styles.actionDivider, {backgroundColor: `${theme.primary}35`}]} />
            <Pressable hitSlop={8} onPress={() => setSelectedApps([])} disabled={!selectedApps.length}>
              <Text style={[styles.actionText, {color: selectedApps.length ? theme.primary : theme.textSubtle}]}>{t('Clear')}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {busy && !installedApps.length ? (
        <View style={styles.loading}>
          <View style={[styles.loadingIcon, {backgroundColor: theme.primarySoft}]}>
            <ActivityIndicator color={theme.primary} />
          </View>
          <Text style={[styles.loadingTitle, {color: theme.text}]}>{t('Finding your apps')}</Text>
          <Text style={[styles.loadingBody, {color: theme.textMuted}]}>{t('Only launchable apps will appear here.')}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.packageName}
          contentContainerStyle={[styles.list, !filtered.length && styles.emptyList]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={AppSeparator}
          renderItem={({item}) => {
            const checked = selected.has(item.packageName);
            const checkboxColors = {
              borderColor: checked ? theme.primary : theme.borderStrong,
              backgroundColor: checked ? theme.primary : 'transparent',
            };
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{checked}}
                android_ripple={{color: theme.primarySoft}}
                onPress={() => toggle(item)}
                style={({pressed}) => [
                  styles.row,
                  {
                    backgroundColor: checked ? theme.primarySoft : theme.surface,
                    borderColor: checked ? `${theme.primary}45` : theme.border,
                  },
                  pressed && styles.rowPressed,
                ]}>
                <AppIcon app={item} size={48} />
                <View style={styles.appCopy}>
                  <Text style={[styles.appName, {color: theme.text}]} numberOfLines={1}>{item.appName}</Text>
                  <Text style={[styles.packageName, {color: theme.textSubtle}]} numberOfLines={1}>{item.packageName}</Text>
                </View>
                <View
                  style={[
                    styles.checkbox,
                    checkboxColors,
                  ]}>
              {checked ? <Text style={[styles.check, {color: theme.inverseText}]}>✓</Text> : null}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              theme={theme}
              symbol={query ? '⌕' : '□'}
              title={query ? t('No matching apps') : t('No launchable apps found')}
              body={
                query
                  ? t('Try a different name or package.')
                  : t('Qoriqchi could not find apps that can be opened.')
              }
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, paddingTop: spacing.lg},
  topContent: {paddingHorizontal: spacing.xl},
  search: {height: 54, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', elevation: 1, shadowOffset: {width: 0, height: 3}, shadowOpacity: 0.05, shadowRadius: 10},
  searchGlyph: {width: 22, height: 22, position: 'relative', marginRight: spacing.sm},
  searchCircle: {width: 14, height: 14, borderRadius: 7, borderWidth: 1.8, position: 'absolute', left: 1, top: 1},
  searchHandle: {position: 'absolute', width: 7, height: 1.8, borderRadius: 2, transform: [{rotate: '45deg'}], right: 1, bottom: 4},
  searchInput: {flex: 1, fontSize: 14, paddingVertical: 0},
  clearSearch: {width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center'},
  clearSearchText: {fontSize: 19, lineHeight: 21, marginTop: -2},
  selectionBar: {minHeight: 66, borderRadius: radii.lg, paddingHorizontal: spacing.md, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  selectionCountRow: {flexDirection: 'row', alignItems: 'center'},
  selectionCount: {width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm},
  selectionCountText: {fontSize: 13, fontWeight: '800'},
  selectionTitle: {fontSize: 13, fontWeight: '700'},
  selectionSubtitle: {fontSize: 10, marginTop: 2},
  selectionActions: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  actionText: {fontSize: 12, fontWeight: '800'},
  actionDivider: {width: 1, height: 15},
  list: {paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxl},
  emptyList: {flexGrow: 1, justifyContent: 'center'},
  separator: {height: spacing.xs},
  row: {minHeight: 72, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.sm, paddingVertical: 10, overflow: 'hidden'},
  rowPressed: {opacity: 0.72},
  appCopy: {flex: 1, marginHorizontal: spacing.sm},
  appName: {fontSize: 15, fontWeight: '700', marginBottom: 4},
  packageName: {fontSize: 10.5},
  checkbox: {width: 25, height: 25, borderRadius: 9, borderWidth: 1.8, alignItems: 'center', justifyContent: 'center'},
  check: {fontSize: 13, fontWeight: '900'},
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl},
  loadingIcon: {width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md},
  loadingTitle: {fontSize: 17, fontWeight: '700', marginBottom: 5},
  loadingBody: {fontSize: 13},
});
