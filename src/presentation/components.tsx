import React, {PropsWithChildren} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import {InstalledApp} from '../domain/models';
import {radii, spacing, Theme} from '../theme/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function PrimaryButton({
  label,
  onPress,
  theme,
  disabled,
  loading,
  variant = 'primary',
  trailing,
}: {
  label: string;
  onPress(): void;
  theme: Theme;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  trailing?: string;
}) {
  const colors = {
    primary: {background: theme.primaryStrong, foreground: '#FFFFFF', border: theme.primaryStrong},
    secondary: {background: theme.primarySoft, foreground: theme.primary, border: theme.primarySoft},
    danger: {background: theme.dangerSoft, foreground: theme.danger, border: theme.dangerSoft},
    ghost: {background: 'transparent', foreground: theme.textMuted, border: theme.border},
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled: Boolean(disabled || loading)}}
      android_ripple={{color: `${colors.foreground}18`}}
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [
        styles.primaryButton,
        {backgroundColor: colors.background, borderColor: colors.border},
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.foreground} />
      ) : (
        <View style={styles.buttonContent}>
          <Text style={[styles.primaryLabel, {color: colors.foreground}]}>{label}</Text>
          {trailing ? <Text style={[styles.buttonTrailing, {color: colors.foreground}]}>{trailing}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  theme,
  style,
  elevated = false,
  tone = 'default',
}: PropsWithChildren<{
  theme: Theme;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  tone?: 'default' | 'muted' | 'accent';
}>) {
  const background = tone === 'muted'
    ? theme.surfaceMuted
    : tone === 'accent'
      ? theme.primarySoft
      : theme.surface;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: background,
          borderColor: tone === 'accent' ? `${theme.primary}2E` : theme.border,
          shadowColor: theme.shadow,
        },
        elevated && styles.cardElevated,
        style,
      ]}>
      {children}
    </View>
  );
}

export function BrandMark({theme, size = 54}: {theme: Theme; size?: number}) {
  return (
    <View
      accessibilityLabel="FocusGuard"
      style={[
        styles.brandMark,
        {width: size, height: size, borderRadius: size * 0.31, backgroundColor: theme.primaryStrong},
      ]}>
      <View
        style={[
          styles.brandOrbit,
          {
            width: size * 0.56,
            height: size * 0.56,
            borderRadius: size,
            borderWidth: Math.max(2, size * 0.065),
          },
        ]}>
        <View
          style={[
            styles.brandCore,
            {width: size * 0.16, height: size * 0.16, borderRadius: size},
          ]}
        />
      </View>
    </View>
  );
}

export function AppIcon({app, size = 46}: {app: InstalledApp; size?: number}) {
  if (app.iconBase64) {
    return (
      <Image
        source={{uri: `data:image/png;base64,${app.iconBase64}`}}
        style={{width: size, height: size, borderRadius: size * 0.24}}
      />
    );
  }
  return (
    <View
      style={[
        styles.fallbackIcon,
        {width: size, height: size, borderRadius: size * 0.24},
      ]}>
      <Text style={[styles.fallbackIconText, {fontSize: size * 0.4}]}>
        {app.appName.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  theme,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  theme: Theme;
  eyebrow?: string;
}) {
  return (
    <View style={styles.screenHeader}>
      {eyebrow ? <Text style={[styles.eyebrow, {color: theme.primary}]}>{eyebrow}</Text> : null}
      <Text style={[styles.screenTitle, {color: theme.text}]}>{title}</Text>
      {subtitle ? <Text style={[styles.screenSubtitle, {color: theme.textMuted}]}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionTitle({
  children,
  theme,
  detail,
}: PropsWithChildren<{theme: Theme; detail?: string}>) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, {color: theme.text}]}>{children}</Text>
      {detail ? <Text style={[styles.sectionDetail, {color: theme.textSubtle}]}>{detail}</Text> : null}
    </View>
  );
}

export function StatusBadge({
  label,
  theme,
  tone = 'neutral',
}: {
  label: string;
  theme: Theme;
  tone?: 'neutral' | 'success' | 'warning' | 'primary' | 'danger';
}) {
  const palette = {
    neutral: [theme.surfaceMuted, theme.textMuted],
    success: [theme.successSoft, theme.success],
    warning: [theme.warningSoft, theme.warning],
    primary: [theme.primarySoft, theme.primary],
    danger: [theme.dangerSoft, theme.danger],
  }[tone];
  return (
    <View style={[styles.badge, {backgroundColor: palette[0]}]}>
      <View style={[styles.badgeDot, {backgroundColor: palette[1]}]} />
      <Text style={[styles.badgeText, {color: palette[1]}]}>{label}</Text>
    </View>
  );
}

