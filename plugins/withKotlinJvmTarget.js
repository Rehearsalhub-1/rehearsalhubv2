/**
 * Sets the Kotlin JVM target to 17 to avoid "Kotlin/JVM target compatibility" warnings
 * when building with Gradle + React Native 0.76+.
 */

let withAppBuildGradle;
try {
  // Try the root node_modules first
  ({ withAppBuildGradle } = require('@expo/config-plugins'));
} catch {
  // Fall back to expo's own bundled copy
  ({ withAppBuildGradle } = require('expo/node_modules/@expo/config-plugins'));
}

const withKotlinJvmTarget = (config) => {
  return withAppBuildGradle(config, (config) => {
    const gradle = config.modResults.contents;
    if (!gradle.includes('kotlinOptions')) {
      config.modResults.contents = gradle.replace(
        /compileOptions\s*\{[^}]*\}/,
        (match) =>
          match + '\n    kotlinOptions {\n        jvmTarget = "17"\n    }'
      );
    }
    return config;
  });
};

module.exports = withKotlinJvmTarget;
