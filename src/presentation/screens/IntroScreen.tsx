import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {pickQuote} from '../../domain/quotes';
import {radii, spacing, Theme} from '../../theme/theme';
import {BrandMark} from '../components';

const HOLD_MILLIS = 2400;
const ENTER_MILLIS = 720;

/**
 * The first frame of a cold start. It covers the initial database read rather
 * than adding waiting time, and any tap or a Back press moves on immediately.
 */
export function IntroScreen({theme, onDone}: {theme: Theme; onDone(): void}) {
  const quote = useMemo(() => pickQuote(), []);
  const enter = useRef(new Animated.Value(0)).current;
  const settled = useRef(false);
  const [done, setDone] = useState(false);

  const finish = useCallback(() => {
    if (settled.current) {
      return;
    }
    settled.current = true;
    setDone(true);
    onDone();
  }, [onDone]);

  useEffect(() => {
    let cancelled = false;
    let animation: Animated.CompositeAnimation | undefined;

    // One authored settle. With Remove animations on, the screen simply is.
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduced => {
        if (cancelled) {
          return;
        }
        if (reduced) {
          enter.setValue(1);
          return;
        }
        animation = Animated.timing(enter, {
          toValue: 1,
          duration: ENTER_MILLIS,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        });
        animation.start();
      });

    const timer = setTimeout(finish, HOLD_MILLIS);
    return () => {
      cancelled = true;
      animation?.stop();
      clearTimeout(timer);
    };
  }, [enter, finish]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      finish();
      return true;
    });
    return () => subscription.remove();
  }, [finish]);

  const stage = (from: number, to: number, distance: number) => ({
    opacity: enter.interpolate({
      inputRange: [from, to],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [from, to],
          outputRange: [distance, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  });

  if (done) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue to FocusGuard"
      onPress={finish}
      style={styles.pressable}>
      <View style={[styles.root, {backgroundColor: theme.background}]}>
        <View
          pointerEvents="none"
          style={[styles.ambientGlow, {backgroundColor: theme.backgroundAccent}]}
        />
        <SafeAreaView style={styles.safe}>
          <View style={styles.center}>
            <Animated.View style={stage(0, 0.55, 22)}>
              <View style={[styles.halo, {backgroundColor: theme.primarySoft}]}>
                <BrandMark theme={theme} size={72} />
              </View>
            </Animated.View>

            <Animated.View style={[styles.copy, stage(0.2, 0.8, 16)]}>
              <Text style={[styles.welcome, {color: theme.textMuted}]}>
                Welcome to{' '}
                <Text style={[styles.brand, {color: theme.text}]}>FocusGuard</Text>
              </Text>
              <Animated.View
                style={[
                  styles.rule,
                  {backgroundColor: theme.primary},
                  {
                    transform: [
                      {
                        scaleX: enter.interpolate({
                          inputRange: [0.55, 1],
                          outputRange: [0, 1],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  },
                ]}
              />
            </Animated.View>

            <Animated.View
              style={[
                styles.quoteCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  shadowColor: theme.shadow,
                },
                stage(0.45, 1, 18),
              ]}>
              <Text style={[styles.quoteText, {color: theme.text}]}>
                “{quote.text}”
              </Text>
              <Text style={[styles.quoteAuthor, {color: theme.textMuted}]}>
                — {quote.author}
              </Text>
            </Animated.View>
          </View>

          <Animated.Text
            style={[
              styles.hint,
              {color: theme.textMuted},
              {
                opacity: enter.interpolate({
                  inputRange: [0.7, 1],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
              },
            ]}>
            Tap to continue
          </Animated.Text>
        </SafeAreaView>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {flex: 1},
  root: {flex: 1},
  safe: {flex: 1},
  ambientGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    top: -150,
    right: -120,
    opacity: 0.55,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xxl,
  },
  halo: {
    width: 116,
    height: 116,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {alignItems: 'center'},
  welcome: {fontSize: 27, fontWeight: '500', letterSpacing: -0.5, textAlign: 'center'},
  brand: {fontSize: 27, fontWeight: '800', letterSpacing: -0.8},
  rule: {width: 52, height: 3, borderRadius: 2, marginTop: spacing.lg},
  quoteCard: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    elevation: 5,
    shadowOffset: {width: 0, height: 9},
    shadowOpacity: 0.11,
    shadowRadius: 18,
  },
  quoteText: {fontSize: 16, lineHeight: 25, fontWeight: '600'},
  quoteAuthor: {fontSize: 13, fontWeight: '600', marginTop: spacing.sm},
  hint: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.1,
    paddingBottom: spacing.xl,
  },
});
