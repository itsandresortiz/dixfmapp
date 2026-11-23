# Dix FM

App web instalable (PWA) para escuchar Dix FM en vivo. Sin dependencias ni paso de compilación: son archivos estáticos.

## Qué incluye

- Reproducción en directo con reconexión automática si se cae la señal.
- Canción en curso, carátula y enlace a Apple Music (búsqueda de iTunes).
- Fondo que toma los colores de la carátula y onda que reacciona al audio.
- Controles en la pantalla de bloqueo, auriculares y coche (Media Session).
- Canciones recientes, favoritas, temporizador de apagado y compartir.
- Instalable en iPhone, Android y escritorio; la interfaz abre sin conexión.

## Probarla en local

```bash
python3 -m http.server 8080
```

Luego abre `http://localhost:8080`.

## Publicarla

Sube la carpeta a cualquier hosting estático con HTTPS (GitHub Pages, Netlify, Vercel, Cloudflare Pages). HTTPS es obligatorio para que se pueda instalar.

## Ajustes

- Stream y nombre de la emisora: constantes al inicio de `app.js`.
- Colores de marca: `--c1`, `--c2`, `--c3` en `styles.css` y `BRAND` en `app.js`.
- Logo: `logo.svg`. Iconos: carpeta `icons/`.
- Al cambiar archivos, sube el número de `CACHE` en `sw.js` para que los usuarios reciban la versión nueva.

La tipografía es Bricolage Grotesque (SIL Open Font License 1.1).
