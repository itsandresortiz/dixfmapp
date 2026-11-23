// Amplía app.json con valores que dependen de quien compila.
module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    // Team ID de Apple Developer, para firmar al compilar por terminal.
    ...(process.env.APPLE_TEAM_ID ? { appleTeamId: process.env.APPLE_TEAM_ID } : {}),
  },
});
