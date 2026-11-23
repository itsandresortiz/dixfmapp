// Amplía app.json con valores que dependen de quien compila.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    // Código de versión de Google Play; debe subir en cada publicación.
    ...(process.env.ANDROID_VERSION_CODE ? { versionCode: Number(process.env.ANDROID_VERSION_CODE) } : {}),
  },
  ios: {
    ...config.ios,
    // Team ID de Apple Developer, para firmar al compilar por terminal.
    ...(process.env.APPLE_TEAM_ID ? { appleTeamId: process.env.APPLE_TEAM_ID } : {}),
    // Número de compilación; el script de iOS pone uno nuevo en cada compilación.
    ...(process.env.IOS_BUILD_NUMBER ? { buildNumber: process.env.IOS_BUILD_NUMBER } : {}),
  },
});
