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
  <key>destination</key><string>export</string>
  <key>teamID</key><string>${APPLE_TEAM_ID}</string>
  <key>signingStyle</key><string>automatic</string>
</dict>
</plist>
PLIST

xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$BUILD_DIR/ipa" \
  -exportOptionsPlist "$BUILD_DIR/ExportOptions.plist" -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"}

echo
echo "Listo. Arrastra este archivo a Transporter:"
ls "$BUILD_DIR"/ipa/*.ipa
