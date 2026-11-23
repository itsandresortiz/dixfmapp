// Firma de Android: si DIXFM_KEYSTORE está definido al compilar, la versión de
// publicación se firma con esa clave de subida; si no, con la clave de pruebas.
// Las contraseñas llegan por variables de entorno y nunca se guardan en el proyecto.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            def dixKeystore = System.getenv('DIXFM_KEYSTORE')
            if (dixKeystore) {
                storeFile file(dixKeystore)
                storePassword System.getenv('DIXFM_KEYSTORE_PASSWORD')
                keyAlias System.getenv('DIXFM_KEY_ALIAS')
                keyPassword System.getenv('DIXFM_KEY_PASSWORD') ?: System.getenv('DIXFM_KEYSTORE_PASSWORD')
            }
        }`;

module.exports = function withAndroidSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes('DIXFM_KEYSTORE')) return mod;

    const debugConfig = /(signingConfigs \{\s*debug \{[^}]*\})/;
    const releaseUse = /(release \{[^}]*?)signingConfig signingConfigs\.debug/;
    if (!debugConfig.test(gradle) || !releaseUse.test(gradle)) {
      throw new Error('withAndroidSigning: no se reconoce android/app/build.gradle; revisa el plugin.');
    }
    gradle = gradle.replace(debugConfig, `$1${RELEASE_CONFIG}`);
    gradle = gradle.replace(releaseUse, "$1signingConfig System.getenv('DIXFM_KEYSTORE') ? signingConfigs.release : signingConfigs.debug");
    mod.modResults.contents = gradle;
    return mod;
  });
};
