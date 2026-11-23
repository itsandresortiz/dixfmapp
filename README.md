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

## Compilar iOS y enviar a TestFlight

Necesitas un Mac con Xcode instalado (no hace falta abrirlo), la app creada en App Store Connect con el ID de pack `com.dixfm.app` y una clave de API de App Store Connect (Usuarios y acceso > Integraciones, acceso Admin) descargada en Descargas.

```bash
./scripts/build-ios.sh
```

La primera vez pregunta el Issuer ID y el Team ID y los guarda en `.ios-build.env`. Al terminar, la compilación aparece en TestFlight cuando Apple la procesa. Con `UPLOAD=0` delante solo genera el `.ipa` en `build/ipa/` para subirlo con Transporter.

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
