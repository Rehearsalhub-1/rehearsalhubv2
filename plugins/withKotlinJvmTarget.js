const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withKotlinJvmTarget(config) {
  return withProjectBuildGradle(config, (config) => {
    let buildGradle = config.modResults.contents;
    
    // Check if the subprojects Kotlin compiler configuration is already added
    if (!buildGradle.includes('jvmTarget = "17"')) {
      buildGradle += `

subprojects {
  tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
    kotlinOptions {
      jvmTarget = "17"
    }
  }
}
`;
      config.modResults.contents = buildGradle;
    }
    return config;
  });
};
