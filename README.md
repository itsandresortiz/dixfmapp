# Dix FM

App nativa de Dix FM para iOS y Android, hecha con Expo (React Native): un solo código, interfaz y audio nativos.

## Qué incluye

- Radio en directo con audio nativo: sigue sonando en segundo plano y con la pantalla bloqueada.
- Controles y carátula en la pantalla de bloqueo, auriculares y coche.
- Canción en curso, carátula y enlace a Apple Music.
- Fondo que toma los colores de la carátula; Liquid Glass en los iPhone que lo soportan.
- Canciones recientes, favoritas, temporizador de apagado y compartir.
- Reconexión automática si se cae la señal.

## Estructura

- `App.tsx` y `src/`: la app. El stream, los textos y los colores están en `src/config.ts`.
- `assets/`: icono, splash y logo.
- `app.json`: nombre, identificador (`com.dixfm.app`) y permisos.
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

## Compilar iOS y subir con Transporter

Necesitas un Mac con Xcode instalado y la app creada en App Store Connect con el ID de pack `com.dixfm.app`. Todo se hace por terminal.

Sin abrir Xcode, con una clave de API de App Store Connect (Usuarios y acceso > Integraciones, rol Admin):

```bash
APPLE_TEAM_ID=TU_TEAM_ID ASC_KEY_ID=ID_DE_CLAVE ASC_ISSUER_ID=ISSUER_ID ASC_KEY_PATH=~/Downloads/AuthKey_ID_DE_CLAVE.p8 ./scripts/build-ios.sh
```

O, si tu cuenta ya está iniciada en Xcode (Settings > Accounts):

```bash
APPLE_TEAM_ID=TU_TEAM_ID ./scripts/build-ios.sh
```

El `.ipa` queda en `build/ipa/`. Arrástralo a Transporter y pulsa "Entregar".

Antes de cada subida nueva, aumenta `version` en `app.json` (o añade `ios.buildNumber`): App Store Connect rechaza números de compilación repetidos.

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
