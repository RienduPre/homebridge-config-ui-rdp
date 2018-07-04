"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
require("source-map-support/register");
const path = require("path");
const child_process = require("child_process");
const commander = require("commander");
const semver = require("semver");
let homebridge;
class HomebridgeConfigUi {
    constructor(log, config) {
        this.log = log;
        const setup = {
            homebridgeVersion: homebridge.serverVersion,
            configPath: homebridge.user.configPath(),
            storagePath: homebridge.user.storagePath(),
            config: config
        };
        commander
            .allowUnknownOption()
            .option('-P, --plugin-path [path]', '', (p) => config.pluginPath = p)
            .option('-I, --insecure', '', () => config.homebridgeInsecure = true)
            .parse(process.argv);
        if (process.env.HOMEBRIDGE_CONFIG_UI === '1' && semver.satisfies(process.env.CONFIG_UI_VERSION, '>=3.5.5')) {
            this.log(`Running in Docker Standalone Mode.`);
        }
        else if (config.noFork) {
            this.noFork(setup);
        }
        else {
            this.fork(setup);
        }
    }
    /**
     * Run plugin as a seperate node.js process
     */
    fork(setup) {
        const ui = child_process.fork(path.resolve(__dirname, 'bin/fork'));
        this.log(`Spawning homebridge-config-ui-x with PID`, ui.pid);
        ui.on('message', (message) => {
            if (message === 'ready') {
                ui.send(setup);
            }
        });
        ui.on('close', () => {
            process.exit(1);
        });
        ui.on('error', (err) => { });
    }
    /**
     * Run plugin in the main homebridge process
     */
    noFork(setup) {
        return __awaiter(this, void 0, void 0, function* () {
            const { UiServer } = yield Promise.resolve().then(() => require('./server'));
            return new UiServer(setup);
        });
    }
    accessories(callback) {
        const accessories = [];
        callback(accessories);
    }
}
module.exports = (api) => {
    homebridge = api;
    homebridge.registerPlatform('homebridge-config-ui-x', 'config', HomebridgeConfigUi);
};
//# sourceMappingURL=index.js.map