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
import {Theme} from '../../theme/theme';
import {AppIcon} from '../components';

export function AppsScreen({theme}: {theme: Theme}) {
  const {busy, installedApps, selectedApps, loadInstalledApps, setSelectedApps} = useAppStore();
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
      <View style={styles.header}>
        <Text style={[styles.title, {color: theme.text}]}>Choose apps</Text>
        <Text style={[styles.subtitle, {color: theme.textMuted}]}>{selectedApps.length} selected</Text>
      </View>
      <TextInput
        accessibilityLabel="Search installed apps"
        value={query}
        onChangeText={setQuery}
        placeholder="Search apps or package names"
        placeholderTextColor={theme.textMuted}
        autoCorrect={false}
        style={[styles.search, {backgroundColor: theme.surface, borderColor: theme.border, color: theme.text}]}
      />
      <View style={styles.actions}>
        <Pressable onPress={() => setSelectedApps(installedApps)}><Text style={[styles.actionText, {color: theme.primary}]}>Select all</Text></Pressable>
        <Pressable onPress={() => setSelectedApps([])} disabled={!selectedApps.length}><Text style={[styles.actionText, {color: selectedApps.length ? theme.primary : theme.textMuted}]}>Clear</Text></Pressable>
      </View>
      {busy && !installedApps.length ? (
        <View style={styles.loading}><ActivityIndicator color={theme.primary} size="large" /><Text style={{color: theme.textMuted}}>Loading launchable apps…</Text></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.packageName}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({item}) => {
            const checked = selected.has(item.packageName);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{checked}}
                onPress={() => toggle(item)}
                style={[styles.row, {borderBottomColor: theme.border}]}>
                <AppIcon app={item} />
                <View style={styles.appCopy}>
                  <Text style={[styles.appName, {color: theme.text}]} numberOfLines={1}>{item.appName}</Text>
                  <Text style={[styles.packageName, {color: theme.textMuted}]} numberOfLines={1}>{item.packageName}</Text>
                </View>
                {/* Dynamic theme colors intentionally stay next to the state they represent. */}
                {/* eslint-disable-next-line react-native/no-inline-styles */}
                <View style={[styles.checkbox, {borderColor: checked ? theme.primary : theme.border, backgroundColor: checked ? theme.primary : 'transparent'}]}>
                  {checked && <Text style={styles.check}>✓</Text>}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={[styles.empty, {color: theme.textMuted}]}>{query ? 'No matching apps.' : 'No launchable apps were found.'}</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, paddingTop: 22},
  header: {paddingHorizontal: 22, marginBottom: 16},
  title: {fontSize: 32, fontWeight: '800', letterSpacing: -0.8},
  subtitle: {fontSize: 14, marginTop: 4},
  search: {height: 50, borderWidth: 1, borderRadius: 16, marginHorizontal: 22, paddingHorizontal: 16, fontSize: 15},
  actions: {flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 25, paddingVertical: 15},
  actionText: {fontSize: 14, fontWeight: '700'},
  list: {paddingHorizontal: 22, paddingBottom: 20},
  row: {minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth},
  appCopy: {flex: 1, marginHorizontal: 13},
  appName: {fontSize: 16, fontWeight: '700', marginBottom: 3},
  packageName: {fontSize: 11},
  checkbox: {width: 25, height: 25, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  check: {color: '#FFFFFF', fontWeight: '900'},
  loading: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14},
  empty: {textAlign: 'center', marginTop: 50},
});
