module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
    plugins: [
      // Doit rester le dernier plugin de la liste.
      'react-native-reanimated/plugin',
    ],
  };
};
