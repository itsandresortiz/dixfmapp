import MaskedViewBase from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  withDelay,
  withSequence,
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

/**
 * Superficie translúcida: Liquid Glass donde existe, desenfoque en el resto de iOS
 * y un velo en Android. `solid` es el color de Android para superficies grandes con texto.
 */
export function Glass({
  style,
  children,
  interactive = true,
  solid,
}: {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  interactive?: boolean;
  solid?: string;
}) {
  if (liquidGlass) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme="dark" isInteractive={interactive} style={style}>
        {children}
      </GlassView>
    );
  }
  if (Platform.OS === 'ios') {
    return (
      <BlurView tint={interactive ? 'systemThinMaterialDark' : 'systemMaterialDark'} intensity={interactive ? 60 : 90} style={[style, styles.clip]}>
        {children}
      </BlurView>
    );
  }
  return <View style={[style, { backgroundColor: solid ?? colors.glass }]}>{children}</View>;
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
        <Image source={art ? { uri: art } : null} blurRadius={70} contentFit="cover" transition={{ duration: 1600, effect: 'cross-dissolve' }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <LinearGradient colors={['rgba(13,8,32,0.32)', 'rgba(13,8,32,0.74)']} style={StyleSheet.absoluteFill} />
    </View>
  );
}

// Los tipos del paquete aún no encajan con React 19.
const MaskedView = MaskedViewBase as unknown as ComponentType<{
  style?: StyleProp<ViewStyle>;
  maskElement: ReactElement;
  children?: ReactNode;
}>;

// Curva suave (smoothstep) con muchos pasos: así el borde no se percibe como una línea.
const STEPS = 8;
const ease = (t: number) => t * t * (3 - 2 * t);
function fade(inEnd: number, outStart: number) {
  const stops: { at: number; alpha: number }[] = [];
  for (let i = 0; i <= STEPS; i++) stops.push({ at: (inEnd * i) / STEPS, alpha: ease(i / STEPS) });
  for (let i = 0; i <= STEPS; i++) stops.push({ at: outStart + ((1 - outStart) * i) / STEPS, alpha: ease(1 - i / STEPS) });
  return {
    colors: stops.map((s) => `rgba(0,0,0,${s.alpha.toFixed(3)})`) as [string, string, ...string[]],
    locations: stops.map((s) => s.at) as [number, number, ...number[]],
    css: stops.map((s) => `rgba(0,0,0,${s.alpha.toFixed(3)}) ${(s.at * 100).toFixed(1)}%`).join(', '),
  };
}
const FADE_X = fade(0.3, 0.7);
const FADE_Y = fade(0.3, 0.52);
const WEB_MASK = `linear-gradient(to right, ${FADE_X.css}), linear-gradient(to bottom, ${FADE_Y.css})`;

