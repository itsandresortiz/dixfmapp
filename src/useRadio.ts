import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { STATION, STATS_URL, STREAM_URL, TAGLINE } from './config';

export type RadioState = 'idle' | 'loading' | 'playing' | 'error';
export type LockScreenInfo = { title: string; artist: string; artworkUrl?: string };

const TICK_MS = 1500;
const STALL_MS = 7000; // sin avanzar este tiempo, se da la señal por perdida
const STALE_MS = 5000; // tras una pausa más larga se reconecta para volver al directo
const RETRY_MS = [2000, 4000, 8000]; // espera entre reintentos; el último valor se repite

let shared: AudioPlayer | null = null;
function getPlayer() {
  if (!shared) shared = createAudioPlayer(null, { updateInterval: 500 });
  return shared;
}

/** ¿Hay conexión con el servidor de la emisora? */
async function isOnline() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(STATS_URL, { cache: 'no-store', signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reproductor de la emisora. Mientras el usuario quiera escuchar, vigila que el audio
 * avance de verdad: si se detiene (sin red, corte del servidor), avisa y reconecta
 * por su cuenta hasta que vuelva a sonar.
 */
export function useRadio(info: LockScreenInfo) {
  const [state, setStateRaw] = useState<RadioState>('idle');
  const stateRef = useRef<RadioState>('idle');
  const wantPlay = useRef(false);
  const attempts = useRef(0);
  const nextAttemptAt = useRef(0);
  const lastTime = useRef(-1);
  const lastProgressAt = useRef(0);
  const pausedAt = useRef(0);
  const checkingPause = useRef(false);
  const infoRef = useRef(info);
  infoRef.current = info;

  const metadata = () => ({
    title: infoRef.current.title || STATION,
    artist: infoRef.current.artist || TAGLINE,
    albumTitle: STATION,
    artworkUrl: infoRef.current.artworkUrl,
  });

  const setState = useCallback((next: RadioState) => {
    if (stateRef.current === next) return;
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  const connect = useCallback(() => {
    const player = getPlayer();
    lastTime.current = -1;
    lastProgressAt.current = Date.now();
    // Cada conexión es nueva para sonar siempre en directo, nunca desde un búfer viejo.
    player.replace({ uri: `${STREAM_URL}&t=${Date.now()}` });
    player.play();
    player.setActiveForLockScreen(true, metadata(), { isLiveStream: true });
  }, []);

  const play = useCallback(() => {
    wantPlay.current = true;
    attempts.current = 0;
    setState('loading');
    connect();
  }, [connect, setState]);

  const stop = useCallback(() => {
    wantPlay.current = false;
    pausedAt.current = Date.now();
    getPlayer().pause();
    setState('idle');
  }, [setState]);

  const toggle = useCallback(() => (wantPlay.current ? stop() : play()), [play, stop]);

  /** La señal se perdió: avisa y programa el siguiente intento. */
  const lost = useCallback(
    (now: number) => {
      setState('error');
      if (now < nextAttemptAt.current) return;
      const wait = RETRY_MS[Math.min(attempts.current, RETRY_MS.length - 1)];
      attempts.current++;
      nextAttemptAt.current = now + wait;
      connect();
    },
    [connect, setState]
  );

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
    const player = getPlayer();

    // Vigilancia: ¿avanza el audio?
    const watchdog = setInterval(() => {
      if (!wantPlay.current) return;
      const now = Date.now();
      const time = player.currentTime ?? 0;
      if (time > lastTime.current + 0.05 && lastTime.current >= 0) {
        lastProgressAt.current = now;
        attempts.current = 0;
        nextAttemptAt.current = 0;
        setState('playing');
      } else if (now - lastProgressAt.current > STALL_MS) {
        lost(now);
      }
      lastTime.current = time;
    }, TICK_MS);

    const sub = player.addListener('playbackStatusUpdate', (status: Partial<AudioStatus>) => {
      if (status.error || status.didJustFinish) {
        // Corte: el siguiente ciclo de vigilancia reconecta sin esperar.
        if (wantPlay.current) {
          lastProgressAt.current = 0;
          setState('error');
        }
        return;
      }

      if (status.playing && !wantPlay.current) {
        // Se reanudó desde la pantalla de bloqueo o los auriculares.
        wantPlay.current = true;
        attempts.current = 0;
        setState('loading');
        if (Date.now() - pausedAt.current > STALE_MS) connect();
        else lastProgressAt.current = Date.now();
        return;
      }

      // ¿Pausa desde fuera de la app, o corte? Una pausa del usuario ocurre con red;
      // si no hay red es un corte y la vigilancia se encarga de reconectar.
      if (
        wantPlay.current &&
        stateRef.current === 'playing' &&
        status.playing === false &&
        status.timeControlStatus === 'paused' &&
        !checkingPause.current
      ) {
        checkingPause.current = true;
        isOnline()
          .then((online) => {
            if (online && wantPlay.current && !player.playing && stateRef.current === 'playing') stop();
            else if (!online && wantPlay.current) lastProgressAt.current = 0;
          })
          .finally(() => {
            checkingPause.current = false;
          });
      }
    });

    return () => {
      clearInterval(watchdog);
      sub.remove();
    };
  }, [connect, lost, setState, stop]);

  // La pantalla de bloqueo muestra la canción en curso.
  useEffect(() => {
    if (stateRef.current === 'idle' && !pausedAt.current) return;
    getPlayer().updateLockScreenMetadata(metadata());
  }, [info.title, info.artist, info.artworkUrl]);

  return { state, play, stop, toggle };
}
