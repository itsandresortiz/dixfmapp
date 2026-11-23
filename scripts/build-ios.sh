#!/bin/bash
# Compila Dix FM para iOS y la envía a TestFlight, todo por terminal.
# Requiere un Mac con Xcode instalado (no hace falta abrirlo) y que el
# identificador com.dixfm.app exista en App Store Connect.
#
#   ./scripts/build-ios.sh
#
# La primera vez pregunta tus datos de Apple y los guarda en .ios-build.env
# (fuera de git) para no volver a pedirlos. Necesitas una clave de API de
# App Store Connect (Usuarios y acceso > Integraciones, acceso Admin) con su
# archivo AuthKey_XXXXXXXXXX.p8 en la carpeta Descargas.
#
# Con UPLOAD=0 no la envía: deja el .ipa en build/ipa/ para Transporter.
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

# Clave de API: se busca sola en Descargas.
if [ -z "${ASC_KEY_PATH:-}" ]; then
  ASC_KEY_PATH=$(ls -t "$HOME"/Downloads/AuthKey_*.p8 2>/dev/null | head -1 || true)
  if [ -n "$ASC_KEY_PATH" ]; then
    echo "Clave de API encontrada: $ASC_KEY_PATH"
  else
    echo "No hay ningún archivo AuthKey_*.p8 en Descargas."
    echo "Créalo en App Store Connect > Usuarios y acceso > Integraciones > API de App Store Connect."
    read -r -p "Arrastra aquí el archivo .p8 y pulsa Enter: " ASC_KEY_PATH
    ASC_KEY_PATH="${ASC_KEY_PATH//\\ / }"
    ASC_KEY_PATH="${ASC_KEY_PATH%"${ASC_KEY_PATH##*[![:space:]]}"}"
  fi
fi
ASC_KEY_PATH="${ASC_KEY_PATH/#\~/$HOME}"
[ -f "$ASC_KEY_PATH" ] || { echo "No existe el archivo de clave: $ASC_KEY_PATH" >&2; exit 1; }

# El ID de clave va en el nombre del archivo: AuthKey_<ID>.p8
if [ -z "${ASC_KEY_ID:-}" ]; then
  ASC_KEY_ID=$(basename "$ASC_KEY_PATH" .p8)
  ASC_KEY_ID="${ASC_KEY_ID#AuthKey_}"
fi
ask ASC_ISSUER_ID "Issuer ID (código largo con guiones, encima de la lista de claves en App Store Connect)"
ask APPLE_TEAM_ID "Team ID (10 caracteres, en developer.apple.com > Cuenta > Membresía)"
export APPLE_TEAM_ID

cat > "$CONFIG" <<ENV
APPLE_TEAM_ID="$APPLE_TEAM_ID"
ASC_KEY_ID="$ASC_KEY_ID"
ASC_ISSUER_ID="$ASC_ISSUER_ID"
ASC_KEY_PATH="$ASC_KEY_PATH"
ENV

AUTH=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")

DESTINATION=upload
[ "${UPLOAD:-1}" = "0" ] && DESTINATION=export

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
  -allowProvisioningUpdates "${AUTH[@]}" archive

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
  -exportOptionsPlist "$BUILD_DIR/ExportOptions.plist" -allowProvisioningUpdates "${AUTH[@]}"

echo
if [ "$DESTINATION" = "upload" ]; then
  echo "Listo. La compilación se envió a App Store Connect; aparecerá en TestFlight cuando Apple termine de procesarla."
else
  echo "Listo. Arrastra este archivo a Transporter:"
  ls "$BUILD_DIR"/ipa/*.ipa
fi
