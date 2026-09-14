// Default Expo Metro config. Picks up the `@/*` path alias from tsconfig.json
// automatically (Expo SDK 50+).
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
