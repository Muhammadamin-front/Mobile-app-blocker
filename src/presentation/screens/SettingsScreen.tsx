import React, {useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {ThemePreference} from '../../domain/models';
import {useAppStore} from '../../state/AppStore';
import {radii, spacing, Theme} from '../../theme/theme';
import {BrandMark, Card, PrimaryButton, ScreenHeader, SectionTitle, StatusBadge} from '../components';

const themeOptions: Array<{value: ThemePreference; label: string; glyph: string}> = [
  {value: 'system', label: 'Auto', glyph: 'A'},
  {value: 'light', label: 'Light', glyph: '☀'},
  {value: 'dark', label: 'Dark', glyph: '◐'},
];

export function SettingsScreen({theme}: {theme: Theme}) {
  const {
    busy,
    permission,
    refresh,
    openPermissionSettings,
    themePreference,
    setTheme,
    resetAllData,
  } = useAppStore();
  const [showDisclosure, setShowDisclosure] = useState(false);

  const confirmReset = () => Alert.alert(
    'Reset local data?',
    'This ends any focus session and permanently removes selections, history, and statistics from this device.',
    [{text: 'Cancel', style: 'cancel'}, {text: 'Reset', style: 'destructive', onPress: resetAllData}],
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      <ScreenHeader
        theme={theme}
        eyebrow="PREFERENCES"
        title="Make it yours."
        subtitle="Manage protection, appearance, and the data that stays on this device."
      />

      <SectionTitle theme={theme}>Protection</SectionTitle>
      <Card theme={theme} elevated style={styles.permissionCard}>
        <View style={styles.permissionHeader}>
          <View
            style={[
              styles.permissionIcon,
              {backgroundColor: permission.accessibilityEnabled ? theme.successSoft : theme.warningSoft},
            ]}>
            <View
              style={[
                styles.permissionRing,
                {borderColor: permission.accessibilityEnabled ? theme.success : theme.warning},
              ]}>
              <View
                style={[
                  styles.permissionDot,
                  {backgroundColor: permission.accessibilityEnabled ? theme.success : theme.warning},
                ]}
              />
            </View>
          </View>
          <View style={styles.permissionCopy}>
            <Text style={[styles.permissionTitle, {color: theme.text}]}>App blocking service</Text>
            <Text style={[styles.permissionBody, {color: theme.textMuted}]}>
              {permission.accessibilityEnabled
                ? 'Ready to protect your focus sessions.'
                : 'Enable access before starting a session.'}
            </Text>
          </View>
          <StatusBadge
            label={permission.accessibilityEnabled ? 'Ready' : 'Action needed'}
            theme={theme}
            tone={permission.accessibilityEnabled ? 'success' : 'warning'}
          />
        </View>
        <View style={[styles.divider, {backgroundColor: theme.border}]} />
        <PrimaryButton
          label={permission.accessibilityEnabled ? 'Open Android settings' : 'Enable protection'}
          onPress={openPermissionSettings}
          theme={theme}
          variant={permission.accessibilityEnabled ? 'secondary' : 'primary'}
        />
        <Pressable accessibilityRole="button" onPress={refresh} style={styles.recheckButton}>
          <Text style={[styles.recheckText, {color: theme.textMuted}]}>Recheck permission status</Text>
        </Pressable>
      </Card>

      <SectionTitle theme={theme}>Appearance</SectionTitle>
      <Card theme={theme} style={styles.appearanceCard}>
        <Text style={[styles.controlLabel, {color: theme.text}]}>Color mode</Text>
        <Text style={[styles.controlHint, {color: theme.textMuted}]}>Follow your phone or choose a fixed look.</Text>
        <View style={[styles.segmented, {backgroundColor: theme.surfaceMuted}]}>
          {themeOptions.map(option => {
            const active = themePreference === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{checked: active}}
                onPress={() => setTheme(option.value)}
                style={[
                  styles.segment,
                  active && {
                    backgroundColor: theme.surfaceRaised,
                    borderColor: theme.border,
                    shadowColor: theme.shadow,
                  },
                ]}>
                <Text style={[styles.segmentGlyph, {color: active ? theme.primary : theme.textSubtle}]}>{option.glyph}</Text>
                <Text style={[styles.segmentLabel, {color: active ? theme.text : theme.textMuted}, active && styles.segmentLabelActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <SectionTitle theme={theme}>Privacy & data</SectionTitle>
      <Card theme={theme} style={styles.privacyCard}>
        <View style={styles.offlineRow}>
          <View style={[styles.offlineIcon, {backgroundColor: theme.successSoft}]}>
            <Text style={[styles.offlineGlyph, {color: theme.success}]}>✓</Text>
          </View>
          <View style={styles.offlineCopy}>
            <Text style={[styles.rowTitle, {color: theme.text}]}>Private by default</Text>
            <Text style={[styles.rowBody, {color: theme.textMuted}]}>No account, cloud sync, ads, or analytics.</Text>
          </View>
        </View>
        <View style={[styles.divider, {backgroundColor: theme.border}]} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{expanded: showDisclosure}}
          onPress={() => setShowDisclosure(value => !value)}
          style={styles.disclosureHeader}>
          <View>
            <Text style={[styles.rowTitle, {color: theme.text}]}>Accessibility disclosure</Text>
            <Text style={[styles.rowBody, {color: theme.textMuted}]}>Review exactly what FocusGuard can access</Text>
          </View>
          <Text style={[styles.disclosureChevron, {color: theme.textSubtle}]}>{showDisclosure ? '⌃' : '⌄'}</Text>
        </Pressable>
        {showDisclosure ? (
          <View style={[styles.disclosureBody, {backgroundColor: theme.surfaceMuted}]}>
            <Text style={[styles.disclosureText, {color: theme.textMuted}]}>
              FocusGuard reads only package names from window-change events to compare them with your local block list. It does not inspect screen content, type, tap, collect, sell, share, or transmit data. All records remain in the app’s private local database.
            </Text>
          </View>
        ) : null}
        <View style={[styles.divider, {backgroundColor: theme.border}]} />
        <Pressable
          accessibilityRole="button"
          onPress={confirmReset}
          disabled={busy}
          style={[styles.resetRow, {backgroundColor: theme.dangerSoft}]}>
          <View>
            <Text style={[styles.resetTitle, {color: theme.danger}]}>Reset local data</Text>
            <Text style={[styles.resetBody, {color: theme.textMuted}]}>Selections, sessions, and statistics</Text>
          </View>
          <Text style={[styles.resetChevron, {color: theme.danger}]}>›</Text>
        </Pressable>
      </Card>

      <View style={styles.footer}>
        <BrandMark theme={theme} size={38} />
        <Text style={[styles.footerTitle, {color: theme.text}]}>FocusGuard</Text>
        <Text style={[styles.version, {color: theme.textSubtle}]}>Version 1.0 · Android · Offline</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl},
  permissionCard: {marginBottom: spacing.xl},
  permissionHeader: {flexDirection: 'row', alignItems: 'center'},
  permissionIcon: {width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center'},
  permissionRing: {width: 27, height: 27, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  permissionDot: {width: 8, height: 8, borderRadius: 4},
  permissionCopy: {flex: 1, marginHorizontal: spacing.sm},
  permissionTitle: {fontSize: 14, fontWeight: '700', marginBottom: 3},
  permissionBody: {fontSize: 11, lineHeight: 16},
  divider: {height: 1, marginVertical: spacing.lg},
  recheckButton: {alignSelf: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md},
  recheckText: {fontSize: 12, fontWeight: '700'},
  appearanceCard: {marginBottom: spacing.xl},
  controlLabel: {fontSize: 14, fontWeight: '700'},
  controlHint: {fontSize: 12, marginTop: 3, marginBottom: spacing.md},
  segmented: {height: 60, borderRadius: radii.md, flexDirection: 'row', padding: 5},
  segment: {flex: 1, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6},
  segmentGlyph: {fontSize: 13, fontWeight: '800'},
  segmentLabel: {fontSize: 12, fontWeight: '600'},
  segmentLabelActive: {fontWeight: '800'},
  privacyCard: {marginBottom: spacing.xl},
  offlineRow: {flexDirection: 'row', alignItems: 'center'},
  offlineIcon: {width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  offlineGlyph: {fontSize: 17, fontWeight: '900'},
  offlineCopy: {flex: 1, marginLeft: spacing.sm},
  rowTitle: {fontSize: 14, fontWeight: '700'},
  rowBody: {fontSize: 11, lineHeight: 16, marginTop: 3},
  disclosureHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  disclosureChevron: {fontSize: 20, fontWeight: '700'},
  disclosureBody: {borderRadius: radii.md, padding: spacing.md, marginTop: spacing.md},
  disclosureText: {fontSize: 12, lineHeight: 19},
  resetRow: {minHeight: 64, borderRadius: radii.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  resetTitle: {fontSize: 14, fontWeight: '700'},
  resetBody: {fontSize: 10.5, marginTop: 3},
  resetChevron: {fontSize: 27, fontWeight: '300'},
  footer: {alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.lg},
  footerTitle: {fontSize: 14, fontWeight: '800', marginTop: spacing.sm},
  version: {fontSize: 10.5, marginTop: 3},
});
