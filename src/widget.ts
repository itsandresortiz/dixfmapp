// El widget de pantalla de inicio solo existe en iOS (ver widget.ios.tsx).
export type WidgetState = { title: string; artist: string; live: boolean; artUrl?: string };

/** Actualiza el widget con lo que suena. Fuera de iOS no hace nada. */
export function updateWidget(_state: WidgetState) {}