/** Difumina los cuatro bordes de su contenido para que se funda con el fondo. */
export function Feather({ style, children }: { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  if (Platform.OS === 'web') {
    const mask = { maskImage: WEB_MASK, WebkitMaskImage: WEB_MASK, maskComposite: 'intersect', WebkitMaskComposite: 'source-in' };
    return <View style={[style, mask as ViewStyle]}>{children}</View>;
  }
  return (
    <MaskedView
      style={style}
      maskElement={<LinearGradient colors={FADE_X.colors} locations={FADE_X.locations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}>
      <MaskedView
        style={StyleSheet.absoluteFill}
        maskElement={<LinearGradient colors={FADE_Y.colors} locations={FADE_Y.locations} style={StyleSheet.absoluteFill} />}>
        {children}
      </MaskedView>
    </MaskedView>
  );
}

const coverLogo = require('../assets/logo.png');
type Layer = { key: string; art?: string; thumb?: string };

function ArtLayer({ layer, leaving, label, onGone }: { layer: Layer; leaving: boolean; label?: string; onGone: () => void }) {
  const reduced = useReducedMotion();
  const enter = useSharedValue(0);
  const leave = useSharedValue(0);

  useEffect(() => {
    enter.value = withTiming(1, { duration: reduced ? 250 : 1100, easing: Easing.out(Easing.cubic) });
  }, [enter, reduced]);

  useEffect(() => {
    if (!leaving) return;
    leave.value = withTiming(1, { duration: reduced ? 250 : 900, easing: Easing.inOut(Easing.quad) });
    const timer = setTimeout(onGone, 950);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  // La nueva llega desde un poco más cerca y se asienta; la anterior se aleja y se apaga.
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, enter.value * 1.6) * (1 - leave.value),
    transform: [{ scale: reduced ? 1 : (1.14 - 0.14 * enter.value) * (1 - 0.07 * leave.value) }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.artLayer, style]}>
      {layer.art ? (
        <Image
          source={{ uri: layer.art }}
          placeholder={layer.thumb ? { uri: layer.thumb } : null}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
          accessibilityLabel={label}
        />
      ) : (
        <Image source={coverLogo} style={styles.artLogo} contentFit="contain" />
      )}
    </Animated.View>
  );
}

/**
 * Mantiene el último valor mientras llega el siguiente: al cambiar de canción la carátula
 * anterior sigue en pantalla hasta que carga la nueva, sin pasar por el logo.
 */
export function useHeld<T>(value: T | undefined, ms = 3000) {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    if (value !== undefined) {
      setHeld(value);
      return;
    }
    const timer = setTimeout(() => setHeld(undefined), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return value ?? held;
}

/** Carátula con bordes difuminados; al cambiar de canción funde una con otra. */
export function ArtStack({ art, thumb, label, style }: { art?: string; thumb?: string; label?: string; style?: StyleProp<ViewStyle> }) {
  const key = art ?? 'logo';
  const [layers, setLayers] = useState<Layer[]>([{ key, art, thumb }]);

  useEffect(() => {
    setLayers((current) => (current[current.length - 1].key === key ? current : [...current.slice(-1), { key, art, thumb }]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <Feather style={style}>
      {layers.map((layer, index) => (
        <ArtLayer
          key={layer.key}
          layer={layer}
          label={label}
          leaving={index < layers.length - 1}
          onGone={() => setLayers((current) => (current.length > 1 ? current.filter((l) => l.key !== layer.key) : current))}
        />
      ))}
    </Feather>
  );
}

const introLogo = require('../assets/logo.png');

/**
 * Entrada: continúa la pantalla de inicio. El logo se encoge un instante, crece
 * hasta salirse de la pantalla y deja ver la app, que llega asentándose desde atrás.
 */
export function Intro({ start, children }: { start: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(false);
  const logo = useSharedValue(1);
  const veil = useSharedValue(1);
  const content = useSharedValue(reduced ? 1 : 1.14);

  useEffect(() => {
    if (!start) return;
    if (reduced) {
      veil.value = withTiming(0, { duration: 350 });
    } else {
      logo.value = withSequence(
        withTiming(0.8, { duration: 260, easing: Easing.out(Easing.cubic) }),
        withTiming(46, { duration: 620, easing: Easing.in(Easing.exp) })
      );
      veil.value = withDelay(560, withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) }));
      content.value = withDelay(480, withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }));
    }
    const timer = setTimeout(() => setDone(true), 1300);
    return () => clearTimeout(timer);
  }, [start, reduced, logo, veil, content]);

  const contentStyle = useAnimatedStyle(() => ({ transform: [{ scale: content.value }] }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: logo.value }] }));

  return (
    <View style={styles.introRoot}>
      <Animated.View style={[styles.introRoot, contentStyle]}>{children}</Animated.View>
      {!done && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veilStyle]} pointerEvents="none">
          <Animated.View style={logoStyle}>
            <Image source={introLogo} style={styles.introLogo} contentFit="contain" />
          </Animated.View>
        </Animated.View>
      )}
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
  artLayer: { alignItems: 'center', justifyContent: 'center' },
  artLogo: { width: '38%', height: '22%' },
  introRoot: { flex: 1, backgroundColor: colors.ink },
  veil: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // Mismo tamaño que el logo de la pantalla de inicio (220 de ancho, logo al 78 %).
  introLogo: { width: 172, height: 68 },
  disabled: { opacity: 0.35 },
  ambient: { backgroundColor: colors.ink, overflow: 'hidden' },
  wave: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bar: { width: 4, borderRadius: 2, backgroundColor: '#fff' },
});
