#!/bin/bash
# Compila Dix FM para Android.
#   ./scripts/build-android.sh        -> APK para instalar y probar
#   ./scripts/build-android.sh aab    -> AAB para Google Play (requiere tu clave de subida, ver README)
set -euo pipefail
cd "$(dirname "$0")/.."

npm install
npx expo prebuild --platform android --clean
cd android
if [ "${1:-apk}" = "aab" ]; then
  ./gradlew bundleRelease
  ls app/build/outputs/bundle/release/*.aab
else
  ./gradlew assembleRelease
  ls app/build/outputs/apk/release/*.apk
fi
