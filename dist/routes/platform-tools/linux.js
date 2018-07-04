"use strict";
/* This class and it's methods are only used when running on linux */
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require("child_process");
const express_1 = require("express");
const hb_1 = require("../../hb");
const users_1 = require("../../users");
class LinuxRouter {
    constructor() {
        this.router = express_1.Router();
        this.router.put('/restart-server', users_1.users.ensureAdmin, this.restartServer);
        this.router.put('/shutdown-server', users_1.users.ensureAdmin, this.shutdownServer);
    }
    restartServer(req, res, next) {
        hb_1.hb.warn('Request to restart linux server received');
        res.status(202).json({ ok: true });
        let cmd = [hb_1.hb.linuxServerOpts.restart || 'shutdown -r now'];
        if (hb_1.hb.useSudo) {
            cmd.unshift('sudo -n');
        }
        cmd = cmd.join(' ');
        hb_1.hb.warn('Running restart command:', cmd);
        setTimeout(() => {
            child_process.exec(cmd, (err) => {
                if (err) {
                    hb_1.hb.error(err.message);
                }
            });
        }, 100);
    }
    shutdownServer(req, res, next) {
        hb_1.hb.warn('Request to shutdown linux server received');
        res.status(202).json({ ok: true });
        let cmd = [hb_1.hb.linuxServerOpts.shutdown || 'shutdown -h now'];
        if (hb_1.hb.useSudo) {
            cmd.unshift('sudo -n');
        }
        cmd = cmd.join(' ');
        hb_1.hb.warn('Running shutdown command', cmd);
        setTimeout(() => {
            child_process.exec(cmd, (err) => {
                if (err) {
                    hb_1.hb.error(err.message);
                }
            });
        }, 100);
    }
}
exports.LinuxRouter = LinuxRouter;
//# sourceMappingURL=linux.js.map