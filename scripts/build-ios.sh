#!/bin/bash
# Compila Dix FM para iOS y deja un .ipa listo para subir con Transporter.
# Requiere un Mac con Xcode instalado (no hace falta abrirlo) y que el
# identificador com.dixfm.app exista en App Store Connect.
#
# Firma, opción A: sin abrir Xcode, con una clave de API de App Store Connect
# (Usuarios y acceso > Integraciones > API de App Store Connect, rol Admin):
#
#   APPLE_TEAM_ID=ABCDE12345 ASC_KEY_ID=XXXXXXXXXX ASC_ISSUER_ID=xxxxxxxx-xxxx-... \
#   ASC_KEY_PATH=~/Downloads/AuthKey_XXXXXXXXXX.p8 ./scripts/build-ios.sh
#
# Añade UPLOAD=1 para enviarlo directamente a App Store Connect / TestFlight
# al terminar, sin pasar por Transporter (requiere la clave de API).
#
# Firma, opción B: con tu cuenta ya iniciada en Xcode (Settings > Accounts):
#
#   APPLE_TEAM_ID=ABCDE12345 ./scripts/build-ios.sh
set -euo pipefail
cd "$(dirname "$0")/.."

: "${APPLE_TEAM_ID:?Indica tu Team ID: APPLE_TEAM_ID=XXXXXXXXXX ./scripts/build-ios.sh}"
export APPLE_TEAM_ID

AUTH=()
if [ -n "${ASC_KEY_PATH:-}" ]; then
  : "${ASC_KEY_ID:?Falta ASC_KEY_ID}" "${ASC_ISSUER_ID:?Falta ASC_ISSUER_ID}"
  KEY_PATH="${ASC_KEY_PATH/#\~/$HOME}"
  [ -f "$KEY_PATH" ] || { echo "No existe el archivo de clave: $KEY_PATH" >&2; exit 1; }
  AUTH=(-authenticationKeyPath "$(cd "$(dirname "$KEY_PATH")" && pwd)/$(basename "$KEY_PATH")"
        -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
fi

DESTINATION=export
if [ "${UPLOAD:-0}" = "1" ]; then
  [ ${#AUTH[@]} -gt 0 ] || { echo "UPLOAD=1 necesita la clave de API (ASC_KEY_PATH, ASC_KEY_ID, ASC_ISSUER_ID)" >&2; exit 1; }
  DESTINATION=upload
fi

npm install
npx expo prebuild --platform ios --clean

BUILD_DIR="$PWD/build"
ARCHIVE="$BUILD_DIR/DixFM.xcarchive"
rm -rf "$ARCHIVE" "$BUILD_DIR/ipa"
mkdir -p "$BUILD_DIR"

cd ios
WORKSPACE=$(ls -d *.xcworkspace 2>/dev/null | head -1 || true)
if [ -n "$WORKSPACE" ]; then
  SCHEME="${WORKSPACE%.xcworkspace}"
  TARGET=(-workspace "$WORKSPACE")
else
  PROJECT=$(ls -d *.xcodeproj | head -1)
  SCHEME="${PROJECT%.xcodeproj}"
  TARGET=(-project "$PROJECT")
fi

xcodebuild "${TARGET[@]}" -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"} archive

cat > "$BUILD_DIR/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>${DESTINATION}</string>
  <key>teamID</key><string>${APPLE_TEAM_ID}</string>
  <key>signingStyle</key><string>automatic</string>
</dict>
</plist>
PLIST

xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$BUILD_DIR/ipa" \
  -exportOptionsPlist "$BUILD_DIR/ExportOptions.plist" -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"}

echo
if [ "$DESTINATION" = "upload" ]; then
  echo "Listo. La compilación se envió a App Store Connect; aparecerá en TestFlight cuando Apple termine de procesarla."
else
  echo "Listo. Arrastra este archivo a Transporter:"
  ls "$BUILD_DIR"/ipa/*.ipa
fi
