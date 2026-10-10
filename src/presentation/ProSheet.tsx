import React, {useState} from 'react';
import {Modal, ScrollView, StyleSheet, Text, View} from 'react-native';

import {useAppStore} from '../state/AppStore';
import {radii, spacing, Theme} from '../theme/theme';
import {BrandMark, PrimaryButton} from './components';

/** The small marker on a control that needs Pro. */
export function ProPill({theme}: {theme: Theme}) {
  return (
    <View style={[styles.pill, {backgroundColor: theme.primary}]}>
      <Text style={[styles.pillText, {color: theme.inverseText}]}>PRO</Text>
    </View>
  );
}

/**
 * The one place Pro is sold. It says exactly what the money buys — strict sessions —
 * and what it cannot buy: Android always lets the owner turn the service off, and
 * Qoriqchi records that rather than pretending otherwise.
 */
export function ProSheet({
  theme,
  visible,
  onClose,
  onUnlocked,
}: {
  theme: Theme;
  visible: boolean;
  onClose(): void;
  onUnlocked?(): void;
}) {
  const {pro, buyPro, refresh, t} = useAppStore();
  const [buying, setBuying] = useState(false);

  const buy = async () => {
    setBuying(true);
    const unlocked = await buyPro();
    setBuying(false);
    if (unlocked) {
      onUnlocked?.();
      onClose();
    }
  };

  const points = [
    t('Strict sessions: no Stop button until the timer runs out.'),
    t('Strict schedules: lessons and homework start locked on their own.'),
    t('One payment, not a subscription. It stays with your Google account.'),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, {backgroundColor: theme.overlay}]}>
        <View style={[styles.sheet, {backgroundColor: theme.surfaceRaised, borderColor: theme.border}]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.head}>
              <BrandMark theme={theme} size={44} />
              <View style={styles.headCopy}>
                <Text style={[styles.title, {color: theme.text}]}>Qoriqchi Pro</Text>
                <Text style={[styles.subtitle, {color: theme.textMuted}]}>
                  {t('For the hours you cannot afford to lose.')}
                </Text>
              </View>
            </View>

            {points.map(point => (
              <View key={point} style={styles.point}>
                <View style={[styles.tick, {backgroundColor: theme.primarySoft}]}>
                  <Text style={[styles.tickText, {color: theme.primary}]}>✓</Text>
                </View>
                <Text style={[styles.pointText, {color: theme.text}]}>{point}</Text>
              </View>
            ))}

            <Text style={[styles.honest, {color: theme.textMuted, backgroundColor: theme.surfaceMuted}]}>
              {t(
                'Android always lets you turn off Accessibility or uninstall an app, and Qoriqchi never blocks that. If protection is turned off during a session, the session is recorded as broken.',
              )}
            </Text>

            {pro.pending ? (
              <Text style={[styles.note, {color: theme.warning}]}>
                {t('Payment pending. Pro unlocks as soon as Google Play confirms it.')}
              </Text>
            ) : null}
            {!pro.available ? (
              <Text style={[styles.note, {color: theme.textMuted}]}>
                {t('Pro can only be bought in the Google Play version of Qoriqchi.')}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <PrimaryButton
                label={pro.price ? t('Unlock Pro · {price}', {price: pro.price}) : t('Unlock Pro')}
                onPress={buy}
                theme={theme}
                disabled={!pro.available || pro.pending}
                loading={buying}
              />
              <PrimaryButton
                label={t('Restore purchase')}
                onPress={() => refresh()}
                theme={theme}
                variant="secondary"
              />
              <PrimaryButton label={t('Not now')} onPress={onClose} theme={theme} variant="ghost" />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pill: {borderRadius: radii.pill, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'center'},
  pillText: {fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8},
  backdrop: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg},
  sheet: {width: '100%', maxWidth: 440, maxHeight: '88%', borderWidth: 1, borderRadius: radii.xl, padding: spacing.xl},
  head: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg},
  headCopy: {flex: 1},
  title: {fontSize: 22, fontWeight: '800', letterSpacing: -0.4},
  subtitle: {fontSize: 13, lineHeight: 18, marginTop: 2},
  point: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm},
  tick: {width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  tickText: {fontSize: 12, fontWeight: '900'},
  pointText: {flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600'},
  honest: {fontSize: 12, lineHeight: 18, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.xs},
  note: {fontSize: 12.5, lineHeight: 18, marginTop: spacing.md},
  actions: {gap: spacing.sm, marginTop: spacing.lg},
});
