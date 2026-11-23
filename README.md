# Dix FM

App nativa de Dix FM para iOS y Android, hecha con Expo (React Native): un solo código, interfaz y audio nativos.

## Qué incluye

- Radio en directo con audio nativo: sigue sonando en segundo plano y con la pantalla bloqueada.
- Controles y carátula en la pantalla de bloqueo, auriculares y coche.
- Canción en curso, carátula y enlace a Apple Music.
- Fondo que toma los colores de la carátula; Liquid Glass en los iPhone que lo soportan.
- Carátula difuminada que se funde con el fondo; diseño horizontal para iPhone, iPad y plegables.
- Botón de AirPlay (iOS) para enviar el audio a altavoces o a la tele.
- Widgets de iOS (pantalla de inicio y de bloqueo) con la canción y su carátula.
- Temporizador de apagado, recientes, favoritas y compartir.
- Reconexión automática si se cae la señal.

## Estructura

- `App.tsx` y `src/`: la app. El stream, los textos y los colores están en `src/config.ts`.
- `assets/`: icono, splash y logo.
- `app.json`: nombre, identificadores (iOS `com.dixfm.app`, Android `dix.fm`) y permisos.
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

Requiere Java 17 y el SDK de Android. APK para instalar y probar:

```bash
./scripts/build-android.sh
```

AAB firmado para Google Play (paquete `dix.fm`):

```bash
./scripts/build-android.sh aab
```

La primera vez crea tu clave de subida en `~/dixfm-upload.jks` (fuera del proyecto) y deja su certificado en `build/upload_certificate.pem`, que es lo que Google pide para registrarla. Guarda una copia de la clave y su contraseña: sin ellas no se pueden publicar actualizaciones. El código de versión se genera solo y sube en cada compilación.

Cada push también compila en GitHub Actions: el APK de prueba queda como artefacto del workflow "Build".

La tipografía es Bricolage Grotesque (SIL Open Font License 1.1).
