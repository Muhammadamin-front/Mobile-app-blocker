import React, {useCallback, useEffect, useState} from 'react';
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
  const {loading, error, clearError, onboardingCompleted, activeSession, t} = useAppStore();
  const [tab, setTab] = useState<Tab>('home');
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);
  const hasFocusBackdrop = tab === 'home' && Boolean(activeSession);

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
    return <IntroScreen ready={!loading} onDone={finishIntro} />;
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, {backgroundColor: theme.background}]}>
        <View style={[styles.loadingHalo, {backgroundColor: theme.primarySoft}]}>
          <BrandMark theme={theme} size={66} />
        </View>
        <ActivityIndicator color={theme.primary} size="small" />
        <View style={styles.loadingCopy}>
          <Text style={[styles.loadingTitle, {color: theme.text}]}>Qoriqchi</Text>
          <Text style={[styles.loadingText, {color: theme.textMuted}]}>{t('Preparing your focus space')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!onboardingCompleted) {
    return <OnboardingScreen theme={theme} />;
  }

  return (
    <SafeAreaView
      style={[
        styles.safe,
        {backgroundColor: hasFocusBackdrop ? theme.primaryStrong : theme.background},
      ]}
      edges={['top', 'left', 'right']}>
      <View
        pointerEvents="none"
        style={[
          styles.ambientNavy,
          {
            backgroundColor: hasFocusBackdrop ? '#FFE884' : theme.backgroundAccent,
            opacity: hasFocusBackdrop ? 0.48 : 0.55,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.ambientYellow,
          {backgroundColor: hasFocusBackdrop ? '#FFF2B2' : theme.primary},
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.ambientBottom,
          {backgroundColor: hasFocusBackdrop ? '#FFE06A' : theme.backgroundAccent},
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.ambientLine,
          {backgroundColor: hasFocusBackdrop ? theme.background : theme.primary},
        ]}
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
            borderColor: theme.borderStrong,
            marginBottom: Math.max(insets.bottom, spacing.sm),
            shadowColor: theme.glassShadow,
          },
        ]}>
        <View
          pointerEvents="none"
          style={[styles.tabBarSheen, {backgroundColor: theme.glassHighlight}]}
        />
        {tabs.map(item => {
          const active = tab === item.id;
          const color = active ? theme.primary : theme.textSubtle;
          const activeDotColor = active ? theme.primary : 'transparent';
          return (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityLabel={t(item.label)}
              accessibilityState={{selected: active}}
              android_ripple={{color: theme.primarySoft, borderless: true}}
              hitSlop={4}
              onPress={() => setTab(item.id)}
              style={({pressed}) => [styles.tab, pressed && styles.tabPressed]}>
              <View
                style={[
                  styles.tabIconWrap,
                  active && {
                    backgroundColor: theme.primary,
                    shadowColor: theme.primary,
                  },
                  active && styles.tabIconWrapActive,
                ]}>
                <NavIcon name={item.icon} color={active ? theme.inverseText : color} />
              </View>
              <Text style={[styles.tabLabel, {color}, active && styles.tabLabelActive]}>{t(item.label)}</Text>
              <View
                style={[
                  styles.activeDot,
                  {backgroundColor: activeDotColor},
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <Modal visible={Boolean(error)} transparent animationType="fade" onRequestClose={clearError}>
        <View style={[styles.modalBackdrop, {backgroundColor: theme.overlay}]}>
            <View
              style={[
                styles.errorCard,
              {backgroundColor: theme.surfaceRaised, borderColor: theme.borderStrong, shadowColor: theme.glassShadow},
              ]}>
            <View
              pointerEvents="none"
              style={[styles.modalSheen, {backgroundColor: theme.glassHighlight}]}
            />
            <View style={[styles.errorIcon, {backgroundColor: theme.dangerSoft}]}>
              <Text style={[styles.errorIconText, {color: theme.danger}]}>!</Text>
            </View>
            <Text style={[styles.errorTitle, {color: theme.text}]}>{t('That didn’t work')}</Text>
            <Text style={[styles.errorBody, {color: theme.textMuted}]}>{error}</Text>
            <PrimaryButton label={t('Got it')} onPress={clearError} theme={theme} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  content: {flex: 1, zIndex: 1},
  ambientNavy: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    top: -230,
    left: -190,
    opacity: 0.55,
  },
  ambientYellow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -125,
    right: -95,
    opacity: 0.11,
  },
  ambientBottom: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    bottom: -260,
    right: -190,
    opacity: 0.34,
  },
  ambientLine: {
    position: 'absolute',
    width: 260,
    height: 1,
    top: 158,
    right: -120,
    opacity: 0.16,
    transform: [{rotate: '-38deg'}],
  },
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg},
  loadingHalo: {width: 104, height: 104, borderRadius: 34, alignItems: 'center', justifyContent: 'center'},
  loadingCopy: {alignItems: 'center', gap: 4},
  loadingTitle: {fontSize: 21, fontWeight: '800', letterSpacing: -0.4},
  loadingText: {fontSize: 14},
  tabBar: {
    minHeight: 78,
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 28,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: 8,
    elevation: 18,
    shadowOffset: {width: 0, height: 16},
    shadowOpacity: 0.48,
    shadowRadius: 30,
    zIndex: 3,
    overflow: 'hidden',
  },
  tabBarSheen: {position: 'absolute', top: 0, left: 34, right: 34, height: 1},
  tab: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: radii.lg},
  tabPressed: {opacity: 0.68},
  tabIconWrap: {width: 44, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  tabIconWrapActive: {elevation: 5, shadowOffset: {width: 0, height: 5}, shadowOpacity: 0.3, shadowRadius: 10},
  tabLabel: {fontSize: 10, fontWeight: '600'},
  tabLabelActive: {fontWeight: '800'},
  activeDot: {width: 16, height: 2, borderRadius: 2, marginTop: 1},
  modalBackdrop: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl},
  errorCard: {width: '100%', maxWidth: 420, borderRadius: radii.xl, borderWidth: 1, padding: spacing.xl, elevation: 12, shadowOffset: {width: 0, height: 14}, shadowOpacity: 0.35, shadowRadius: 24, overflow: 'hidden'},
  modalSheen: {position: 'absolute', top: 0, left: 28, right: 28, height: 1},
  errorIcon: {width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md},
  errorIconText: {fontSize: 24, fontWeight: '800'},
  errorTitle: {fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: spacing.xs},
  errorBody: {fontSize: 15, lineHeight: 22, marginBottom: spacing.xl},
});
