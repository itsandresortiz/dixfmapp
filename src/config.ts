export const STATION = 'Dix FM';
export const TAGLINE = 'Radio en vivo';

const BASE = 'https://radio25.virtualtronics.com/proxy/dixfm?mp=';
export const STREAM_URL = BASE + '/stream';
export const STATS_URL = BASE + encodeURIComponent('/stats?sid=1&json=1');

export const POLL_MS = 12000;
export const HISTORY_MAX = 40;

export const colors = {
  ink: '#0d0820',
  violet: '#6f6bff',
  coral: '#ff5a5f',
  mint: '#00d9a3',
  live: '#ff375f',
  text: '#ffffff',
  text2: 'rgba(255,255,255,0.68)',
  text3: 'rgba(255,255,255,0.45)',
  glass: 'rgba(255,255,255,0.14)',
  sheet: '#1a1430',
};

export const fonts = {
  display: 'BricolageGrotesque_700Bold',
};
