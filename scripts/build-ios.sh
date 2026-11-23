#!/bin/bash
# Compila Dix FM para iOS por terminal (Xcode instalado, sin abrirlo).
#
#   ./scripts/build-ios.sh            -> deja el .ipa en build/ipa/ para Transporter
#   UPLOAD=1 ./scripts/build-ios.sh   -> además lo envía a TestFlight (clave de API)
#
# Firma con la cuenta de Apple Developer que ya tengas configurada en este Mac.
# El Team ID se detecta de tus certificados; si no puede, lo pregunta una vez
# y lo guarda en .ios-build.env (fuera de git).
set -euo pipefail
cd "$(dirname "$0")/.."

CONFIG=.ios-build.env
[ -f "$CONFIG" ] && source "$CONFIG"

ask() { # ask VARIABLE "pregunta"
  local value="${!1:-}"
  while [ -z "$value" ]; do
    read -r -p "$2: " value
    value="${value//[[:space:]]/}"
  done
  printf -v "$1" '%s' "$value"
}

# Team ID: va entre paréntesis en el nombre de tus certificados de distribución.
if [ -z "${APPLE_TEAM_ID:-}" ]; then
  TEAMS=$(security find-identity -v -p codesigning 2>/dev/null | grep Distribution | sed -n 's/.*(\([A-Z0-9]\{10\}\))".*/\1/p' | sort -u)
  if [ "$(printf '%s\n' "$TEAMS" | grep -c .)" = "1" ]; then
    APPLE_TEAM_ID="$TEAMS"
    echo "Team ID detectado: $APPLE_TEAM_ID"
  elif [ -n "$TEAMS" ]; then
    echo "Hay certificados de varios equipos en este Mac:"
    security find-identity -v -p codesigning | grep Distribution | sed -n 's/.*"\(.*\)".*/  \1/p' | sort -u
  fi
fi
ask APPLE_TEAM_ID "Team ID (10 caracteres, en developer.apple.com > Cuenta > Membresía)"
export APPLE_TEAM_ID

AUTH=()
DESTINATION=export
if [ "${UPLOAD:-0}" = "1" ]; then
  # Envío directo: necesita una clave de API de App Store Connect.
  if [ -z "${ASC_KEY_PATH:-}" ]; then
    ASC_KEY_PATH=$(ls -t "$HOME"/Downloads/AuthKey_*.p8 "$HOME"/.appstoreconnect/private_keys/AuthKey_*.p8 "$HOME"/private_keys/AuthKey_*.p8 2>/dev/null | head -1 || true)
    [ -n "$ASC_KEY_PATH" ] && echo "Clave de API encontrada: $ASC_KEY_PATH"
  fi
  ask ASC_KEY_PATH "Ruta del archivo AuthKey_XXXXXXXXXX.p8"
  ASC_KEY_PATH="${ASC_KEY_PATH/#\~/$HOME}"
  [ -f "$ASC_KEY_PATH" ] || { echo "No existe el archivo de clave: $ASC_KEY_PATH" >&2; exit 1; }
  if [ -z "${ASC_KEY_ID:-}" ]; then
    ASC_KEY_ID=$(basename "$ASC_KEY_PATH" .p8)
    ASC_KEY_ID="${ASC_KEY_ID#AuthKey_}"
  fi
  ask ASC_ISSUER_ID "Issuer ID (encima de la lista de claves en App Store Connect)"
  AUTH=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
  DESTINATION=upload
fi

{
  echo "APPLE_TEAM_ID=\"$APPLE_TEAM_ID\""
  [ -n "${ASC_KEY_PATH:-}" ] && echo "ASC_KEY_PATH=\"$ASC_KEY_PATH\""
  [ -n "${ASC_KEY_ID:-}" ] && echo "ASC_KEY_ID=\"$ASC_KEY_ID\""
  [ -n "${ASC_ISSUER_ID:-}" ] && echo "ASC_ISSUER_ID=\"$ASC_ISSUER_ID\""
  true
} > "$CONFIG"

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
