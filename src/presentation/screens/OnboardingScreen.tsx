import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useAppStore} from '../../state/AppStore';
import {radii, spacing, Theme} from '../../theme/theme';
import {BrandMark, Card, PrimaryButton, StatusBadge} from '../components';

const trustPoints = [
  {glyph: '⌁', title: 'Works offline', body: 'No account or connection'},
  {glyph: '□', title: 'Stays local', body: 'Data never leaves your phone'},
  {glyph: '◉', title: 'You stay in control', body: 'Disable access at any time'},
];

export function OnboardingScreen({theme}: {theme: Theme}) {
  const {
    busy,
    permission,
    completeOnboarding,
    openPermissionSettings,
    refresh,
  } = useAppStore();
  const [accepted, setAccepted] = useState(false);
  const checkboxColors = {
    borderColor: accepted ? theme.primary : theme.borderStrong,
    backgroundColor: accepted ? theme.primary : 'transparent',
  };

  const finish = async () => {
    await refresh();
    await completeOnboarding();
  };

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.background}]}>
      <View
        pointerEvents="none"
        style={[styles.ambientGlow, {backgroundColor: theme.backgroundAccent}]}
      />
      <View
        pointerEvents="none"
        style={[styles.yellowGlow, {backgroundColor: theme.primary}]}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        <View style={styles.brandRow}>
          <BrandMark theme={theme} size={46} />
          <Text style={[styles.brandName, {color: theme.text}]}>FocusGuard</Text>
          <StatusBadge label="Offline" theme={theme} tone="success" />
        </View>

        <View style={styles.hero}>
          <View style={[styles.heroHalo, {backgroundColor: theme.primarySoft}]}>
            <View style={[styles.heroOrbitLarge, {borderColor: `${theme.primary}28`}]}>
              <View style={[styles.heroOrbit, {borderColor: theme.primary}]}>
                <View style={[styles.heroCore, {backgroundColor: theme.primary}]} />
              </View>
            </View>
          </View>
          <Text style={[styles.eyebrow, {color: theme.primary}]}>WELCOME TO QUIETER TIME</Text>
          <Text style={[styles.title, {color: theme.text}]}>Focus without fighting yourself.</Text>
          <Text style={[styles.subtitle, {color: theme.textMuted}]}>
            Choose distracting apps, set a boundary, and let FocusGuard protect the time you meant to keep.
          </Text>
        </View>

        <View style={styles.trustGrid}>
          {trustPoints.map(point => (
            <View key={point.title} style={[styles.trustItem, {backgroundColor: theme.surface, borderColor: theme.border}]}>
              <View style={[styles.trustIcon, {backgroundColor: theme.primarySoft}]}>
                <Text style={[styles.trustGlyph, {color: theme.primary}]}>{point.glyph}</Text>
              </View>
              <Text style={[styles.trustTitle, {color: theme.text}]}>{point.title}</Text>
              <Text style={[styles.trustBody, {color: theme.textMuted}]}>{point.body}</Text>
            </View>
          ))}
        </View>

        <View style={styles.stepRow}>
          <View style={[styles.stepNumber, {backgroundColor: theme.primary}]}>
            <Text style={[styles.stepNumberText, {color: theme.inverseText}]}>1</Text>
          </View>
          <View>
            <Text style={[styles.stepTitle, {color: theme.text}]}>Enable focused protection</Text>
            <Text style={[styles.stepSubtitle, {color: theme.textMuted}]}>One permission, explained clearly</Text>
          </View>
        </View>

        <Card theme={theme} elevated style={styles.disclosureCard}>
          <View style={styles.disclosureHeader}>
            <View style={[styles.shieldIcon, {backgroundColor: theme.warningSoft}]}>
              <View style={[styles.shieldShape, {borderColor: theme.warning}]}>
                <View style={[styles.shieldDot, {backgroundColor: theme.warning}]} />
              </View>
            </View>
            <View style={styles.disclosureHeaderCopy}>
              <Text style={[styles.cardEyebrow, {color: theme.warning}]}>ACCESSIBILITY DISCLOSURE</Text>
              <Text style={[styles.cardTitle, {color: theme.text}]}>Why this access is required</Text>
            </View>
          </View>
          <Text style={[styles.cardBody, {color: theme.textMuted}]}>
            FocusGuard uses Android Accessibility events only to read the package name of the app that appears on screen. If it matches your active block list, FocusGuard opens its block screen.
          </Text>
          <View style={[styles.privacyNote, {backgroundColor: theme.surfaceMuted}]}>
            <View style={[styles.privacyDot, {backgroundColor: theme.success}]} />
            <Text style={[styles.privacyText, {color: theme.textMuted}]}>
              It does not read screen text, taps, passwords, messages, or content. App names, sessions, and blocked-open attempts stay locally on your phone and are never transmitted or shared.
            </Text>
          </View>
        </Card>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{checked: accepted}}
          onPress={() => setAccepted(value => !value)}
          style={[
            styles.consentRow,
            {
              backgroundColor: accepted ? theme.primarySoft : theme.surface,
              borderColor: accepted ? `${theme.primary}50` : theme.border,
            },
          ]}>
          <View
            style={[
              styles.checkbox,
              checkboxColors,
            ]}>
            {accepted ? <Text style={[styles.check, {color: theme.inverseText}]}>✓</Text> : null}
          </View>
          <Text style={[styles.consentText, {color: theme.text}]}>
            I understand and consent to this limited Accessibility use.
          </Text>
        </Pressable>

        {permission.accessibilityEnabled ? (
          <View style={[styles.enabledBadge, {backgroundColor: theme.successSoft}]}>
            <View style={[styles.enabledDot, {backgroundColor: theme.success}]} />
            <Text style={[styles.enabledText, {color: theme.success}]}>Accessibility service enabled</Text>
          </View>
        ) : (
          <PrimaryButton
            label="Open Accessibility settings"
            trailing="→"
            onPress={openPermissionSettings}
            theme={theme}
            disabled={!accepted}
          />
        )}

        <View style={styles.buttonSpacer} />
        <PrimaryButton
          label="Enter FocusGuard"
          onPress={finish}
          theme={theme}
          variant={permission.accessibilityEnabled ? 'primary' : 'secondary'}
          disabled={!accepted || !permission.accessibilityEnabled}
          loading={busy}
        />
        <Text style={[styles.note, {color: theme.textSubtle}]}>
          Android always lets you disable this service or uninstall FocusGuard. FocusGuard never prevents either action.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1},
  ambientGlow: {position: 'absolute', width: 430, height: 430, borderRadius: 215, top: -250, left: -210, opacity: 0.72},
  yellowGlow: {position: 'absolute', width: 190, height: 190, borderRadius: 95, top: -110, right: -90, opacity: 0.16},
  content: {paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxxl},
  brandRow: {flexDirection: 'row', alignItems: 'center'},
  brandName: {fontSize: 16, fontWeight: '800', letterSpacing: -0.3, flex: 1, marginLeft: spacing.sm},
  hero: {alignItems: 'center', paddingTop: spacing.xxl, paddingBottom: spacing.xl},
  heroHalo: {width: 142, height: 142, borderRadius: 46, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl, transform: [{rotate: '8deg'}]},
  heroOrbitLarge: {width: 104, height: 104, borderRadius: 52, borderWidth: 10, alignItems: 'center', justifyContent: 'center', transform: [{rotate: '-8deg'}]},
  heroOrbit: {width: 68, height: 68, borderRadius: 34, borderWidth: 5, alignItems: 'center', justifyContent: 'center'},
  heroCore: {width: 20, height: 20, borderRadius: 10},
  eyebrow: {fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: spacing.sm},
  title: {fontSize: 36, lineHeight: 41, fontWeight: '800', letterSpacing: -1.25, textAlign: 'center'},
  subtitle: {fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: spacing.sm, maxWidth: 350},
  trustGrid: {flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xxl},
  trustItem: {flex: 1, minHeight: 126, borderWidth: 1, borderRadius: radii.md, padding: spacing.sm},
  trustIcon: {width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm},
  trustGlyph: {fontSize: 14, fontWeight: '800'},
  trustTitle: {fontSize: 11, fontWeight: '800', marginBottom: 4},
  trustBody: {fontSize: 9.5, lineHeight: 14},
  stepRow: {flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md},
  stepNumber: {width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm},
  stepNumberText: {fontSize: 13, fontWeight: '800'},
  stepTitle: {fontSize: 15, fontWeight: '700'},
  stepSubtitle: {fontSize: 11, marginTop: 2},
  disclosureCard: {marginBottom: spacing.md},
  disclosureHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md},
  shieldIcon: {width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center'},
  shieldShape: {width: 25, height: 29, borderWidth: 2, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, alignItems: 'center', justifyContent: 'center'},
  shieldDot: {width: 7, height: 7, borderRadius: 4},
  disclosureHeaderCopy: {flex: 1, marginLeft: spacing.sm},
  cardEyebrow: {fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginBottom: 3},
  cardTitle: {fontSize: 17, fontWeight: '700'},
  cardBody: {fontSize: 13, lineHeight: 20},
  privacyNote: {borderRadius: radii.md, padding: spacing.md, marginTop: spacing.md, flexDirection: 'row', alignItems: 'flex-start'},
  privacyDot: {width: 8, height: 8, borderRadius: 4, marginTop: 5, marginRight: spacing.sm},
  privacyText: {flex: 1, fontSize: 11.5, lineHeight: 18},
  consentRow: {minHeight: 72, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: spacing.md, marginBottom: spacing.md},
  checkbox: {width: 26, height: 26, borderRadius: 9, borderWidth: 1.8, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm},
  check: {fontWeight: '900'},
  consentText: {flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600'},
  enabledBadge: {minHeight: 54, borderRadius: radii.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'},
  enabledDot: {width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs},
  enabledText: {fontSize: 13, fontWeight: '700'},
  buttonSpacer: {height: spacing.sm},
  note: {fontSize: 10.5, lineHeight: 16, textAlign: 'center', marginTop: spacing.md, paddingHorizontal: spacing.sm},
});
