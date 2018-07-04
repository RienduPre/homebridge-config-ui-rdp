"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const qr = require("qr-image");
const child_process = require("child_process");
const express_1 = require("express");
const hb_1 = require("../hb");
const users_1 = require("../users");
const qrcode_1 = require("../qrcode");
class ServerRouter {
    constructor() {
        this.router = express_1.Router();
        this.router.put('/restart', this.restartServer);
        this.router.put('/reset-homebridge', users_1.users.ensureAdmin, this.resetHomebridgeAccessory);
        this.router.get('/qrcode.svg', this.getQrCode);
        this.router.get('/token', this.getToken);
        this.router.get('/teamviewerStatus', this.getTeamviewerStatus);
        this.router.get('/teamviewerStart', this.startTeamviewer);
        this.router.get('/teamviewerStop', this.stopTeamviewer);
    }
    restartServer(req, res, next) {
        hb_1.hb.log('Homebridge restart request received');
        res.status(202).json({ ok: true, command: hb_1.hb.restartCmd });
        setTimeout(() => {
            if (hb_1.hb.restartCmd) {
                hb_1.hb.log(`Executing restart command: ${hb_1.hb.restartCmd}`);
                child_process.exec(hb_1.hb.restartCmd, (err) => {
                    if (err) {
                        hb_1.hb.log('Restart command exited with an error. Failed to restart Homebridge.');
                    }
                });
            }
            else if (hb_1.hb.restartCmd !== false) {
                hb_1.hb.log(`No restart command defined, killing process...`);
                process.exit(1);
            }
        }, 100);
    }
    resetHomebridgeAccessory(req, res, next) {
        return hb_1.hb.resetHomebridgeAccessory()
            .then(() => {
            res.json({ ok: true });
        })
            .catch(next);
    }
    getQrCode(req, res, next) {
        const data = qrcode_1.qrcode.getCode();
        if (!data) {
            return res.sendStatus(404);
        }
        const qrSvg = qr.image(data, { type: 'svg' });
        res.setHeader('Content-type', 'image/svg+xml');
        qrSvg.pipe(res);
    }
    getToken(req, res, next) {
        return users_1.users.getJwt(req.user)
            .then((token) => {
            return res.json({
                token: token
            });
        })
            .catch(next);
    }
    getTeamviewerStatus(req, res, next) {
        const exec = require('child_process').execSync;
        let teamviewerid = "";
        try {
            teamviewerid = exec("teamviewer info | grep \"TeamViewer ID:\" | grep -o '[0-9]\\{8,\\}'", { encoding: "utf8" }).trim();
        }
        catch (_a) { }
        let teamviewerstate = exec("systemctl is-active teamviewerd.service >/dev/null 2>&1 && echo active || echo inactive", { encoding: "utf8" }).trim();
        return res.json({
            id: teamviewerid,
            state: teamviewerstate,
            active: teamviewerstate === 'active'
        });
    }
    startTeamviewer(req, res, next) {
        return res.send(require("child_process").execSync("sudo systemctl start teamviewerd.service"));
    }
    stopTeamviewer(req, res, next) {
        return res.send(require("child_process").execSync("sudo systemctl stop teamviewerd.service"));
    }
}
exports.ServerRouter = ServerRouter;
//# sourceMappingURL=server.js.map