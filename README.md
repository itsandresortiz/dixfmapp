# Dix FM

App nativa de Dix FM para iOS y Android, hecha con Expo (React Native): un solo código, interfaz y audio nativos.

## Qué incluye

- Radio en directo con audio nativo: sigue sonando en segundo plano y con la pantalla bloqueada.
- Controles y carátula en la pantalla de bloqueo, auriculares y coche.
- Canción en curso, carátula y enlace a Apple Music.
- Fondo que toma los colores de la carátula; Liquid Glass en los iPhone que lo soportan.
- Carátula a pantalla completa al tocarla; diseño horizontal para iPhone, iPad y plegables.
- Botón de AirPlay (iOS) para enviar el audio a altavoces o a la tele.
- Widget de pantalla de inicio (iOS) con la canción que suena.
- Despertador diario, temporizador de apagado, recientes, favoritas y compartir.
- Reconexión automática si se cae la señal.

## Estructura

- `App.tsx` y `src/`: la app. El stream, los textos y los colores están en `src/config.ts`.
- `assets/`: icono, splash y logo.
- `app.json`: nombre, identificador (`com.dixfm.app`) y permisos.
- `modules/airplay-button/`: módulo nativo del botón de AirPlay.
- `scripts/`: compilación por terminal.
- `web/`: versión web instalable (PWA), independiente de la app nativa.

## Probar mientras desarrollas

```bash
npm install
```

```bash
npx expo run:ios
```

```bash
npx expo run:android
```

## Compilar iOS

Necesitas un Mac con Xcode instalado (no hace falta abrirlo), tu cuenta de Apple Developer ya configurada para firmar y la app creada en App Store Connect con el ID de pack `com.dixfm.app`.

```bash
./scripts/build-ios.sh
```

Deja el `.ipa` en `build/ipa/` para subirlo con Transporter. El Team ID se detecta de tus certificados; si no puede, lo pregunta una vez.

Para enviarlo directo a TestFlight con una clave de API de App Store Connect:

```bash
UPLOAD=1 ./scripts/build-ios.sh
```

El script pone un número de compilación nuevo en cada ejecución. Para publicar una versión nueva en la tienda, aumenta `version` en `app.json`.

## Compilar Android

APK para instalar y probar:

```bash
./scripts/build-android.sh
```

Para Google Play hace falta un AAB firmado con tu clave de subida. Lo más simple es dejar que Expo la gestione:

```bash
npx eas-cli@latest build --platform android
```

Cada push también compila en GitHub Actions: el APK de prueba queda como artefacto del workflow "Build".

La tipografía es Bricolage Grotesque (SIL Open Font License 1.1).
