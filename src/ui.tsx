import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from './config';

const liquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

export const tap = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Superficie translúcida: Liquid Glass donde existe, desenfoque en el resto de iOS y un velo en Android. */
export function Glass({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  if (liquidGlass) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme="dark" isInteractive style={style}>
        {children}
      </GlassView>
    );
  }
  if (Platform.OS === 'ios') {
    return (
      <BlurView tint="systemThinMaterialDark" intensity={60} style={[style, styles.clip]}>
        {children}
      </BlurView>
    );
  }
  return <View style={[style, { backgroundColor: colors.glass }]}>{children}</View>;
}

/** Botón que se encoge al tocarlo. */
export function Press({
  onPress,
  label,
  disabled,
  selected,
  style,
  children,
}: {
  onPress: () => void;
  label: string;
  disabled?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      hitSlop={8}
      onPressIn={() => (scale.value = withSpring(0.9, { damping: 18, stiffness: 420 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 12, stiffness: 320 }))}
      onPress={() => {
        tap();
        onPress();
      }}>
      <Animated.View style={[style, animated, disabled && styles.disabled]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Fondo: la carátula muy desenfocada moviéndose despacio, o los colores de la marca. */
export function Ambient({ art }: { art?: string }) {
  const reduced = useReducedMotion();
  const drift = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    drift.value = withRepeat(withTiming(1, { duration: 28000, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(drift);
  }, [drift, reduced]);
  const moving = useAnimatedStyle(() => ({
    transform: [{ scale: 1.5 + drift.value * 0.25 }, { rotate: `${drift.value * 24 - 12}deg` }],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.ambient]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, moving]}>
        <LinearGradient
          colors={[colors.violet, colors.coral, colors.mint]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Image source={art ? { uri: art } : null} blurRadius={70} contentFit="cover" transition={1400} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <LinearGradient colors={['rgba(13,8,32,0.32)', 'rgba(13,8,32,0.74)']} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const BARS = 40;

function Bar({ index, clock, level }: { index: number; clock: SharedValue<number>; level: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    // Graves en el centro, agudos a los lados.
    const edge = Math.abs(index - (BARS - 1) / 2) / (BARS / 2);
    const t = clock.value;
    const wave =
      (0.5 + 0.5 * Math.sin(t * 5.1 + index * 0.9)) * (0.5 + 0.5 * Math.sin(t * 2.3 - index * 0.37)) * (1 - edge * 0.55) * 0.9 + 0.08;
    return { height: 4 + wave * level.value * 40, opacity: 0.4 + level.value * 0.52 };
  });
  return <Animated.View style={[styles.bar, style]} />;
}

/** Onda que se mueve mientras suena la radio. */
export function Waveform({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const clock = useSharedValue(0);
  const level = useSharedValue(0);

  useEffect(() => {
    level.value = withTiming(active ? 1 : 0, { duration: 450 });
    if (active && !reduced) {
      clock.value = withRepeat(withTiming(clock.value + 3600, { duration: 3600 * 1000, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(clock);
    }
    return () => cancelAnimation(clock);
  }, [active, reduced, clock, level]);

  return (
    <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: BARS }, (_, i) => (
        <Bar key={i} index={i} clock={clock} level={level} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  disabled: { opacity: 0.35 },
  ambient: { backgroundColor: colors.ink, overflow: 'hidden' },
  wave: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bar: { width: 4, borderRadius: 2, backgroundColor: '#fff' },
});
