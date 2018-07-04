"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const path = require("path");
const fs = require("fs-extra");
const color = require("bash-color");
const commander = require("commander");
const semver = require("semver");
class HomebridgeUI {
    constructor() {
        this.ui = fs.readJSONSync(path.resolve(__dirname, '../package.json'));
        this.availableThemes = [
            'red',
            'pink',
            'purple',
            'indigo',
            'blue',
            'blue-grey',
            'green',
            'orange'
        ];
    }
    init(setup) {
        this.configPath = setup.configPath;
        this.authPath = path.join(setup.storagePath, 'auth.json');
        this.storagePath = setup.storagePath;
        this.accessoryLayoutPath = path.resolve(setup.storagePath, 'accessories', 'uiAccessoriesLayout.json');
        this.homebridgeVersion = setup.homebridgeVersion;
        this.parseConfig(setup.config);
        this.parseCommandLineArgs();
    }
    parseConfig(config) {
        this.pluginName = config.name || this.ui.name;
        this.port = config.port || 8080;
        this.proxyHost = config.proxyHost;
        this.logOpts = config.log;
        this.restartCmd = config.restart;
        this.useSudo = config.sudo;
        this.authMethod = config.auth;
        this.homebridgeFork = config.fork;
        this.homebridgeNpmPkg = config.homebridgeNpmPkg || 'homebridge';
        this.homebridgeInsecure = config.homebridgeInsecure;
        this.pluginPath = config.pluginPath;
        this.runningInDocker = Boolean(process.env.HOMEBRIDGE_CONFIG_UI === '1');
        this.runningInLinux = (!this.runningInDocker && os.platform() === 'linux');
        this.linuxServerOpts = config.linux || {};
        this.enableTerminalAccess = this.runningInDocker || Boolean(process.env.HOMEBRIDGE_CONFIG_UI_TERMINAL === '1');
        this.ableToConfigureSelf = (!this.runningInDocker || semver.satisfies(process.env.CONFIG_UI_VERSION, '>=3.5.5'));
        this.loginWallpaper = config.loginWallpaper;
        this.temperatureUnits = config.tempUnits || 'c';
        if (config.auth === 'none' || config.auth === false) {
            this.formAuth = false;
        }
        else if (config.auth === 'basic') {
            this.formAuth = false;
        }
        else {
            this.formAuth = true;
        }
        // check theme is valid
        if (config.theme && this.availableThemes.find(x => x === config.theme)) {
            this.theme = config.theme;
        }
        else if (config.theme) {
            // delay the output of the warning message so it does not get lost under homebridge setup details
            setTimeout(() => {
                this.warn(`Invalid theme in config.json. Possible options are: ${this.availableThemes.join(', ')}`);
            }, 2000);
            this.theme = 'red';
        }
        else {
            this.theme = 'red';
        }
        // check the path to the temp file actually exists
        if (config.temp && fs.existsSync(config.temp)) {
            this.temperatureFile = config.temp;
        }
        else if (config.temp) {
            // delay the output of the warning message so it does not get lost under homebridge setup details
            setTimeout(() => {
                this.warn(`WARNING: Configured path to temp file does not exist: ${config.temp}`);
                this.warn(`WARNING: CPU Temp will not be displayed`);
            }, 2000);
        }
    }
    parseCommandLineArgs() {
        // parse plugin path argument from homebridge
        commander
            .allowUnknownOption()
            .option('-P, --plugin-path [path]', '', (p) => this.pluginPath = p)
            .option('-I, --insecure', '', () => this.homebridgeInsecure = true)
            .parse(process.argv);
    }
    refreshHomebridgeConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.homebridgeConfig = yield Promise.resolve().then(() => require(this.configPath));
            }
            catch (e) {
                this.homebridgeConfig = {
                    bridge: {
                        name: 'Homebridge',
                        port: 51826
                    }
                };
                this.error(`Failed to load ${this.configPath} - ${e.message}`);
            }
            if (!this.homebridgeConfig.bridge.port) {
                this.error('Homebridge config.json error: bridge.port missing.');
            }
        });
    }
    updateConfig(config) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            if (!config) {
                config = {};
            }
            if (!config.bridge) {
                config.bridge = {};
            }
            if (!config.bridge.name) {
                config.bridge.name = 'Homebridge';
            }
            if (!config.bridge.port) {
                config.bridge.port = 51826;
            }
            if (!config.bridge.username) {
                config.bridge.username = this.generateUsername();
            }
            if (!config.bridge.pin) {
                config.bridge.pin = this.generatePin();
            }
            if (!config.accessories) {
                config.accessories = [];
            }
            if (!config.platforms) {
                config.platforms = [];
            }
            // create backup of existing config
            yield fs.rename(this.configPath, `${this.configPath}.${now.getTime()}`);
            // save config file
            fs.writeJsonSync(this.configPath, config, { spaces: 4 });
            this.log('Changes to config.json saved.');
            return config;
        });
    }
    listConfigBackups() {
        return __awaiter(this, void 0, void 0, function* () {
            const dirContents = yield fs.readdir(this.storagePath);
            const backups = dirContents
                .filter(x => x.indexOf('config.json.') === 0)
                .sort()
                .reverse()
                .map(x => {
                const ext = x.split('.');
                if (ext.length === 3 && !isNaN(ext[2])) {
                    return {
                        id: ext[2],
                        timestamp: new Date(parseInt(ext[2], 10)),
                        file: x
                    };
                }
                else {
                    return null;
                }
            })
                .filter((x => x && !isNaN(x.timestamp.getTime())));
            return backups;
        });
    }
    getConfigBackup(backupId) {
        return __awaiter(this, void 0, void 0, function* () {
            // check backup file exists
            if (!fs.existsSync(this.configPath + '.' + parseInt(backupId, 10))) {
                throw new Error(`Backup ${backupId} Not Found`);
            }
            // read source backup
            return yield fs.readFile(this.configPath + '.' + parseInt(backupId, 10));
        });
    }
    deleteAllConfigBackups() {
        return __awaiter(this, void 0, void 0, function* () {
            const backups = yield this.listConfigBackups();
            // delete each backup file
            yield backups.forEach((backupFile) => __awaiter(this, void 0, void 0, function* () {
                yield fs.unlink(path.resolve(this.storagePath, backupFile.file));
            }));
        });
    }
    resetHomebridgeAccessory() {
        return __awaiter(this, void 0, void 0, function* () {
            // load config file
            const config = yield fs.readJson(this.configPath);
            // generate new random username and pin
            if (config.bridge) {
                config.bridge.pin = this.generatePin();
                config.bridge.username = this.generateUsername();
                this.log(`Homebridge Reset: New Username: ${config.bridge.username}`);
                this.log(`Homebridge Reset: New Pin: ${config.bridge.pin}`);
                // save config file
                yield this.updateConfig(config);
            }
            else {
                this.error('Homebridge Reset: Could not reset homebridge username or pin. Config format invalid.');
            }
            // remove accessories and persist directories
            yield fs.remove(path.resolve(this.storagePath, 'accessories'));
            yield fs.remove(path.resolve(this.storagePath, 'persist'));
            this.log(`Homebridge Reset: "persist" directory removed.`);
            this.log(`Homebridge Reset: "accessories" directory removed.`);
        });
    }
    generatePin() {
        let code = Math.floor(10000000 + Math.random() * 90000000) + '';
        code = code.split('');
        code.splice(3, 0, '-');
        code.splice(6, 0, '-');
        code = code.join('');
        return code;
    }
    generateUsername() {
        const hexDigits = '0123456789ABCDEF';
        let username = '0E:';
        for (let i = 0; i < 5; i++) {
            username += hexDigits.charAt(Math.round(Math.random() * 15));
            username += hexDigits.charAt(Math.round(Math.random() * 15));
            if (i !== 4) {
                username += ':';
            }
        }
        return username;
    }
    getAccessoryLayout(user) {
        return __awaiter(this, void 0, void 0, function* () {
            if (fs.existsSync(this.accessoryLayoutPath)) {
                const accessoryLayout = yield fs.readJson(this.accessoryLayoutPath);
                if (user in accessoryLayout) {
                    return accessoryLayout[user];
                }
            }
            return [
                {
                    name: 'Default Room',
                    services: []
                }
            ];
        });
    }
    updateAccessoryLayout(user, layout) {
        return __awaiter(this, void 0, void 0, function* () {
            let accessoryLayout;
            try {
                accessoryLayout = yield fs.readJson(this.accessoryLayoutPath);
            }
            catch (e) {
                accessoryLayout = {};
            }
            accessoryLayout[user] = layout;
            fs.writeJsonSync(this.accessoryLayoutPath, accessoryLayout);
            this.log(`[${user}] Accessory layout changes saved.`);
            return layout;
        });
    }
    log(...params) {
        console.log(color.white(`[${new Date().toLocaleString()}]`), color.cyan(`[${this.pluginName}]`), ...params);
    }
    warn(...params) {
        console.warn(color.white(`[${new Date().toLocaleString()}]`), color.cyan(`[${this.pluginName}]`), color.yellow(params.join(' ')));
    }
    error(...params) {
        console.error(color.white(`[${new Date().toLocaleString()}]`), color.cyan(`[${this.pluginName}]`), color.red(params.join(' ')));
    }
}
exports.hb = new HomebridgeUI();
//# sourceMappingURL=hb.js.map