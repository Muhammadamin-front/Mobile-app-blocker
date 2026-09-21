import React, {useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {ThemePreference} from '../../domain/models';
import {LANGUAGE_OPTIONS} from '../../i18n';
import {useAppStore} from '../../state/AppStore';
import {radii, spacing, Theme} from '../../theme/theme';
import {BrandMark, Card, PrimaryButton, ScreenHeader, SectionTitle, StatusBadge} from '../components';

const themeOptions: Array<{value: ThemePreference; label: string; glyph: string}> = [
  {value: 'system', label: 'Auto', glyph: 'A'},
  {value: 'light', label: 'Navy', glyph: '◆'},
  {value: 'dark', label: 'Black', glyph: '●'},
];

export function SettingsScreen({theme}: {theme: Theme}) {
  const {
    busy,
    permission,
    refresh,
    openPermissionSettings,
    openUsageAccessSettings,
    themePreference,
    setTheme,
    language,
    setLanguage,
    resetAllData,
    t,
  } = useAppStore();
  const [showDisclosure, setShowDisclosure] = useState(false);

  const confirmReset = () => Alert.alert(
    t('Reset local data?'),
    'This ends any focus session and permanently removes selections, history, and statistics from this device.',
    [{text: t('Cancel'), style: 'cancel'}, {text: t('Reset'), style: 'destructive', onPress: resetAllData}],
  );

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      <ScreenHeader
        theme={theme}
        eyebrow={t('PREFERENCES')}
        title={t('Make it yours.')}
        subtitle={t('Manage protection, appearance, and the data that stays on this device.')}
      />

      <SectionTitle theme={theme}>{t('Protection')}</SectionTitle>
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
            <Text style={[styles.permissionTitle, {color: theme.text}]}>{t('App blocking service')}</Text>
            <Text style={[styles.permissionBody, {color: theme.textMuted}]}>
              {permission.accessibilityEnabled
                ? t('Ready to protect your focus sessions.')
                : t('Enable access before starting a session.')}
            </Text>
          </View>
          <StatusBadge
            label={permission.accessibilityEnabled ? t('Ready') : t('Action needed')}
            theme={theme}
            tone={permission.accessibilityEnabled ? 'success' : 'warning'}
          />
        </View>
        <View style={[styles.divider, {backgroundColor: theme.border}]} />
        <PrimaryButton
          label={permission.accessibilityEnabled ? t('Open Android settings') : t('Enable protection')}
          onPress={openPermissionSettings}
          theme={theme}
          variant={permission.accessibilityEnabled ? 'secondary' : 'primary'}
        />
        <Pressable accessibilityRole="button" onPress={refresh} style={styles.recheckButton}>
          <Text style={[styles.recheckText, {color: theme.textMuted}]}>{t('Recheck permission status')}</Text>
        </Pressable>
      </Card>

      <Card theme={theme} style={styles.optionalCard}>
        <View style={styles.optionalHeader}>
          <View style={styles.permissionCopy}>
            <Text style={[styles.permissionTitle, {color: theme.text}]}>{t('Screen time (optional)')}</Text>
            <Text style={[styles.permissionBody, {color: theme.textMuted}]}>
              {permission.usageAccessEnabled
                ? t('Progress shows which apps held your attention.')
                : t('Off. Blocking works exactly the same without it.')}
            </Text>
          </View>
          <StatusBadge
            label={permission.usageAccessEnabled ? t('On') : t('Off')}
            theme={theme}
            tone={permission.usageAccessEnabled ? 'success' : 'neutral'}
          />
        </View>
        <PrimaryButton
          label={permission.usageAccessEnabled ? t('Manage usage access') : t('Turn on screen time')}
          onPress={openUsageAccessSettings}
          theme={theme}
          variant="secondary"
        />
      </Card>

      <SectionTitle theme={theme}>{t('Appearance')}</SectionTitle>
      <Card theme={theme} style={styles.appearanceCard}>
        <Text style={[styles.controlLabel, {color: theme.text}]}>{t('Color mode')}</Text>
        <Text style={[styles.controlHint, {color: theme.textMuted}]}>{t('Follow your phone or choose navy or black glass.')}</Text>
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
                <Text style={[styles.segmentLabel, {color: active ? theme.text : theme.textMuted}, active && styles.segmentLabelActive]}>{t(option.label)}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card theme={theme} style={styles.appearanceCard}>
        <Text style={[styles.controlLabel, {color: theme.text}]}>{t('Language')}</Text>
        <Text style={[styles.controlHint, {color: theme.textMuted}]}>{t('Follow your phone or pick a language.')}</Text>
        <View style={[styles.segmented, {backgroundColor: theme.surfaceMuted}]}>
          {LANGUAGE_OPTIONS.map(option => {
            const active = language === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{checked: active}}
                onPress={() => setLanguage(option.value)}
                style={[
                  styles.segment,
                  active && {
                    backgroundColor: theme.surfaceRaised,
                    borderColor: theme.border,
                    shadowColor: theme.shadow,
                  },
                ]}>
                <Text
                  style={[
                    styles.segmentLabel,
                    {color: active ? theme.text : theme.textMuted},
                    active && styles.segmentLabelActive,
                  ]}>
                  {t(option.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <SectionTitle theme={theme}>{t('Privacy & data')}</SectionTitle>
      <Card theme={theme} style={styles.privacyCard}>
        <View style={styles.offlineRow}>
          <View style={[styles.offlineIcon, {backgroundColor: theme.successSoft}]}>
            <Text style={[styles.offlineGlyph, {color: theme.success}]}>✓</Text>
          </View>
          <View style={styles.offlineCopy}>
            <Text style={[styles.rowTitle, {color: theme.text}]}>{t('Private by default')}</Text>
            <Text style={[styles.rowBody, {color: theme.textMuted}]}>{t('No account, cloud sync, ads, or analytics.')}</Text>
          </View>
        </View>
        <View style={[styles.divider, {backgroundColor: theme.border}]} />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{expanded: showDisclosure}}
          onPress={() => setShowDisclosure(value => !value)}
          style={styles.disclosureHeader}>
          <View>
            <Text style={[styles.rowTitle, {color: theme.text}]}>{t('Accessibility disclosure')}</Text>
            <Text style={[styles.rowBody, {color: theme.textMuted}]}>{t('Review exactly what Qoriqchi can access')}</Text>
          </View>
          <Text style={[styles.disclosureChevron, {color: theme.textSubtle}]}>{showDisclosure ? '⌃' : '⌄'}</Text>
        </Pressable>
        {showDisclosure ? (
          <View style={[styles.disclosureBody, {backgroundColor: theme.surfaceMuted}]}>
            <Text style={[styles.disclosureText, {color: theme.textMuted}]}>
              Qoriqchi reads only package names from window-change events to compare them with your local block list. It does not inspect screen content, type, tap, collect, sell, share, or transmit data. All records remain in the app’s private local database.
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
            <Text style={[styles.resetTitle, {color: theme.danger}]}>{t('Reset local data')}</Text>
            <Text style={[styles.resetBody, {color: theme.textMuted}]}>{t('Selections, sessions, and statistics')}</Text>
          </View>
          <Text style={[styles.resetChevron, {color: theme.danger}]}>›</Text>
        </Pressable>
      </Card>

      <View style={styles.footer}>
        <BrandMark theme={theme} size={38} />
        <Text style={[styles.footerTitle, {color: theme.text}]}>Qoriqchi</Text>
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
  optionalCard: {marginTop: spacing.sm, gap: spacing.md},
  optionalHeader: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
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
