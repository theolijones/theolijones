/**
 * Expo config plugin: injects the native iOS PersonCutoutPlugin frame
 * processor into the Xcode project at prebuild time.
 *
 * EAS regenerates the `ios/` directory on every build, which would wipe
 * any files copied in manually. This plugin runs as part of `expo
 * prebuild` (locally and on EAS), so the source files and Xcode project
 * references are reconstructed deterministically.
 */
const fs = require("node:fs");
const path = require("node:path");
const {
  withDangerousMod,
  withXcodeProject,
} = require("@expo/config-plugins");

const PLUGIN_DIR_NAME = "person-cutout";
const FILES = ["PersonCutoutPlugin.h", "PersonCutoutPlugin.m"];

/**
 * Copy plugin source files into the prebuilt iOS target directory.
 */
function copySources(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const platformProjectRoot = cfg.modRequest.platformProjectRoot; // ios/
      const targetName = cfg.modRequest.projectName; // BetTips
      const srcDir = path.join(projectRoot, "plugins", PLUGIN_DIR_NAME);
      const dstDir = path.join(platformProjectRoot, targetName);

      if (!fs.existsSync(dstDir)) {
        fs.mkdirSync(dstDir, { recursive: true });
      }
      for (const file of FILES) {
        const src = path.join(srcDir, file);
        const dst = path.join(dstDir, file);
        if (!fs.existsSync(src)) {
          throw new Error(
            `[with-person-cutout] missing source file: ${src}. ` +
              `Plugin sources should live at mobile/plugins/${PLUGIN_DIR_NAME}/.`,
          );
        }
        fs.copyFileSync(src, dst);
      }
      return cfg;
    },
  ]);
}

/**
 * Add the copied source files to the BetTips target's Sources build phase
 * so they're compiled into the app binary.
 */
function registerSources(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const targetName = cfg.modRequest.projectName; // BetTips
    const groupName = targetName;

    // Locate the main app PBXGroup so files appear in the right Xcode folder.
    const groupKey = project.findPBXGroupKey({ name: groupName });
    if (!groupKey) {
      throw new Error(
        `[with-person-cutout] could not find PBXGroup "${groupName}" in Xcode project.`,
      );
    }

    for (const file of FILES) {
      // The auto-generated BetTips PBXGroup has no `path` attribute; existing
      // files in it (AppDelegate.mm, main.m, …) compensate by setting their
      // full path as `BetTips/<filename>` while the file's `name` stays as
      // just the basename. Match that convention or Xcode resolves the file
      // to `ios/<filename>` and the build fails with "Build input file
      // cannot be found".
      const filePath = `${targetName}/${file}`;
      const hasEntry =
        project.hasFile && project.hasFile(filePath)
          ? project.hasFile(filePath)
          : false;
      if (hasEntry) continue;

      if (file.endsWith(".h")) {
        project.addHeaderFile(filePath, { target: targetName }, groupKey);
      } else {
        project.addSourceFile(
          filePath,
          { target: project.getFirstTarget().uuid },
          groupKey,
        );
      }
    }

    return cfg;
  });
}

const withPersonCutout = (config) => {
  config = copySources(config);
  config = registerSources(config);
  return config;
};

module.exports = withPersonCutout;
