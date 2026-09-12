/**
 * Sets the Kotlin JVM target to 17 to avoid "Kotlin/JVM target compatibility" warnings
 * when building with Gradle + React Native 0.76+.
 */

let withAppBuildGradle;
try {
  ({ withAppBuildGradle } = require('expo/config-plugins'));
} catch {
  ({ withAppBuildGradle } = require('@expo/config-plugins'));
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
