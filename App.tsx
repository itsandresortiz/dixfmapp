import { BricolageGrotesque_700Bold, useFonts } from '@expo-google-fonts/bricolage-grotesque';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SleepSheet, SongsSheet } from './src/Sheets';
import { STATION, TAGLINE, colors, fonts } from './src/config';
import { useNowPlaying } from './src/nowPlaying';
import { useRadio, type RadioState } from './src/useRadio';
import { Ambient, Glass, Press, Waveform } from './src/ui';

SplashScreen.preventAutoHideAsync().catch(() => {});

const logo = require('./assets/logo.png');
const logoWhite = require('./assets/logo-white.png');

const STATUS_TEXT: Record<RadioState, string> = {
  idle: 'En pausa',
  loading: 'Conectando…',
  playing: 'En vivo',
  error: 'Sin señal. Reintentando…',
};

function Player() {
  const insets = useSafeAreaInsets();
  const [playing, setPlaying] = useState(false);
  const { song, history, favs, isFav, toggleFav } = useNowPlaying(playing);
  const radio = useRadio({
    title: song?.title ?? STATION,
    artist: song?.artist ?? TAGLINE,
    artworkUrl: song?.art,
  });
  const active = radio.state !== 'idle';
  useEffect(() => setPlaying(active), [active]);

  const [songsOpen, setSongsOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [sleepAt, setSleepAt] = useState(0);
  const [minutesLeft, setMinutesLeft] = useState(0);
  const [coverBox, setCoverBox] = useState({ width: 0, height: 0 });

  // La carátula crece cuando suena y se encoge en pausa.
  const coverScale = useSharedValue(0.82);
  useEffect(() => {
    coverScale.value = withSpring(radio.state === 'playing' ? 1 : 0.82, { damping: 14, stiffness: 120 });
  }, [radio.state, coverScale]);
  const coverStyle = useAnimatedStyle(() => ({ transform: [{ scale: coverScale.value }] }));
  const coverSize = Math.max(0, Math.min(coverBox.width, coverBox.height - 24, 440));

  // Temporizador de apagado
  const { stop } = radio;
  useEffect(() => {
    if (!sleepAt) return;
    const tick = () => {
      const left = sleepAt - Date.now();
      if (left <= 0) {
        stop();
        setSleepAt(0);
      } else {
        setMinutesLeft(Math.ceil(left / 60000));
      }
    };
    tick();
    const timer = setInterval(tick, 5000);
    return () => clearInterval(timer);
  }, [sleepAt, stop]);

  const pickSleep = useCallback((minutes: number) => {
    setSleepOpen(false);
    setSleepAt(minutes ? Date.now() + minutes * 60000 : 0);
  }, []);

  const share = useCallback(() => {
    const message = song ? `Escuchando «${song.title}» de ${song.artist} en ${STATION}` : `Escucha ${STATION} en vivo`;
    Share.share({ message: `${message} https://dixfm.com` }).catch(() => {});
  }, [song]);

  const busy = radio.state === 'loading' || radio.state === 'error';

  return (
    <View style={styles.root}>
      <Ambient art={song?.thumb} />

      <View style={[styles.screen, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.top}>
          <Image source={logoWhite} style={styles.brand} contentFit="contain" accessibilityLabel={STATION} accessibilityRole="header" />
          <View style={styles.status} accessibilityRole="text" accessibilityLiveRegion="polite">
            <View
              style={[
                styles.dot,
                radio.state === 'playing' && { backgroundColor: colors.live },
                radio.state === 'error' && { backgroundColor: '#ffb340' },
              ]}
            />
            <Text style={[styles.statusText, radio.state === 'playing' && { color: '#fff' }]}>{STATUS_TEXT[radio.state]}</Text>
          </View>
        </View>

        <View style={styles.coverBox} onLayout={(e) => setCoverBox(e.nativeEvent.layout)}>
          <Animated.View style={[styles.cover, { width: coverSize, height: coverSize, borderRadius: coverSize * 0.09 }, coverStyle]}>
            <View style={[styles.coverInner, { borderRadius: coverSize * 0.09 }]}>
              <Image source={logo} style={styles.coverLogo} contentFit="contain" />
              <Image source={song?.art ? { uri: song.art } : null} placeholder={song?.thumb ? { uri: song.thumb } : null} style={StyleSheet.absoluteFill} contentFit="cover" transition={500} />
            </View>
          </Animated.View>
        </View>

        <View style={styles.meta}>
          <Animated.View key={song?.key ?? 'station'} entering={FadeIn.duration(450)} style={styles.metaText}>
            <Text style={styles.title} numberOfLines={2}>
              {song?.title ?? STATION}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {song?.artist ?? TAGLINE}
            </Text>
          </Animated.View>
          <Press
            onPress={() => song && toggleFav(song)}
            disabled={!song}
            selected={isFav}
            label={isFav ? 'Quitar de favoritas' : 'Guardar en favoritas'}
            style={styles.heart}>
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={28} color={isFav ? colors.live : '#fff'} />
          </Press>
        </View>

        <Waveform active={radio.state === 'playing'} />

        <View style={styles.controls}>
          <Press
            onPress={() => setSleepOpen(true)}
            label={sleepAt ? `Temporizador: quedan ${minutesLeft} minutos` : 'Temporizador de apagado'}>
            <Glass style={styles.round}>
              <Ionicons name="moon-outline" size={23} color="#fff" />
            </Glass>
            {sleepAt > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{minutesLeft}</Text>
              </View>
            )}
          </Press>

          <Press onPress={radio.toggle} label={active ? 'Pausar' : 'Reproducir'} style={styles.play}>
            {busy ? (
              <ActivityIndicator color={colors.ink} size="large" />
            ) : (
              <Ionicons name={active ? 'pause' : 'play'} size={38} color={colors.ink} style={!active && styles.playNudge} />
            )}
          </Press>

          <Press onPress={share} label="Compartir">
            <Glass style={styles.round}>
              <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={23} color="#fff" />
            </Glass>
          </Press>
        </View>

        <Press onPress={() => setSongsOpen(true)} label="Canciones" style={styles.songsWrap}>
          <Glass style={styles.songs}>
            <Text style={styles.songsText}>Canciones</Text>
          </Glass>
        </Press>
      </View>

      <SongsSheet visible={songsOpen} onClose={() => setSongsOpen(false)} history={history} favs={favs} onRemoveFav={toggleFav} />
      <SleepSheet visible={sleepOpen} active={sleepAt > 0} onPick={pickSleep} onClose={() => setSleepOpen(false)} />
    </View>
  );
}

export default function App() {
  const [loaded, error] = useFonts({ BricolageGrotesque_700Bold });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Player />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  screen: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 28 },
  top: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { width: 76, height: 30 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text3 },
  statusText: { color: colors.text2, fontSize: 13, fontWeight: '600' },
  coverBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cover: {
    backgroundColor: colors.ink,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 22 },
    elevation: 18,
  },
  coverInner: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  coverLogo: { width: '66%', height: '40%' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 64 },
  metaText: { flex: 1, minWidth: 0 },
  title: { color: '#fff', fontFamily: fonts.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.4 },
  artist: { color: colors.text2, fontSize: 17, marginTop: 2 },
  heart: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 14 },
  round: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  play: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  playNudge: { marginLeft: 4 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  badgeText: { color: colors.ink, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  songsWrap: { alignSelf: 'center', marginTop: 18 },
  songs: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 999 },
  songsText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
