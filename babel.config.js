module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 50+) automatically adds react-native-reanimated's
    // Babel plugin when the package is installed, so we don't list it here.
    presets: ['babel-preset-expo'],
  };
};
