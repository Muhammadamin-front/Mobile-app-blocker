import React, {useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {ThemePreference} from '../../domain/models';
import {useAppStore} from '../../state/AppStore';
import {Theme} from '../../theme/theme';
import {Card, PrimaryButton} from '../components';

export function SettingsScreen({theme}: {theme: Theme}) {
  const {busy, permission, refresh, openPermissionSettings, themePreference, setTheme, resetAllData} = useAppStore();
  const [showDisclosure, setShowDisclosure] = useState(false);

  const confirmReset = () => Alert.alert(
    'Reset local data?',
    'This ends any focus session and permanently removes selections, history, and statistics from this device.',
    [{text: 'Cancel', style: 'cancel'}, {text: 'Reset', style: 'destructive', onPress: resetAllData}],
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, {color: theme.text}]}>Settings</Text>
      <Text style={[styles.section, {color: theme.text}]}>Permissions</Text>
      <Card theme={theme} style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.dot, {backgroundColor: permission.accessibilityEnabled ? theme.success : theme.danger}]} />
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, {color: theme.text}]}>Accessibility service</Text>
            <Text style={[styles.rowBody, {color: theme.textMuted}]}>{permission.accessibilityEnabled ? 'Enabled and ready' : 'Disabled — blocking cannot run'}</Text>
          </View>
        </View>
        <View style={styles.buttonGap} />
        <PrimaryButton label={permission.accessibilityEnabled ? 'Open Android settings' : 'Grant access'} onPress={openPermissionSettings} />
        <Pressable onPress={refresh}><Text style={[styles.textButton, {color: theme.primary}]}>Recheck permission</Text></Pressable>
      </Card>

      <Text style={[styles.section, {color: theme.text}]}>Appearance</Text>
      <Card theme={theme} style={styles.themeCard}>
        {(['system', 'light', 'dark'] as ThemePreference[]).map(value => (
          <Pressable key={value} onPress={() => setTheme(value)} style={styles.themeOption}>
            <Text style={[styles.themeLabel, {color: theme.text}]}>{value[0].toUpperCase() + value.slice(1)}</Text>
            <View style={[styles.radio, {borderColor: themePreference === value ? theme.primary : theme.border}]}>{themePreference === value && <View style={[styles.radioFill, {backgroundColor: theme.primary}]} />}</View>
          </Pressable>
        ))}
      </Card>

      <Text style={[styles.section, {color: theme.text}]}>Privacy & data</Text>
      <Card theme={theme} style={styles.card}>
        <Pressable onPress={() => setShowDisclosure(value => !value)}>
          <Text style={[styles.rowTitle, {color: theme.text}]}>Accessibility disclosure</Text>
          <Text style={[styles.rowBody, {color: theme.textMuted}]}>{showDisclosure ? 'Hide details' : 'Review exactly what FocusGuard accesses'}</Text>
        </Pressable>
        {showDisclosure && <Text style={[styles.disclosure, {color: theme.textMuted}]}>FocusGuard reads only package names from window-change events to compare them with your local block list. It does not inspect screen content, type, tap, collect, sell, share, or transmit data. All records remain in the app’s private local database.</Text>}
        <View style={[styles.divider, {backgroundColor: theme.border}]} />
        <Pressable onPress={confirmReset} disabled={busy}><Text style={[styles.danger, {color: theme.danger}]}>Reset all local data</Text></Pressable>
      </Card>

      <Text style={[styles.version, {color: theme.textMuted}]}>FocusGuard 1.0 · Offline Android MVP</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {padding: 22, paddingBottom: 36},
  title: {fontSize: 32, fontWeight: '800', letterSpacing: -0.8, marginBottom: 25},
  section: {fontSize: 18, fontWeight: '700', marginBottom: 10, marginTop: 6},
  card: {marginBottom: 24},
  row: {flexDirection: 'row', alignItems: 'center'},
  dot: {width: 10, height: 10, borderRadius: 5, marginRight: 12},
  rowCopy: {flex: 1},
  rowTitle: {fontSize: 15, fontWeight: '700'},
  rowBody: {fontSize: 12, lineHeight: 18, marginTop: 3},
  buttonGap: {height: 17},
  textButton: {textAlign: 'center', fontWeight: '700', paddingTop: 16},
  themeCard: {paddingVertical: 5, marginBottom: 24},
  themeOption: {height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  themeLabel: {fontSize: 15, fontWeight: '600'},
  radio: {width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  radioFill: {width: 10, height: 10, borderRadius: 5},
  disclosure: {fontSize: 13, lineHeight: 20, marginTop: 14},
  divider: {height: StyleSheet.hairlineWidth, marginVertical: 18},
  danger: {fontSize: 15, fontWeight: '700'},
  version: {fontSize: 12, textAlign: 'center', marginTop: 6},
});
