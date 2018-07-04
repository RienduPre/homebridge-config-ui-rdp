"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const hb_1 = require("../hb");
const users_1 = require("../users");
class ConfigRouter {
    constructor() {
        this.router = express_1.Router();
        this.router.get('/', users_1.users.ensureAdmin, this.getConfig);
        this.router.post('/', users_1.users.ensureAdmin, this.updateConfig);
        this.router.get('/backups', users_1.users.ensureAdmin, this.listConfigBackups);
        this.router.get('/backups/:backupId(\\d+)', users_1.users.ensureAdmin, this.getConfigBackup);
        this.router.delete('/backups', users_1.users.ensureAdmin, this.deleteAllConfigBackups);
    }
    getConfig(req, res, next) {
        return res.sendFile(hb_1.hb.configPath);
    }
    updateConfig(req, res, next) {
        return hb_1.hb.updateConfig(req.body)
            .then((config) => {
            res.json(config);
        })
            .catch(next);
    }
    listConfigBackups(req, res, next) {
        return hb_1.hb.listConfigBackups()
            .then((data) => {
            res.json(data);
        })
            .catch(next);
    }
    getConfigBackup(req, res, next) {
        return hb_1.hb.getConfigBackup(req.params.backupId)
            .then((backupConfig) => {
            res.send(backupConfig);
        })
            .catch(next);
    }
    deleteAllConfigBackups(req, res, next) {
        return hb_1.hb.deleteAllConfigBackups()
            .then((backupConfig) => {
            res.json({ ok: true });
        })
            .catch(next);
    }
}
exports.ConfigRouter = ConfigRouter;
//# sourceMappingURL=config.js.map