"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const hb_1 = require("../hb");
class SettingsRouter {
    constructor() {
        this.router = express_1.Router();
        this.router.get('/', this.getSettings);
    }
    getSettings(req, res, next) {
        return res.json({
            formAuth: hb_1.hb.formAuth,
            theme: hb_1.hb.theme,
            env: {
                packageName: hb_1.hb.ui.name,
                packageVersion: hb_1.hb.ui.version,
                nodeVersion: process.version,
                enableAccessories: hb_1.hb.homebridgeInsecure || false,
                homebridgeInstanceName: hb_1.hb.homebridgeConfig.bridge.name || 'Homebridge',
                runningInDocker: hb_1.hb.runningInDocker,
                runningInLinux: hb_1.hb.runningInLinux,
                ableToConfigureSelf: hb_1.hb.ableToConfigureSelf,
                temperatureUnits: hb_1.hb.temperatureUnits,
                enableTerminalAccess: hb_1.hb.enableTerminalAccess,
            }
        });
    }
}
exports.SettingsRouter = SettingsRouter;
//# sourceMappingURL=settings.js.map