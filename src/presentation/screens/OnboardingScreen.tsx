import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useAppStore} from '../../state/AppStore';
import {Theme} from '../../theme/theme';
import {Card, PrimaryButton} from '../components';

export function OnboardingScreen({theme}: {theme: Theme}) {
  const {
    busy,
    permission,
    completeOnboarding,
    openPermissionSettings,
    refresh,
  } = useAppStore();
  const [accepted, setAccepted] = useState(false);

  const finish = async () => {
    await refresh();
    await completeOnboarding();
  };

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.background}]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.logo, {backgroundColor: theme.primary}]}><Text style={styles.logoText}>F</Text></View>
        <Text style={[styles.eyebrow, {color: theme.primary}]}>FOCUSGUARD</Text>
        <Text style={[styles.title, {color: theme.text}]}>Protect time for what matters.</Text>
        <Text style={[styles.subtitle, {color: theme.textMuted}]}>
          Choose distracting apps, set a duration, and keep your focus session entirely on this device.
        </Text>

        <Card theme={theme}>
          <Text style={[styles.cardTitle, {color: theme.text}]}>Why Accessibility access is needed</Text>
          <Text style={[styles.cardBody, {color: theme.textMuted}]}>
            FocusGuard uses Android Accessibility events only to read the package name of the app that appears on screen. If it matches your active block list, FocusGuard opens its block screen.
          </Text>
          <Text style={[styles.cardBody, {color: theme.textMuted}]}>
            It does not read screen text, taps, passwords, messages, or content. App names, sessions, and blocked-open attempts stay locally on your phone and are never transmitted or shared.
          </Text>
        </Card>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{checked: accepted}}
          onPress={() => setAccepted(value => !value)}
          style={styles.consentRow}>
          {/* eslint-disable-next-line react-native/no-inline-styles */}
          <View style={[styles.checkbox, {borderColor: theme.primary, backgroundColor: accepted ? theme.primary : 'transparent'}]}>
            {accepted && <Text style={styles.check}>✓</Text>}
          </View>
          <Text style={[styles.consentText, {color: theme.text}]}>I understand and consent to this limited Accessibility use.</Text>
        </Pressable>

        {permission.accessibilityEnabled ? (
          <View style={[styles.enabledBadge, {backgroundColor: theme.primarySoft}]}>
            <Text style={[styles.enabledText, {color: theme.success}]}>✓ Accessibility service enabled</Text>
          </View>
        ) : (
          <PrimaryButton label="Open Accessibility settings" onPress={openPermissionSettings} disabled={!accepted} />
        )}
        <PrimaryButton
          label={permission.accessibilityEnabled ? 'Continue' : 'Check access and continue'}
          onPress={finish}
          disabled={!accepted || !permission.accessibilityEnabled}
          loading={busy}
        />
        <Text style={[styles.note, {color: theme.textMuted}]}>
          Android always lets you disable this service or uninstall FocusGuard. FocusGuard does not prevent either action.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  content: {padding: 24, paddingBottom: 40},
  logo: {width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 24},
  logoText: {fontSize: 30, color: '#FFFFFF', fontWeight: '900'},
  eyebrow: {fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 10},
  title: {fontSize: 36, lineHeight: 42, fontWeight: '800', letterSpacing: -1, marginBottom: 12},
  subtitle: {fontSize: 17, lineHeight: 25, marginBottom: 24},
  cardTitle: {fontSize: 18, fontWeight: '700', marginBottom: 10},
  cardBody: {fontSize: 14, lineHeight: 21, marginBottom: 10},
  consentRow: {flexDirection: 'row', alignItems: 'flex-start', marginVertical: 22},
  checkbox: {width: 25, height: 25, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 1},
  check: {color: '#FFFFFF', fontWeight: '900'},
  consentText: {flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '600'},
  enabledBadge: {borderRadius: 14, padding: 14, alignItems: 'center', marginBottom: 12},
  enabledText: {fontWeight: '700'},
  note: {fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 18},
});
