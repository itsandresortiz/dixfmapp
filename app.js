(() => {
  'use strict';

  // ── Configuración de la emisora ──────────────────────────────────────────
  const STATION = 'Dix FM';
  const BASE = 'https://radio25.virtualtronics.com/proxy/dixfm?mp=';
  const STREAM = BASE + '/stream';
  const POLL_MS = 12000;
  const HISTORY_MAX = 40;

  const $ = (id) => document.getElementById(id);
  const el = {
    status: $('status'), cover: $('cover'), art: $('art'), title: $('title'), artist: $('artist'),
    metaText: document.querySelector('.meta-text'), fav: $('fav'), viz: $('viz'), play: $('play'),
    sleepBtn: $('sleepBtn'), sleepBadge: $('sleepBadge'), sleepDialog: $('sleepDialog'), sleepOff: $('sleepOff'),
    share: $('share'), volume: $('volume'), panel: $('panel'), panelToggle: $('panelToggle'),
    panelClose: $('panelClose'), backdrop: $('backdrop'), tabRecent: $('tabRecent'), tabFavs: $('tabFavs'),
    list: $('list'), toast: $('toast'),
  };

  const store = {
    get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento */ } },
  };

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // En iOS, pasar el audio por Web Audio lo silencia con la pantalla bloqueada.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // ── Audio ────────────────────────────────────────────────────────────────
  const audio = new Audio();
  audio.preload = 'none';
  audio.crossOrigin = 'anonymous';

  let state = 'idle';      // idle | loading | playing | error
  let wantPlay = false;
  let retry = 0;
  let retryTimer = 0;
  let audioCtx = null;
  let analyser = null;
  let bins = null;

  const STATUS_TEXT = { idle: 'En pausa', loading: 'Conectando…', playing: 'En vivo', error: 'Sin señal. Reintentando…' };

  function setState(next) {
    state = next;
    el.status.dataset.state = next;
    el.status.textContent = STATUS_TEXT[next];
    el.play.dataset.state = next;
    el.play.setAttribute('aria-label', next === 'idle' ? 'Reproducir' : 'Pausar');
    el.cover.classList.toggle('is-playing', next === 'playing');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = next === 'idle' ? 'paused' : 'playing';
    if (next === 'playing') startViz(); else stopViz();
  }

  function setupAnalyser() {
    if (audioCtx || isIOS) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      audioCtx = new AC();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      audioCtx.createMediaElementSource(audio).connect(analyser);
      analyser.connect(audioCtx.destination);
      bins = new Uint8Array(analyser.frequencyBinCount);
    } catch { analyser = null; }
  }

  function connect() {
    clearTimeout(retryTimer);
    // Cada conexión es nueva para sonar siempre en directo, nunca desde un búfer viejo.
    audio.src = STREAM + '&t=' + Date.now();
    audio.play().catch((err) => {
      if (err && err.name === 'NotAllowedError') { wantPlay = false; setState('idle'); }
    });
  }

  function play() {
    wantPlay = true;
    retry = 0;
    setState('loading');
    setupAnalyser();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    connect();
    pollNow();
  }

  function stop() {
    wantPlay = false;
    clearTimeout(retryTimer);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    setState('idle');
  }

  function scheduleRetry() {
    if (!wantPlay) return;
    setState('error');
    clearTimeout(retryTimer);
    const delay = Math.min(15000, 1000 * 2 ** retry++);
    retryTimer = setTimeout(() => { if (wantPlay) connect(); }, delay);
  }

  audio.addEventListener('playing', () => { retry = 0; setState('playing'); });
  audio.addEventListener('waiting', () => { if (wantPlay) setState('loading'); });
  audio.addEventListener('error', scheduleRetry);
  audio.addEventListener('ended', scheduleRetry);
  audio.addEventListener('stalled', () => { if (wantPlay && state === 'playing') setState('loading'); });
  // Pausa desde fuera de la app (auriculares, otra app, pantalla de bloqueo).
  audio.addEventListener('pause', () => { if (wantPlay && !audio.ended && audio.error == null) stop(); });
  addEventListener('online', () => { if (wantPlay && state === 'error') { retry = 0; connect(); } });

  el.play.addEventListener('click', () => (wantPlay ? stop() : play()));
  addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.target.closest('button, input, a, dialog')) return;
    e.preventDefault();
    wantPlay ? stop() : play();
  });

  // Volumen
  const savedVolume = store.get('dix.volume', 1);
  audio.volume = savedVolume;
  el.volume.value = savedVolume;
  const paintVolume = () => el.volume.style.setProperty('--v', el.volume.value * 100 + '%');
  paintVolume();
  el.volume.addEventListener('input', () => {
    audio.volume = +el.volume.value;
    paintVolume();
    store.set('dix.volume', audio.volume);
  });

  // ── Qué está sonando ─────────────────────────────────────────────────────
  let jsonpId = 0;
  function jsonp(buildUrl, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const name = '__dix' + Date.now().toString(36) + jsonpId++;
      const script = document.createElement('script');
      const finish = (fn, value) => { clearTimeout(timer); script.remove(); window[name] = () => { delete window[name]; }; fn(value); };
      const timer = setTimeout(() => finish(reject, new Error('timeout')), timeout);
      window[name] = (data) => finish(resolve, data);
      script.onerror = () => finish(reject, new Error('network'));
      script.src = buildUrl(name);
      document.head.append(script);
    });
  }

  const fetchStats = () => jsonp((cb) => BASE + encodeURIComponent(`/stats?json=1&callback=${cb}`));

  const artCache = new Map();
  function fetchArt(song) {
    if (artCache.has(song.key)) return Promise.resolve(artCache.get(song.key));
    const clean = (s) => s.replace(/\s*[([][^)\]]*[)\]]/g, '').replace(/\s+(feat|ft)\.?\s.*$/i, '');
    const term = encodeURIComponent(`${clean(song.artist)} ${clean(song.title)}`);
    return jsonp((cb) => `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=1&callback=${cb}`)
      .then((data) => {
        const hit = data && data.results && data.results[0];
        const info = hit ? { art: hit.artworkUrl100.replace('100x100', '600x600'), thumb: hit.artworkUrl100, url: hit.trackViewUrl } : {};
        artCache.set(song.key, info);
        return info;
      })
      .catch(() => ({}));
  }

  function parseSong(raw) {
    const text = (raw || '').trim();
    const cut = text.indexOf(' - ');
    const artist = cut > 0 ? text.slice(0, cut).trim() : '';
    const title = cut > 0 ? text.slice(cut + 3).trim() : text;
    // Cuñas e identificaciones de la emisora no son canciones.
    if (!artist || !title || /^dix\s*fm/i.test(artist)) return null;
    return { key: text.toLowerCase(), title, artist };
  }

  let current = null;      // canción en curso, o null si es una cuña
  let currentKey;          // último texto recibido del servidor
  let history = store.get('dix.history', []);
  let favs = store.get('dix.favs', []);
  let tab = 'recent';

  function showSong(song) {
    current = song;
    el.title.textContent = song ? song.title : STATION;
    el.artist.textContent = song ? song.artist : 'Radio en vivo';
    el.metaText.classList.remove('swap');
    void el.metaText.offsetWidth;
    el.metaText.classList.add('swap');
    el.fav.disabled = !song;
    syncFav();
    setArt(null);
    updateMediaSession();
    if (!song) return;

    const entry = { ...song, t: Date.now() };
    history = [entry, ...history.filter((h) => h.key !== song.key)].slice(0, HISTORY_MAX);
    store.set('dix.history', history);
    renderList();

    fetchArt(song).then((info) => {
      if (current !== song || !info.art) return;
      Object.assign(song, info);
      Object.assign(entry, info);
      store.set('dix.history', history);
      setArt(info.art);
      updateMediaSession();
      renderList();
    });
  }

  let pollTimer = 0;
  function pollNow() {
    clearTimeout(pollTimer);
    fetchStats()
      .then((stats) => {
        const raw = stats && stats.songtitle;
        if (raw === currentKey) return;
        currentKey = raw;
        showSong(parseSong(raw));
      })
      .catch(() => {})
      .finally(() => {
        // En segundo plano solo seguimos consultando si la radio está sonando.
        if (!document.hidden || wantPlay) pollTimer = setTimeout(pollNow, document.hidden ? POLL_MS * 2 : POLL_MS);
      });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pollNow(); });

  // ── Carátula y color ─────────────────────────────────────────────────────
  const BRAND = ['#5b2eff', '#ff3d77', '#ffa53b'];
  const root = document.documentElement;
  const setColors = (c) => c.forEach((v, i) => root.style.setProperty('--c' + (i + 1), v));

  function hashColors(text) {
    let h = 0;
    for (const ch of text) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    const hue = h % 360;
    return [`hsl(${hue} 78% 46%)`, `hsl(${(hue + 48) % 360} 82% 52%)`, `hsl(${(hue + 310) % 360} 80% 56%)`];
  }

  function extractColors(img) {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max ? (max - min) / max : 0;
      const key = (r >> 6) << 4 | (g >> 6) << 2 | (b >> 6);
      const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0, w: 0 };
      bucket.r += r; bucket.g += g; bucket.b += b; bucket.n++;
      bucket.w += 0.15 + sat * (max / 255);
      buckets.set(key, bucket);
    }
    const top = [...buckets.values()].sort((a, b) => b.w - a.w).slice(0, 3);
    while (top.length < 3) top.push(top[0]);
    return top.map((k) => {
      // Aclarar los tonos casi negros para que el fondo no se apague.
      let [r, g, b] = [k.r / k.n, k.g / k.n, k.b / k.n];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < 60) { const lift = 60 - lum; r += lift; g += lift; b += lift * 1.25; }
      return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(Math.min(255, b))})`;
    });
  }

  let artToken = 0;
  function setArt(url) {
    const token = ++artToken;
    el.art.classList.remove('is-ready');
    if (!url) {
      el.art.hidden = true;
      setColors(current ? hashColors(current.key) : BRAND);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (token !== artToken) return;
      el.art.src = url;
      el.art.hidden = false;
      requestAnimationFrame(() => el.art.classList.add('is-ready'));
      try { setColors(extractColors(img)); } catch { /* imagen sin CORS: se quedan los colores por título */ }
    };
    img.src = url;
    if (current) setColors(hashColors(current.key));
  }

  // ── Controles del sistema (pantalla de bloqueo, auriculares, CarPlay…) ───
  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const icon = new URL('icons/icon-512.png', location.href).href;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current ? current.title : STATION,
      artist: current ? current.artist : 'Radio en vivo',
      album: STATION,
      artwork: current && current.art
        ? [{ src: current.art, sizes: '600x600', type: 'image/jpeg' }]
        : [{ src: icon, sizes: '512x512', type: 'image/png' }],
    });
  }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', play);
    navigator.mediaSession.setActionHandler('pause', stop);
    try { navigator.mediaSession.setActionHandler('stop', stop); } catch { /* no soportado */ }
  }

  // ── Onda en vivo ─────────────────────────────────────────────────────────
  const vctx = el.viz.getContext('2d');
  const BARS = 44;
  const levels = new Float32Array(BARS);
  let vizRaf = 0;
  let vw = 0, vh = 0;

  function sizeViz() {
    const dpr = Math.min(devicePixelRatio || 1, 3);
    const rect = el.viz.getBoundingClientRect();
    vw = rect.width; vh = rect.height;
    el.viz.width = Math.round(vw * dpr);
    el.viz.height = Math.round(vh * dpr);
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawViz();
  }

  function drawViz() {
    vctx.clearRect(0, 0, vw, vh);
    const step = vw / BARS;
    const w = Math.max(2, step * 0.46);
    const live = state === 'playing';
    vctx.fillStyle = live ? 'rgb(255 255 255 / .92)' : 'rgb(255 255 255 / .38)';
    for (let i = 0; i < BARS; i++) {
      const h = Math.max(w, levels[i] * vh);
      vctx.beginPath();
      vctx.roundRect(i * step + (step - w) / 2, (vh - h) / 2, w, h, w / 2);
      vctx.fill();
    }
  }

  function tickViz(now) {
    if (analyser) analyser.getByteFrequencyData(bins);
    for (let i = 0; i < BARS; i++) {
      // Las barras se reflejan desde el centro: graves en medio, agudos a los lados.
      const d = Math.abs(i - (BARS - 1) / 2) / (BARS / 2);
      let target;
      if (analyser) {
        const bin = Math.round(2 + d ** 1.5 * 70);
        target = (bins[bin] / 255) ** 2 * (0.8 + d * 0.5);
      } else {
        const t = now / 1000;
        target = (0.5 + 0.5 * Math.sin(t * 5.1 + i * 0.9)) * (0.5 + 0.5 * Math.sin(t * 2.3 - i * 0.37)) * (1 - d * 0.55) * 0.85 + 0.06;
      }
      levels[i] += (Math.min(1, target) - levels[i]) * 0.35;
    }
    drawViz();
    vizRaf = requestAnimationFrame(tickViz);
  }

  function startViz() {
    cancelAnimationFrame(vizRaf);
    if (reducedMotion) { levels.forEach((_, i) => { levels[i] = 0.25 + 0.5 * Math.abs(Math.sin(i * 1.7)); }); drawViz(); return; }
    vizRaf = requestAnimationFrame(tickViz);
  }

  function stopViz() {
    cancelAnimationFrame(vizRaf);
    const settle = () => {
      let moving = false;
      for (let i = 0; i < BARS; i++) { levels[i] *= 0.8; if (levels[i] > 0.01) moving = true; else levels[i] = 0; }
      drawViz();
      if (moving && state !== 'playing') vizRaf = requestAnimationFrame(settle);
    };
    settle();
  }
  new ResizeObserver(sizeViz).observe(el.viz);

  // ── Favoritas y recientes ────────────────────────────────────────────────
  const isFav = (key) => favs.some((f) => f.key === key);

  function syncFav() {
    const on = !!current && isFav(current.key);
    el.fav.setAttribute('aria-pressed', on);
    el.fav.setAttribute('aria-label', on ? 'Quitar de favoritas' : 'Guardar en favoritas');
  }

  el.fav.addEventListener('click', () => {
    if (!current) return;
    if (isFav(current.key)) {
      favs = favs.filter((f) => f.key !== current.key);
      toast('Quitada de favoritas');
    } else {
      favs = [{ ...current, t: Date.now() }, ...favs];
      toast('Guardada en favoritas');
    }
    store.set('dix.favs', favs);
    syncFav();
    renderList();
  });

  const timeFmt = new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' });

  function renderList() {
    const items = tab === 'recent' ? history : favs;
    el.list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = tab === 'recent'
        ? 'Las canciones que suenen en Dix FM aparecerán aquí.'
        : 'Toca el corazón mientras suena una canción para guardarla aquí.';
      el.list.append(empty);
      return;
    }
    for (const item of items) {
      const li = document.createElement('li');
      const thumb = document.createElement(item.thumb ? 'img' : 'div');
      thumb.className = 'thumb';
      if (item.thumb) { thumb.src = item.thumb; thumb.alt = ''; thumb.loading = 'lazy'; }
      const txt = document.createElement('div');
      txt.className = 'txt';
      const b = document.createElement('b'); b.textContent = item.title;
      const span = document.createElement('span'); span.textContent = item.artist;
      txt.append(b, span);
      li.append(thumb, txt);
      if (item.url) {
        const a = document.createElement('a');
        a.href = item.url; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = 'Abrir';
        a.setAttribute('aria-label', `Abrir ${item.title} en Apple Music`);
        li.append(a);
      }
      if (tab === 'recent') {
        const time = document.createElement('time');
        time.dateTime = new Date(item.t).toISOString();
        time.textContent = timeFmt.format(item.t);
        li.append(time);
      } else {
        const rm = document.createElement('button');
        rm.className = 'icon-btn rm'; rm.type = 'button';
        rm.setAttribute('aria-label', `Quitar ${item.title} de favoritas`);
        rm.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"/></svg>';
        rm.addEventListener('click', () => {
          favs = favs.filter((f) => f.key !== item.key);
          store.set('dix.favs', favs);
          syncFav();
          renderList();
        });
        li.append(rm);
      }
      el.list.append(li);
    }
  }

  function setTab(next) {
    tab = next;
    el.tabRecent.setAttribute('aria-selected', next === 'recent');
    el.tabFavs.setAttribute('aria-selected', next === 'favs');
    renderList();
  }
  el.tabRecent.addEventListener('click', () => setTab('recent'));
  el.tabFavs.addEventListener('click', () => setTab('favs'));

  // Hoja inferior en móvil; en escritorio el panel está siempre visible.
  const wide = matchMedia('(min-width: 940px)');
  function setPanel(open) {
    el.panel.classList.toggle('is-open', open);
    el.backdrop.hidden = !open;
    el.panelToggle.setAttribute('aria-expanded', open);
    el.panel.inert = !open && !wide.matches;
    if (open) el.panelClose.focus(); else if (!wide.matches && document.activeElement === document.body) el.panelToggle.focus();
  }
  el.panelToggle.addEventListener('click', () => setPanel(true));
  el.panelClose.addEventListener('click', () => { setPanel(false); el.panelToggle.focus(); });
  el.backdrop.addEventListener('click', () => setPanel(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.panel.classList.contains('is-open')) { setPanel(false); el.panelToggle.focus(); } });
  wide.addEventListener('change', () => setPanel(false));
  el.panel.inert = !wide.matches;

  // ── Temporizador de apagado ──────────────────────────────────────────────
  let sleepAt = 0;
  let sleepTick = 0;

  function paintSleep() {
    const left = sleepAt - Date.now();
    if (!sleepAt || left <= 0) {
      if (sleepAt) { stop(); toast('Temporizador terminado'); }
      sleepAt = 0;
      clearInterval(sleepTick);
      el.sleepBadge.hidden = true;
      el.sleepBtn.classList.remove('is-on');
      el.sleepBtn.setAttribute('aria-label', 'Temporizador de apagado');
      return;
    }
    const mins = Math.ceil(left / 60000);
    el.sleepBadge.hidden = false;
    el.sleepBadge.textContent = mins;
    el.sleepBtn.classList.add('is-on');
    el.sleepBtn.setAttribute('aria-label', `Temporizador: quedan ${mins} minutos`);
  }

  el.sleepBtn.addEventListener('click', () => { el.sleepOff.hidden = !sleepAt; el.sleepDialog.showModal(); });
  el.sleepDialog.addEventListener('click', (e) => { if (e.target === el.sleepDialog) el.sleepDialog.close(''); });
  el.sleepDialog.addEventListener('close', () => {
    const value = el.sleepDialog.returnValue;
    if (value === '') return;
    const mins = +value;
    clearInterval(sleepTick);
    if (!mins) { sleepAt = 0; paintSleep(); toast('Temporizador quitado'); return; }
    sleepAt = Date.now() + mins * 60000;
    sleepTick = setInterval(paintSleep, 5000);
    paintSleep();
    toast(mins === 60 ? 'La radio se apagará en 1 hora' : `La radio se apagará en ${mins} minutos`);
  });

  // ── Compartir ────────────────────────────────────────────────────────────
  el.share.addEventListener('click', async () => {
    const text = current ? `Escuchando «${current.title}» de ${current.artist} en ${STATION}` : `Escucha ${STATION} en vivo`;
    const url = location.href.split('#')[0];
    if (navigator.share) {
      try { await navigator.share({ title: STATION, text, url }); } catch { /* cancelado */ }
      return;
    }
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast('Enlace copiado'); }
    catch { toast('No se pudo copiar el enlace'); }
  });

  let toastTimer = 0;
  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), 2200);
  }

  // ── Arranque ─────────────────────────────────────────────────────────────
  renderList();
  updateMediaSession();
  pollNow();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
