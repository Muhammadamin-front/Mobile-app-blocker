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
import {Theme} from '../theme/theme';

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  destructive,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled: Boolean(disabled || loading)}}
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [
        styles.primaryButton,
        destructive && styles.destructiveButton,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.primaryLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  theme,
  style,
}: PropsWithChildren<{theme: Theme; style?: StyleProp<ViewStyle>}>) {
  return (
    <View
      style={[
        styles.card,
        {backgroundColor: theme.surface, borderColor: theme.border},
        style,
      ]}>
      {children}
    </View>
  );
}

export function AppIcon({app, size = 44}: {app: InstalledApp; size?: number}) {
  if (app.iconBase64) {
    return (
      <Image
        source={{uri: `data:image/png;base64,${app.iconBase64}`}}
        style={{width: size, height: size, borderRadius: size * 0.22}}
      />
    );
  }
  return (
    <View
      style={[
        styles.fallbackIcon,
        {width: size, height: size, borderRadius: size * 0.22},
      ]}>
      <Text style={[styles.fallbackIconText, {fontSize: size * 0.42}]}>
        {app.appName.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

export function SectionTitle({children, theme}: PropsWithChildren<{theme: Theme}>) {
  return <Text style={[styles.sectionTitle, {color: theme.text}]}>{children}</Text>;
}

const styles = StyleSheet.create({
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B5CE2',
    paddingHorizontal: 22,
  },
  destructiveButton: {backgroundColor: '#B73745'},
  primaryLabel: {color: '#FFFFFF', fontSize: 17, fontWeight: '700'},
  disabled: {opacity: 0.45},
  pressed: {transform: [{scale: 0.985}], opacity: 0.9},
  card: {borderRadius: 22, borderWidth: 1, padding: 18},
  fallbackIcon: {
    backgroundColor: '#5B5CE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIconText: {color: '#FFFFFF', fontWeight: '800'},
  sectionTitle: {fontSize: 19, fontWeight: '700', marginBottom: 12},
});
