import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';

import {useAppStore} from '../state/AppStore';
import {darkTheme, lightTheme, radii, spacing} from '../theme/theme';
import {BrandMark, NavIcon, PrimaryButton} from './components';
import {AppsScreen} from './screens/AppsScreen';
import {HistoryScreen} from './screens/HistoryScreen';
import {HomeScreen} from './screens/HomeScreen';
import {IntroScreen} from './screens/IntroScreen';
import {OnboardingScreen} from './screens/OnboardingScreen';
import {SettingsScreen} from './screens/SettingsScreen';

type Tab = 'home' | 'apps' | 'history' | 'settings';

const tabs: Array<{id: Tab; label: string; icon: 'focus' | 'apps' | 'history' | 'settings'}> = [
  {id: 'home', label: 'Focus', icon: 'focus'},
  {id: 'apps', label: 'Apps', icon: 'apps'},
  {id: 'history', label: 'History', icon: 'history'},
  {id: 'settings', label: 'Settings', icon: 'settings'},
];

export function AppShell({isDark}: {isDark: boolean}) {
  const theme = isDark ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const {loading, error, clearError, onboardingCompleted} = useAppStore();
  const [tab, setTab] = useState<Tab>('home');
  const [introDone, setIntroDone] = useState(false);

  // System Back returns to Focus rather than dropping the user out of the app.
  useEffect(() => {
    if (tab === 'home') {
      return;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setTab('home');
      return true;
    });
    return () => subscription.remove();
  }, [tab]);

  if (!introDone) {
    return <IntroScreen theme={theme} onDone={() => setIntroDone(true)} />;
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, {backgroundColor: theme.background}]}>
        <View style={[styles.loadingHalo, {backgroundColor: theme.primarySoft}]}>
          <BrandMark theme={theme} size={66} />
        </View>
        <ActivityIndicator color={theme.primary} size="small" />
        <View style={styles.loadingCopy}>
          <Text style={[styles.loadingTitle, {color: theme.text}]}>FocusGuard</Text>
          <Text style={[styles.loadingText, {color: theme.textMuted}]}>Preparing your focus space</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!onboardingCompleted) {
    return <OnboardingScreen theme={theme} />;
  }

  return (
    <SafeAreaView
      style={[styles.safe, {backgroundColor: theme.background}]}
      edges={['top', 'left', 'right']}>
      <View
        pointerEvents="none"
        style={[styles.ambientGlow, {backgroundColor: theme.backgroundAccent}]}
      />
      <View style={styles.content}>
        {tab === 'home' && <HomeScreen theme={theme} onOpenApps={() => setTab('apps')} />}
        {tab === 'apps' && <AppsScreen theme={theme} />}
        {tab === 'history' && <HistoryScreen theme={theme} />}
        {tab === 'settings' && <SettingsScreen theme={theme} />}
      </View>

      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: theme.surfaceRaised,
            borderColor: theme.border,
            marginBottom: Math.max(insets.bottom, spacing.sm),
            shadowColor: theme.shadow,
          },
        ]}>
        {tabs.map(item => {
          const active = tab === item.id;
          const color = active ? theme.primary : theme.textSubtle;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{selected: active}}
              android_ripple={{color: theme.primarySoft, borderless: true}}
              hitSlop={4}
              onPress={() => setTab(item.id)}
              style={({pressed}) => [styles.tab, pressed && styles.tabPressed]}>
              <View
                style={[
                  styles.tabIconWrap,
                  active && {backgroundColor: theme.primarySoft},
                ]}>
                <NavIcon name={item.icon} color={color} />
              </View>
              <Text style={[styles.tabLabel, {color}, active && styles.tabLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Modal visible={Boolean(error)} transparent animationType="fade" onRequestClose={clearError}>
        <View style={[styles.modalBackdrop, {backgroundColor: theme.overlay}]}>
          <View
            style={[
              styles.errorCard,
              {backgroundColor: theme.surfaceRaised, borderColor: theme.border, shadowColor: theme.shadow},
            ]}>
            <View style={[styles.errorIcon, {backgroundColor: theme.dangerSoft}]}>
              <Text style={[styles.errorIconText, {color: theme.danger}]}>!</Text>
            </View>
            <Text style={[styles.errorTitle, {color: theme.text}]}>That didn’t work</Text>
            <Text style={[styles.errorBody, {color: theme.textMuted}]}>{error}</Text>
            <PrimaryButton label="Got it" onPress={clearError} theme={theme} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  content: {flex: 1, zIndex: 1},
  ambientGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -180,
    right: -120,
    opacity: 0.55,
  },
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg},
  loadingHalo: {width: 104, height: 104, borderRadius: 34, alignItems: 'center', justifyContent: 'center'},
  loadingCopy: {alignItems: 'center', gap: 4},
  loadingTitle: {fontSize: 21, fontWeight: '800', letterSpacing: -0.4},
  loadingText: {fontSize: 14},
  tabBar: {
    minHeight: 72,
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radii.xl,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: 7,
    elevation: 10,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.13,
    shadowRadius: 18,
    zIndex: 3,
  },
  tab: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: radii.lg},
  tabPressed: {opacity: 0.68},
  tabIconWrap: {width: 40, height: 34, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center'},
  tabLabel: {fontSize: 10, fontWeight: '600'},
  tabLabelActive: {fontWeight: '800'},
  modalBackdrop: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl},
  errorCard: {width: '100%', maxWidth: 420, borderRadius: radii.xl, borderWidth: 1, padding: spacing.xl, elevation: 12, shadowOffset: {width: 0, height: 14}, shadowOpacity: 0.24, shadowRadius: 24},
  errorIcon: {width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md},
  errorIconText: {fontSize: 24, fontWeight: '800'},
  errorTitle: {fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: spacing.xs},
  errorBody: {fontSize: 15, lineHeight: 22, marginBottom: spacing.xl},
});
