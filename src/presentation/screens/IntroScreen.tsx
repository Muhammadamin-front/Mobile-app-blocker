import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// The intro is paced by the data it is covering, not by a fixed wait. It stays long
// enough not to flash, leaves the moment the app is ready, and gives up if readiness
// never arrives so a stalled load cannot strand the user here.
const MINIMUM_VISIBLE_MILLIS = 900;
const MAXIMUM_VISIBLE_MILLIS = 6000;
const EXIT_MILLIS = 320;
const INTRO_YELLOW = '#F8BA00';

type IntroScreenProps = {
  ready: boolean;
  onDone(): void;
};

/**
 * A full-bleed startup scene that also masks the initial native data read.
 * It remains visible until both the authored intro and app initialization finish.
 */
export function IntroScreen({ready, onDone}: IntroScreenProps) {
  const entrance = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;
  const dots = useRef([
    new Animated.Value(0.32),
    new Animated.Value(0.32),
    new Animated.Value(0.32),
  ]).current;
  const finished = useRef(false);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [waitedLongEnough, setWaitedLongEnough] = useState(false);

  useEffect(() => {
    const floor = setTimeout(() => setMinimumElapsed(true), MINIMUM_VISIBLE_MILLIS);
    const ceiling = setTimeout(() => setWaitedLongEnough(true), MAXIMUM_VISIBLE_MILLIS);
    return () => {
      clearTimeout(floor);
      clearTimeout(ceiling);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const animations: Animated.CompositeAnimation[] = [];

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reducedMotion => {
        if (cancelled) {
          return;
        }

        if (reducedMotion) {
          entrance.setValue(1);
          dots.forEach(dot => dot.setValue(0.78));
          return;
        }

        const enterAnimation = Animated.timing(entrance, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        });
        const driftAnimation = Animated.loop(
          Animated.sequence([
            Animated.timing(drift, {
              toValue: 1,
              duration: 3200,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(drift, {
              toValue: 0,
              duration: 3200,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        );
        const dotAnimation = Animated.loop(
          Animated.stagger(
            150,
            dots.map(dot =>
              Animated.sequence([
                Animated.timing(dot, {
                  toValue: 1,
                  duration: 230,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }),
                Animated.timing(dot, {
                  toValue: 0.32,
                  duration: 300,
                  easing: Easing.in(Easing.quad),
                  useNativeDriver: true,
                }),
              ]),
            ),
          ),
        );

        animations.push(enterAnimation, driftAnimation, dotAnimation);
        enterAnimation.start();
        driftAnimation.start();
        dotAnimation.start();
      });

    return () => {
      cancelled = true;
      animations.forEach(animation => animation.stop());
    };
  }, [dots, drift, entrance]);

  const finish = useCallback(() => {
    if (finished.current) {
      return;
    }
    finished.current = true;
    Animated.timing(exit, {
      toValue: 0,
      duration: EXIT_MILLIS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start(({finished: animationFinished}) => {
      if (animationFinished) {
        onDone();
      }
    });
  }, [exit, onDone]);

  useEffect(() => {
    if (minimumElapsed && (ready || waitedLongEnough)) {
      finish();
    }
  }, [finish, minimumElapsed, ready, waitedLongEnough]);

  return (
    <Animated.View style={[styles.root, {opacity: exit}]}>
      <StatusBar animated barStyle="dark-content" />
      <Animated.Image
        accessibilityIgnoresInvertColors
        resizeMode="cover"
        source={require('../../assets/cat-intro.jpg')}
        style={[
          styles.image,
          {
            opacity: entrance,
            transform: [
              {
                scale: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1.02, 1.075],
                }),
              },
              {
                translateX: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-2, 3],
                }),
              },
              {
                translateY: drift.interpolate({
                  inputRange: [0, 1],
                  outputRange: [5, -7],
                }),
              },
            ],
          },
        ]}
      />

      <View pointerEvents="none" style={styles.topTint} />

      <Animated.View
        accessible
        accessibilityLabel="FocusGuard is loading"
        accessibilityLiveRegion="polite"
        style={[
          styles.loading,
          {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          },
        ]}>
        <Text style={styles.brand}>FOCUSGUARD</Text>
        <View style={styles.loadingRow}>
          <Text style={styles.loadingText}>Loading</Text>
          <View accessibilityElementsHidden style={styles.dots}>
            {dots.map((dot, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    opacity: dot,
                    transform: [
                      {
                        translateY: dot.interpolate({
                          inputRange: [0.32, 1],
                          outputRange: [0, -6],
                        }),
                      },
                      {
                        scale: dot.interpolate({
                          inputRange: [0.32, 1],
                          outputRange: [0.82, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: INTRO_YELLOW,
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  topTint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: '54%',
    left: 0,
    backgroundColor: '#F9BE0014',
  },
  loading: {
    position: 'absolute',
    top: '15%',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  brand: {
    color: '#17130A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3.2,
    marginBottom: 11,
    opacity: 0.62,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  loadingText: {
    color: '#100D07',
    fontSize: 31,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  dots: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    marginLeft: 8,
    paddingBottom: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#100D07',
  },
});
