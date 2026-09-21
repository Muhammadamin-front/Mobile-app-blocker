import React, {useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useAppStore} from '../state/AppStore';
import {darkTheme, lightTheme} from '../theme/theme';
import {AppsScreen} from './screens/AppsScreen';
import {HistoryScreen} from './screens/HistoryScreen';
import {HomeScreen} from './screens/HomeScreen';
import {OnboardingScreen} from './screens/OnboardingScreen';
import {SettingsScreen} from './screens/SettingsScreen';

type Tab = 'home' | 'apps' | 'history' | 'settings';

const tabs: Array<{id: Tab; label: string; glyph: string}> = [
  {id: 'home', label: 'Focus', glyph: '◉'},
  {id: 'apps', label: 'Apps', glyph: '▦'},
  {id: 'history', label: 'History', glyph: '◷'},
  {id: 'settings', label: 'Settings', glyph: '⚙'},
];

export function AppShell({isDark}: {isDark: boolean}) {
  const theme = isDark ? darkTheme : lightTheme;
  const {loading, error, clearError, onboardingCompleted} = useAppStore();
  const [tab, setTab] = useState<Tab>('home');

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, {backgroundColor: theme.background}]}>
        <View style={[styles.brandMark, {backgroundColor: theme.primary}]}>
          <Text style={styles.brandGlyph}>F</Text>
        </View>
        <ActivityIndicator color={theme.primary} size="large" />
        <Text style={[styles.loadingText, {color: theme.textMuted}]}>Preparing focus mode…</Text>
      </SafeAreaView>
    );
  }

  if (!onboardingCompleted) {
    return <OnboardingScreen theme={theme} />;
  }

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.background}]} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        {tab === 'home' && <HomeScreen theme={theme} onOpenApps={() => setTab('apps')} />}
        {tab === 'apps' && <AppsScreen theme={theme} />}
        {tab === 'history' && <HistoryScreen theme={theme} />}
        {tab === 'settings' && <SettingsScreen theme={theme} />}
      </View>
      <View style={[styles.tabBar, {backgroundColor: theme.surface, borderColor: theme.border}]}>
        {tabs.map(item => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{selected: active}}
              onPress={() => setTab(item.id)}
              style={styles.tab}>
              <Text style={[styles.tabGlyph, {color: active ? theme.primary : theme.textMuted}]}>{item.glyph}</Text>
              <Text style={[styles.tabLabel, {color: active ? theme.primary : theme.textMuted}]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Modal visible={Boolean(error)} transparent animationType="fade" onRequestClose={clearError}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.errorCard, {backgroundColor: theme.surface}]}>
            <Text style={[styles.errorTitle, {color: theme.text}]}>Couldn’t complete that action</Text>
            <Text style={[styles.errorBody, {color: theme.textMuted}]}>{error}</Text>
            <Pressable onPress={clearError} style={[styles.errorButton, {backgroundColor: theme.primary}]}>
              <Text style={styles.errorButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  content: {flex: 1},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18},
  brandMark: {width: 72, height: 72, borderRadius: 24, alignItems: 'center', justifyContent: 'center'},
  brandGlyph: {fontSize: 34, color: '#FFFFFF', fontWeight: '900'},
  loadingText: {fontSize: 15},
  tabBar: {minHeight: 74, flexDirection: 'row', borderTopWidth: 1, paddingBottom: 8, paddingTop: 7},
  tab: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2},
  tabGlyph: {fontSize: 21, fontWeight: '700'},
  tabLabel: {fontSize: 11, fontWeight: '600'},
  modalBackdrop: {flex: 1, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center', padding: 24},
  errorCard: {width: '100%', borderRadius: 24, padding: 22},
  errorTitle: {fontSize: 19, fontWeight: '700', marginBottom: 8},
  errorBody: {fontSize: 15, lineHeight: 22, marginBottom: 20},
  errorButton: {borderRadius: 14, padding: 14, alignItems: 'center'},
  errorButtonText: {color: '#FFFFFF', fontWeight: '700'},
});
