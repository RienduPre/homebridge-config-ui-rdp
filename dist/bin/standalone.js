#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
process.title = 'homebridge-config-ui-x';
require("source-map-support/register");
const fs = require("fs-extra");
const path = require("path");
const commander = require("commander");
const semver = require("semver");
const server_1 = require("../server");
class StandaloneUI {
    constructor() {
        const options = {
            pluginPath: undefined,
            userStoragePath: undefined,
            homebridgeCorePath: undefined
        };
        // load argv
        commander
            .option('-P, --plugin-path <path>', '', (p) => { options.pluginPath = p; })
            .option('-U, --user-storage-path <path>', '', (p) => { options.userStoragePath = p; })
            .option('-H, --homebridge-core-path <path>', '', (p) => { options.homebridgeCorePath = p; })
            .parse(process.argv);
        // all options are required
        Object.keys(options).forEach(option => {
            if (!options[option]) {
                console.log(`The ${option} option is required. See --help`);
                process.exit(1);
            }
        });
        this.options = options;
        this.init();
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            // load homebridge package.json
            let homebridge;
            if (fs.existsSync(path.resolve(this.options.homebridgeCorePath, 'package.json'))) {
                homebridge = yield fs.readJson(path.resolve(this.options.homebridgeCorePath, 'package.json'));
            }
            else {
                console.log(`Could not find homebridge at ${this.options.homebridgeCorePath}`);
                process.exit(1);
            }
            // setup
            this.setup = {
                homebridgeVersion: homebridge.version,
                configPath: path.join(this.options.userStoragePath, 'config.json'),
                storagePath: this.options.userStoragePath
            };
            // check and see if config-ui platform is defined in config.json
            if (semver.satisfies(process.env.CONFIG_UI_VERSION, '>=3.5.5') && fs.existsSync(path.resolve(this.setup.configPath))) {
                const homebridgeConfig = yield fs.readJson(this.setup.configPath);
                if (homebridgeConfig && homebridgeConfig.platforms) {
                    const config = homebridgeConfig.platforms.find(x => x.platform === 'config' || x.platform === 'homebridge-config-ui-x.config');
                    if (config) {
                        this.setup.config = config;
                    }
                }
            }
            // if no platform config, load defaults
            if (!this.setup.config) {
                this.setDefaultConfig();
            }
            // enforce certain settings
            this.setDockerConfig();
            // start config ui server
            return new server_1.UiServer(this.setup);
        });
    }
    setDefaultConfig() {
        // these can be overridden using the config.json file
        this.setup.config = {
            port: process.env.HOMEBRIDGE_CONFIG_UI_PORT || 8080,
            theme: process.env.HOMEBRIDGE_CONFIG_UI_THEME || 'red',
            auth: process.env.HOMEBRIDGE_CONFIG_UI_AUTH || 'form',
            temp: process.env.HOMEBRIDGE_CONFIG_UI_TEMP || undefined,
            loginWallpaper: process.env.HOMEBRIDGE_CONFIG_UI_LOGIN_WALLPAPER || undefined,
        };
    }
    setDockerConfig() {
        // these options cannot be overridden using the config.json file
        this.setup.config.log = {
            method: 'file',
            path: '/homebridge/logs/homebridge.log',
        };
        this.setup.config.restart = 'killall -9 homebridge && killall -9 homebridge-config-ui-x';
        this.setup.config.homebridgeNpmPkg = process.env.HOMEBRIDGE_CONFIG_UI_NPM_PKG || 'homebridge';
        this.setup.config.homebridgeFork = process.env.HOMEBRIDGE_CONFIG_UI_FORK || undefined;
        this.setup.config.homebridgeInsecure = (process.env.HOMEBRIDGE_INSECURE === '1');
        this.setup.config.pluginPath = this.options.pluginPath;
        this.setup.config.sudo = false;
    }
}
module.exports = new StandaloneUI();
//# sourceMappingURL=standalone.js.map