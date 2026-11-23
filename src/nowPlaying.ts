import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { HISTORY_MAX, POLL_MS, STATS_URL } from './config';

export type Song = {
  key: string;
  title: string;
  artist: string;
  art?: string;
  thumb?: string;
  url?: string;
  t: number;
};

const HISTORY_KEY = 'dix.history';
const FAVS_KEY = 'dix.favs';

export function parseSong(raw: unknown): Song | null {
  const text = typeof raw === 'string' ? raw.trim() : '';
  const cut = text.indexOf(' - ');
  const artist = cut > 0 ? text.slice(0, cut).trim() : '';
  const title = cut > 0 ? text.slice(cut + 3).trim() : text;
  // Cuñas e identificaciones de la emisora no son canciones.
  if (!artist || !title || /^dix\s*fm/i.test(artist)) return null;
  return { key: text.toLowerCase(), title, artist, t: Date.now() };
}

const artCache = new Map<string, Pick<Song, 'art' | 'thumb' | 'url'>>();

async function fetchArt(song: Song) {
  const cached = artCache.get(song.key);
  if (cached) return cached;
  const clean = (s: string) => s.replace(/\s*[([][^)\]]*[)\]]/g, '').replace(/\s+(feat|ft)\.?\s.*$/i, '');
  const term = encodeURIComponent(`${clean(song.artist)} ${clean(song.title)}`);
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=1`);
    const hit = (await res.json())?.results?.[0];
    const info = hit?.artworkUrl100
      ? { art: hit.artworkUrl100.replace('100x100', '600x600') as string, thumb: hit.artworkUrl100 as string, url: hit.trackViewUrl as string | undefined }
      : {};
    artCache.set(song.key, info);
    return info;
  } catch {
    return {};
  }
}

async function load(key: string): Promise<Song[]> {
  try {
    const value = JSON.parse((await AsyncStorage.getItem(key)) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
const save = (key: string, value: Song[]) => AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});

/**
 * Consulta la canción en curso al servidor de la emisora, busca su carátula
 * y mantiene las listas de recientes y favoritas.
 * `keepAlive` mantiene la consulta con la app en segundo plano (mientras suena).
 */
export function useNowPlaying(keepAlive: boolean) {
  const [song, setSong] = useState<Song | null>(null);
  const [history, setHistory] = useState<Song[]>([]);
  const [favs, setFavs] = useState<Song[]>([]);
  const lastRaw = useRef<string | undefined>(undefined);
  const current = useRef<Song | null>(null);
  const keepAliveRef = useRef(keepAlive);
  keepAliveRef.current = keepAlive;

  useEffect(() => {
    load(HISTORY_KEY).then((stored) => setHistory((now) => (now.length ? now : stored)));
    load(FAVS_KEY).then(setFavs);
  }, []);

  const patch = useCallback((key: string, info: Partial<Song>) => {
    setSong((s) => (s && s.key === key ? { ...s, ...info } : s));
    setHistory((list) => {
      const next = list.map((h) => (h.key === key ? { ...h, ...info } : h));
      save(HISTORY_KEY, next);
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(STATS_URL, { cache: 'no-store' });
      const raw: string | undefined = (await res.json())?.songtitle;
      if (raw === lastRaw.current) return;
      lastRaw.current = raw;
      const next = parseSong(raw);
      current.current = next;
      setSong(next);
      if (!next) return;
      setHistory((list) => {
        const merged = [next, ...list.filter((h) => h.key !== next.key)].slice(0, HISTORY_MAX);
        save(HISTORY_KEY, merged);
        return merged;
      });
      const info = await fetchArt(next);
      if (info.art) patch(next.key, info);
    } catch {
      // Sin red: se reintenta en la siguiente consulta.
    }
  }, [patch]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const loop = async () => {
      if (AppState.currentState === 'active' || keepAliveRef.current) await poll();
      if (alive) timer = setTimeout(loop, POLL_MS);
    };
    loop();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') poll();
    });
    return () => {
      alive = false;
      clearTimeout(timer);
      sub.remove();
    };
  }, [poll]);

  const isFav = !!song && favs.some((f) => f.key === song.key);

  const toggleFav = useCallback((target: Song) => {
    setFavs((list) => {
      const next = list.some((f) => f.key === target.key)
        ? list.filter((f) => f.key !== target.key)
        : [{ ...target, t: Date.now() }, ...list];
      save(FAVS_KEY, next);
      return next;
    });
  }, []);

  return { song, history, favs, isFav, toggleFav };
}
