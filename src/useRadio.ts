import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { STATION, STREAM_URL, TAGLINE } from './config';

export type RadioState = 'idle' | 'loading' | 'playing' | 'error';
export type LockScreenInfo = { title: string; artist: string; artworkUrl?: string };

const STALE_MS = 5000; // tras una pausa más larga se reconecta para volver al directo
const LOADING_TIMEOUT_MS = 20000;

let shared: AudioPlayer | null = null;
function getPlayer() {
  if (!shared) shared = createAudioPlayer(null, { updateInterval: 500 });
  return shared;
}

/** Reproductor de la emisora: directo, reconexión y controles del sistema. */
export function useRadio(info: LockScreenInfo) {
  const [state, setStateRaw] = useState<RadioState>('idle');
  const stateRef = useRef<RadioState>('idle');
  const wantPlay = useRef(false);
  const retry = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pauseCheck = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const connectedAt = useRef(0);
  const pausedAt = useRef(0);
  const erroredAt = useRef(0);
  const infoRef = useRef(info);
  infoRef.current = info;
  const retryRef = useRef<() => void>(() => {});

  const metadata = () => ({
    title: infoRef.current.title || STATION,
    artist: infoRef.current.artist || TAGLINE,
    albumTitle: STATION,
    artworkUrl: infoRef.current.artworkUrl,
  });

  const setState = useCallback((next: RadioState) => {
    stateRef.current = next;
    setStateRaw(next);
    clearTimeout(watchdog.current);
    if (next === 'loading') {
      // Si la conexión se queda colgada, se vuelve a intentar.
      watchdog.current = setTimeout(() => retryRef.current(), LOADING_TIMEOUT_MS);
    }
  }, []);

  const connect = useCallback(() => {
    clearTimeout(retryTimer.current);
    const player = getPlayer();
    connectedAt.current = Date.now();
    // Cada conexión es nueva para sonar siempre en directo, nunca desde un búfer viejo.
    player.replace({ uri: `${STREAM_URL}&t=${Date.now()}` });
    player.play();
    player.setActiveForLockScreen(true, metadata(), { isLiveStream: true });
  }, []);

  const scheduleRetry = useCallback(() => {
    if (!wantPlay.current) return;
    setState('error');
    clearTimeout(retryTimer.current);
    const delay = Math.min(15000, 1000 * 2 ** retry.current++);
    retryTimer.current = setTimeout(() => wantPlay.current && connect(), delay);
  }, [connect, setState]);
  retryRef.current = scheduleRetry;

  const play = useCallback(() => {
    wantPlay.current = true;
    retry.current = 0;
    setState('loading');
    connect();
  }, [connect, setState]);

  const stop = useCallback(() => {
    wantPlay.current = false;
    clearTimeout(retryTimer.current);
    clearTimeout(pauseCheck.current);
    pausedAt.current = Date.now();
    getPlayer().pause();
    setState('idle');
  }, [setState]);

  const toggle = useCallback(() => (wantPlay.current ? stop() : play()), [play, stop]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});

    const sub = getPlayer().addListener('playbackStatusUpdate', (status: Partial<AudioStatus>) => {
      if (status.error) {
        erroredAt.current = Date.now();
        clearTimeout(pauseCheck.current);
        scheduleRetry();
        return;
      }
      if (status.didJustFinish) {
        scheduleRetry();
        return;
      }
      if (status.playing) {
        clearTimeout(pauseCheck.current);
        if (!wantPlay.current) {
          // Se reanudó desde la pantalla de bloqueo o los auriculares.
          wantPlay.current = true;
          retry.current = 0;
          if (Date.now() - pausedAt.current > STALE_MS) {
            setState('loading');
            connect();
            return;
          }
        }
        if (status.isBuffering) {
          if (stateRef.current !== 'error') setState('loading');
        } else {
          retry.current = 0;
          if (stateRef.current !== 'playing') setState('playing');
        }
        return;
      }
      if (!wantPlay.current || status.playing === undefined) return;
      const settled = Date.now() - connectedAt.current > 2000;
      if (stateRef.current === 'playing' && settled && status.timeControlStatus === 'paused') {
        // Pausa desde fuera de la app (o un corte: se distingue esperando un posible error).
        clearTimeout(pauseCheck.current);
        pauseCheck.current = setTimeout(() => {
          if (!wantPlay.current || getPlayer().playing) return;
          if (Date.now() - erroredAt.current < 1500) return;
          stop();
        }, 600);
      } else if (stateRef.current === 'playing') {
        setState('loading');
      }
    });

    return () => {
      sub.remove();
      clearTimeout(retryTimer.current);
      clearTimeout(watchdog.current);
      clearTimeout(pauseCheck.current);
    };
  }, [connect, scheduleRetry, setState, stop]);

  // La pantalla de bloqueo muestra la canción en curso.
  useEffect(() => {
    if (stateRef.current === 'idle' && !pausedAt.current) return;
    getPlayer().updateLockScreenMetadata(metadata());
  }, [info.title, info.artist, info.artworkUrl]);

  return { state, play, stop, toggle };
}
