import { BricolageGrotesque_700Bold, useFonts } from '@expo-google-fonts/bricolage-grotesque';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { ActivityIndicator, Alert, Platform, Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import AirPlayButton from './modules/airplay-button/src/AirPlayButtonView';
import { SleepSheet, SongsSheet } from './src/Sheets';
import { STATION, TAGLINE, colors, fonts } from './src/config';
import { useNowPlaying } from './src/nowPlaying';
import { useRadio, type RadioState } from './src/useRadio';
import { Ambient, ArtStack, Glass, Intro, Press, Waveform, useHeld } from './src/ui';
import { updateWidget, widgetDiagnostics } from './src/widget';

SplashScreen.preventAutoHideAsync().catch(() => {});

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

  // Abrir con dixfm://play (lo hace el widget) empieza a sonar.
  const { play } = radio;
  const url = Linking.useURL();
  useEffect(() => {
    if (url && /^dixfm:\/\/play/.test(url)) play();
  }, [url, play]);

  // El widget muestra la última canción con su carátula; indica "En vivo" solo mientras suena.
  // Se refresca con cada canción y, mientras suena, cada pocos minutos.
  const [widgetTick, setWidgetTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setWidgetTick((n) => n + 1), 4 * 60 * 1000);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    updateWidget({ title: song?.title ?? STATION, artist: song?.artist ?? TAGLINE, live: active, artUrl: song?.art });
  }, [active, song?.title, song?.artist, song?.art, widgetTick]);

  const [songsOpen, setSongsOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [sleepAt, setSleepAt] = useState(0);
  const [minutesLeft, setMinutesLeft] = useState(0);
  const [coverBox, setCoverBox] = useState({ width: 0, height: 0 });

  // Dos paneles en horizontal y en pantallas anchas (tabletas, plegables abiertos).
  const { width, height } = useWindowDimensions();
  const twoPane = width > height || width >= 700;
  const roomy = twoPane && height >= 600; // con altura de sobra, el contenido se agrupa en el centro

  // La carátula crece cuando suena y se encoge en pausa.
  const coverScale = useSharedValue(0.9);
  useEffect(() => {
    coverScale.value = withSpring(radio.state === 'playing' ? 1 : 0.9, { damping: 16, stiffness: 110 });
  }, [radio.state, coverScale]);
  const coverStyle = useAnimatedStyle(() => ({ transform: [{ scale: coverScale.value }], opacity: 0.55 + (coverScale.value - 0.9) * 4.5 }));
  const coverSize = Math.max(0, Math.min(coverBox.width, coverBox.height, 640));

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

  // Mantener pulsado el logo 2 segundos muestra el diagnóstico del widget.
  const brand = (
    <Pressable delayLongPress={2000} onLongPress={() => widgetDiagnostics().then((text) => Alert.alert('Widget', text))}>
      <Image source={logoWhite} style={styles.brand} contentFit="contain" accessibilityLabel={STATION} accessibilityRole="header" />
    </Pressable>
  );

  const status = (
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
  );

  // La carátula no es una tarjeta: se dibuja más grande que su hueco y sus bordes se
  // difuminan con una curva suave hasta fundirse con el fondo, que lleva sus mismos colores.
  const artSize = coverSize * 1.3;
  const art = useHeld(song?.art);
  const thumb = useHeld(song?.thumb);
  const cover = (
    <View style={[styles.coverBox, !twoPane && styles.coverBleed]} pointerEvents="none" onLayout={(e) => setCoverBox(e.nativeEvent.layout)}>
      <Animated.View style={[styles.coverArt, { width: artSize, height: artSize }, coverStyle]}>
        <ArtStack art={art} thumb={thumb} label={song ? `Carátula de ${song.title}` : undefined} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );

  const meta = (
    <View style={styles.meta}>
      <Animated.View key={song?.key ?? 'station'} entering={FadeInDown.duration(600)} style={styles.metaText}>
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
  );

  const controls = (
    <View style={styles.controls}>
      <Press onPress={() => setSleepOpen(true)} label={sleepAt ? `Temporizador: quedan ${minutesLeft} minutos` : 'Temporizador de apagado'}>
        <Glass style={styles.round}>
          <Ionicons name="moon-outline" size={23} color="#fff" />
        </Glass>
        {sleepAt > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{minutesLeft}</Text>
          </View>
        )}
      </Press>

      <Press onPress={radio.toggle} label={active ? 'Pausar' : 'Reproducir'} style={[styles.play, twoPane && styles.playLand]}>
        {busy ? (
          <ActivityIndicator color={colors.ink} size="large" />
        ) : (
          <Ionicons name={active ? 'pause' : 'play'} size={twoPane ? 32 : 38} color={colors.ink} style={!active && styles.playNudge} />
        )}
      </Press>

      <Press onPress={share} label="Compartir">
        <Glass style={styles.round}>
          <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={23} color="#fff" />
        </Glass>
      </Press>
    </View>
  );

  // Fila de acciones: lista de canciones y salida de audio (AirPlay, solo iOS).
  const actions = (
    <View style={[styles.actions, twoPane && styles.actionsLand]}>
      <Press onPress={() => setSongsOpen(true)} label="Canciones">
        <Glass style={[styles.songs, twoPane && styles.songsLand]}>
          <Text style={styles.songsText}>Canciones</Text>
        </Glass>
      </Press>
      {Platform.OS === 'ios' && (
        <Glass style={styles.small}>
          <AirPlayButton style={styles.airplay} accessibilityLabel="AirPlay y salida de audio" />
        </Glass>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <Ambient art={thumb} />

      {twoPane ? (
        // Horizontal: carátula a la izquierda, todo lo demás en una columna a la derecha.
        <View
          style={[
            styles.land,
            {
              paddingTop: insets.top + 14,
              paddingBottom: insets.bottom + 14,
              paddingLeft: Math.max(insets.left, 28),
              paddingRight: Math.max(insets.right, 28),
            },
          ]}>
          {cover}
          <View style={styles.landSide}>
            <View style={styles.landTop}>
              {brand}
              {actions}
            </View>
            <View style={styles.landMiddle}>
              {status}
              {meta}
              <Waveform active={radio.state === 'playing'} />
              {roomy && controls}
            </View>
            {!roomy && controls}
          </View>
        </View>
      ) : (
        <View style={[styles.screen, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.top}>
            {brand}
            {status}
          </View>
          {cover}
          {meta}
          <Waveform active={radio.state === 'playing'} />
          {controls}
          {actions}
        </View>
      )}

      <SongsSheet visible={songsOpen} onClose={() => setSongsOpen(false)} history={history} favs={favs} onRemoveFav={toggleFav} />
      <SleepSheet visible={sleepOpen} active={sleepAt > 0} minutesLeft={minutesLeft} onPick={pickSleep} onClose={() => setSleepOpen(false)} />
    </View>
  );
}

export default function App() {
  const [loaded, error] = useFonts({ BricolageGrotesque_700Bold });
  const [introStart, setIntroStart] = useState(false);
  const ready = loaded || !!error;

  useEffect(() => {
    if (!ready) return;
    // La animación de entrada arranca justo al retirarse la pantalla de inicio.
    SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => setIntroStart(true));
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Intro start={introStart}>
        <Player />
      </Intro>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  screen: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 28 },
  land: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 32, width: '100%', maxWidth: 1180, alignSelf: 'center' },
  landSide: { flex: 1.15, minWidth: 0, maxWidth: 560 },
  landTop: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  landMiddle: { flex: 1, justifyContent: 'center', gap: 8 },
  playLand: { width: 72, height: 72, borderRadius: 36 },
  songsLand: { paddingVertical: 9, paddingHorizontal: 18 },
  top: { height: 52, zIndex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { width: 76, height: 30 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.text3 },
  statusText: { color: colors.text2, fontSize: 13, fontWeight: '600' },
  coverBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverBleed: { marginHorizontal: -28, marginTop: -34, marginBottom: -10 },
  coverArt: { position: 'absolute' },
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
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 18 },
  actionsLand: { marginTop: 0, gap: 10 },
  small: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  airplay: { width: 44, height: 44 },
  songs: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 999 },
  songsText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
