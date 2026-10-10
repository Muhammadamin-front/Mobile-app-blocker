const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Gradle output lives in *.nosync folders (see android/build.gradle); Metro has
    // no reason to crawl it.
    blockList: [/.*\.nosync\/.*/],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
