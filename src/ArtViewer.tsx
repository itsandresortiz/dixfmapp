import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo } from 'react';
import { Linking, PanResponder, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from './config';
import type { Song } from './nowPlaying';
import { Glass, Press } from './ui';

/** Carátula a pantalla completa. Se cierra tocando fuera o arrastrando hacia abajo. */
export function ArtViewer({ song, onClose }: { song: Song; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const open = useSharedValue(0);
  const drag = useSharedValue(0);
  const wide = width > height;
  const size = Math.min(width - 40, height - insets.top - insets.bottom - (wide ? 40 : 240), 620);

  useEffect(() => {
    open.value = reduced ? withTiming(1, { duration: 150 }) : withSpring(1, { damping: 18, stiffness: 170 });
  }, [open, reduced]);

  const close = useCallback(() => {
    open.value = withTiming(0, { duration: 190 });
    setTimeout(onClose, 190);
  }, [open, onClose]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          drag.value = Math.max(0, g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 110 || g.vy > 0.9) close();
          else drag.value = withSpring(0, { damping: 18, stiffness: 220 });
        },
        onPanResponderTerminate: () => {
          drag.value = withSpring(0);
        },
      }),
    [close, drag]
  );

  const backdrop = useAnimatedStyle(() => ({ opacity: open.value * (1 - Math.min(drag.value / 500, 0.6)) }));
  const card = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: [{ translateY: drag.value }, { scale: (0.86 + open.value * 0.14) * (1 - Math.min(drag.value / 1800, 0.14)) }],
  }));

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal {...pan.panHandlers}>
      <Animated.View style={[StyleSheet.absoluteFill, backdrop]}>
        {Platform.OS === 'ios' ? (
          <BlurView tint="systemChromeMaterialDark" intensity={95} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.dim]} />
        )}
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Cerrar carátula" />
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[styles.center, wide && styles.centerWide, { paddingTop: insets.top, paddingBottom: insets.bottom }, card]}>
        <View style={[styles.art, { width: size, height: size }]}>
          <Image source={{ uri: song.art }} placeholder={song.thumb ? { uri: song.thumb } : null} style={styles.image} contentFit="cover" />
        </View>
        <View style={[styles.info, wide ? styles.infoWide : { width: size }]}>
          <Text style={styles.title} numberOfLines={3}>
            {song.title}
          </Text>
          <Text style={styles.artist} numberOfLines={2}>
            {song.artist}
          </Text>
          {song.url && (
            <Press onPress={() => Linking.openURL(song.url!).catch(() => {})} label="Abrir en Apple Music" style={styles.linkWrap}>
              <Glass style={styles.link}>
                <Ionicons name="musical-notes" size={16} color="#fff" />
                <Text style={styles.linkText}>Abrir en Apple Music</Text>
              </Glass>
            </Press>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(13,8,32,0.97)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 },
  centerWide: { flexDirection: 'row', gap: 32, paddingHorizontal: 32 },
  art: {
    borderRadius: 22,
    backgroundColor: colors.ink,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 24 },
    elevation: 20,
  },
  image: { flex: 1, borderRadius: 22 },
  info: { alignItems: 'flex-start' },
  infoWide: { flex: 1, maxWidth: 360 },
  title: { color: '#fff', fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
  artist: { color: colors.text2, fontSize: 18, marginTop: 4 },
  linkWrap: { marginTop: 18 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 999 },
  linkText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
