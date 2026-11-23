#!/bin/bash
# Compila Dix FM para Android.
#
#   ./scripts/build-android.sh        -> APK para instalar y probar
#   ./scripts/build-android.sh aab    -> AAB firmado para Google Play
#
# El AAB se firma con tu clave de subida. Si no tienes una, el script la crea
# (fuera del proyecto) y deja el certificado que Google pide para registrarla.
# Requiere Java 17 y el SDK de Android.
set -euo pipefail
cd "$(dirname "$0")/.."

MODE="${1:-apk}"
CONFIG=.android-build.env
[ -f "$CONFIG" ] && source "$CONFIG"

if [ "$MODE" = "aab" ]; then
  KEYSTORE="${DIXFM_KEYSTORE:-$HOME/dixfm-upload.jks}"
  KEYSTORE="${KEYSTORE/#\~/$HOME}"
  ALIAS="${DIXFM_KEY_ALIAS:-upload}"
  mkdir -p build

  if [ ! -f "$KEYSTORE" ]; then
    echo "No hay clave de subida en $KEYSTORE. Se crea una nueva."
    echo "Elige una contraseña y GUÁRDALA: sin ella no podrás publicar actualizaciones."
    keytool -genkeypair -v -storetype PKCS12 -keystore "$KEYSTORE" -alias "$ALIAS" \
      -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Dix FM"
    echo
    echo "Clave creada en: $KEYSTORE  (haz una copia de seguridad de ese archivo)"
  fi

  read -r -s -p "Contraseña de la clave de subida: " DIXFM_KEYSTORE_PASSWORD
  echo
  # Comprueba la contraseña antes de la compilación larga y deja el certificado para Google.
  keytool -export -rfc -keystore "$KEYSTORE" -alias "$ALIAS" -storepass "$DIXFM_KEYSTORE_PASSWORD" \
    -file build/upload_certificate.pem >/dev/null
  echo "Certificado de la clave: build/upload_certificate.pem"

  export DIXFM_KEYSTORE="$KEYSTORE" DIXFM_KEY_ALIAS="$ALIAS" DIXFM_KEYSTORE_PASSWORD
  printf 'DIXFM_KEYSTORE="%s"\nDIXFM_KEY_ALIAS="%s"\n' "$KEYSTORE" "$ALIAS" > "$CONFIG"

  # Código de versión único y creciente: los minutos transcurridos desde 2020.
  export ANDROID_VERSION_CODE="${ANDROID_VERSION_CODE:-$(( ($(date +%s) - 1577836800) / 60 ))}"
  echo "Código de versión: $ANDROID_VERSION_CODE"
fi

npm install
npx expo prebuild --platform android --clean
cd android
if [ "$MODE" = "aab" ]; then
  ./gradlew bundleRelease
  echo
  echo "Listo. Sube este archivo a Play Console:"
  ls "$PWD"/app/build/outputs/bundle/release/*.aab
else
  ./gradlew assembleRelease
  echo
  echo "Listo. APK de prueba:"
  ls "$PWD"/app/build/outputs/apk/release/*.apk
fi
