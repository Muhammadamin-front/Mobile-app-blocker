import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {useAppStore} from '../state/AppStore';
import {spacing, Theme} from '../theme/theme';
import {Card, PrimaryButton, StatusBadge} from './components';

/** Vendors whose task killers were seen (or are known) to end background apps. */
const AGGRESSIVE_VENDORS = ['oneplus', 'xiaomi', 'redmi', 'poco', 'oppo', 'realme', 'vivo', 'huawei', 'honor', 'samsung'];

/**
 * Battery optimisation is the difference between a session that holds and one a
 * vendor task killer quietly ends. The app cannot exempt itself, so it says why and
 * opens the screen where the user can.
 */
export function BatteryCard({theme}: {theme: Theme}) {
  const {permission, openBatterySettings, t} = useAppStore();
  const ok = permission.batteryUnrestricted;
  const vendor = permission.manufacturer;
  const aggressive = AGGRESSIVE_VENDORS.some(name => vendor.includes(name));

  return (
    <Card theme={theme} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={[styles.title, {color: theme.text}]}>{t('Battery optimisation')}</Text>
          <Text style={[styles.body, {color: theme.textMuted}]}>
            {ok
              ? t('Qoriqchi is exempt, so the phone will not end a session to save power.')
              : t('Some phones end background apps to save power, which stops blocking mid-session. Exempt Qoriqchi to prevent it.')}
          </Text>
        </View>
        <StatusBadge
          label={ok ? t('Exempt') : t('Recommended')}
          theme={theme}
          tone={ok ? 'success' : 'warning'}
        />
      </View>
      {aggressive ? (
        <Text style={[styles.tip, {color: theme.textMuted}]}>
          {t('On this phone, also lock Qoriqchi in recent apps (long-press its card → lock) so "Close all" leaves it running.')}
        </Text>
      ) : null}
      {ok ? null : (
        <PrimaryButton
          label={t('Open battery settings')}
          onPress={openBatterySettings}
          theme={theme}
          variant="secondary"
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {gap: spacing.md, marginTop: spacing.sm},
  header: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm},
  copy: {flex: 1},
  title: {fontSize: 15, fontWeight: '700'},
  body: {fontSize: 12.5, lineHeight: 18, marginTop: 3},
  tip: {fontSize: 12, lineHeight: 17},
});
