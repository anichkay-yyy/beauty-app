const YAML = require("yaml");
const fs = require("fs");
const { getIcons } = require("./getIcons.js");

const getManifest = () => {
    const
        config = YAML.parse(fs.readFileSync('beauty.config.yaml', 'utf8')),
        shortcutsConfig = config["shortcuts"];

    if (config["icons"]) {
        const iconsConfig = config["icons"];
        config["general"].icons = getIcons( iconsConfig["icon"], iconsConfig["icon_dir"], iconsConfig["icons_path"]);
    }

    if (shortcutsConfig) {
        config["general"].shortcuts = shortcutsConfig;
    }

    return config["general"];
}

module.exports = { getManifest };