export function NavIcon({
  name,
  color,
}: {
  name: 'focus' | 'apps' | 'history' | 'settings';
  color: string;
}) {
  if (name === 'focus') {
    return (
      <View style={[styles.focusIconOuter, {borderColor: color}]}>
        <View style={[styles.focusIconInner, {backgroundColor: color}]} />
      </View>
    );
  }
  if (name === 'apps') {
    return (
      <View style={styles.gridIcon}>
        {[0, 1, 2, 3].map(index => (
          <View key={index} style={[styles.gridSquare, {borderColor: color}]} />
        ))}
      </View>
    );
  }
  if (name === 'history') {
    return (
      <View style={[styles.clockIcon, {borderColor: color}]}>
        <View style={[styles.clockHandVertical, {backgroundColor: color}]} />
        <View style={[styles.clockHandHorizontal, {backgroundColor: color}]} />
      </View>
    );
  }
  return (
    <View style={styles.slidersIcon}>
      <View style={[styles.sliderLine, {backgroundColor: color}]}><View style={[styles.sliderKnob, styles.sliderKnobLeft, {backgroundColor: color}]} /></View>
      <View style={[styles.sliderLine, {backgroundColor: color}]}><View style={[styles.sliderKnob, styles.sliderKnobRight, {backgroundColor: color}]} /></View>
      <View style={[styles.sliderLine, {backgroundColor: color}]}><View style={[styles.sliderKnob, styles.sliderKnobMiddle, {backgroundColor: color}]} /></View>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  theme,
  symbol = '○',
}: {
  title: string;
  body: string;
  theme: Theme;
  symbol?: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptySymbol, {backgroundColor: theme.primarySoft}]}>
        <Text style={[styles.emptySymbolText, {color: theme.primary}]}>{symbol}</Text>
      </View>
      <Text style={[styles.emptyTitle, {color: theme.text}]}>{title}</Text>
      <Text style={[styles.emptyBody, {color: theme.textMuted}]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    minHeight: 58,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  primaryLabel: {fontSize: 16, fontWeight: '700', letterSpacing: 0.1},
  buttonContent: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  buttonTrailing: {fontSize: 20, fontWeight: '400', marginTop: -2},
  disabled: {opacity: 0.42},
  pressed: {transform: [{scale: 0.985}], opacity: 0.92},
  card: {borderRadius: radii.lg, borderWidth: 1, padding: spacing.lg},
  cardElevated: {
    elevation: 3,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  brandMark: {alignItems: 'center', justifyContent: 'center'},
  brandOrbit: {borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center'},
  brandCore: {backgroundColor: '#FFFFFF'},
  fallbackIcon: {backgroundColor: '#6758E7', alignItems: 'center', justifyContent: 'center'},
  fallbackIconText: {color: '#FFFFFF', fontWeight: '800'},
  screenHeader: {marginBottom: spacing.xl},
  eyebrow: {fontSize: 11, fontWeight: '800', letterSpacing: 2.1, marginBottom: spacing.xs},
  screenTitle: {fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1.1},
  screenSubtitle: {fontSize: 15, lineHeight: 22, marginTop: spacing.xs, maxWidth: 340},
  sectionHeading: {flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.sm},
  sectionTitle: {fontSize: 18, fontWeight: '700', letterSpacing: -0.25},
  sectionDetail: {fontSize: 12, fontWeight: '600'},
  badge: {alignSelf: 'flex-start', borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6},
  badgeDot: {width: 6, height: 6, borderRadius: 3},
  badgeText: {fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase'},
  focusIconOuter: {width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center'},
  focusIconInner: {width: 7, height: 7, borderRadius: 4},
  gridIcon: {width: 22, height: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 4},
  gridSquare: {width: 9, height: 9, borderRadius: 3, borderWidth: 1.8},
  clockIcon: {width: 22, height: 22, borderRadius: 11, borderWidth: 1.8, position: 'relative'},
  clockHandVertical: {position: 'absolute', width: 1.8, height: 6, left: 9.2, top: 4.5, borderRadius: 2},
  clockHandHorizontal: {position: 'absolute', width: 5, height: 1.8, left: 9.2, top: 9.5, borderRadius: 2, transform: [{rotate: '25deg'}]},
  slidersIcon: {width: 23, height: 22, justifyContent: 'space-around', paddingVertical: 2},
  sliderLine: {height: 1.8, borderRadius: 2, position: 'relative'},
  sliderKnob: {position: 'absolute', width: 6, height: 6, borderRadius: 3, top: -2.1, borderWidth: 1.5, borderColor: '#FFFFFF'},
  sliderKnobLeft: {left: 3},
  sliderKnobRight: {right: 3},
  sliderKnobMiddle: {left: 9},
  emptyState: {alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg},
  emptySymbol: {width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md},
  emptySymbolText: {fontSize: 27, fontWeight: '700'},
  emptyTitle: {fontSize: 17, fontWeight: '700', marginBottom: 6, textAlign: 'center'},
  emptyBody: {fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 260},
});
