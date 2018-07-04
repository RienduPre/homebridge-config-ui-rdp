"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const hb_1 = require("../hb");
const pm_1 = require("../pm");
const users_1 = require("../users");
class PackageRouter {
    constructor() {
        this.router = express_1.Router();
        this.router.get('/', this.getPackages);
        this.router.put('/update', users_1.users.ensureAdmin, this.updatePackage);
        this.router.post('/uninstall', users_1.users.ensureAdmin, this.uninstallPackage);
        this.router.post('/install', users_1.users.ensureAdmin, this.installPackage);
        this.router.get('/homebridge', this.getHomebridgePackage);
        this.router.put('/homebridge/upgrade', users_1.users.ensureAdmin, this.upgradeHomebridgePackage);
        this.router.get('/changelog/:package', users_1.users.ensureAdmin, this.getChangeLog);
        this.router.get('/config-schema/:package', users_1.users.ensureAdmin, this.getConfigSchema);
    }
    getPackages(req, res, next) {
        if (req.query.search && req.query.search !== '') {
            return pm_1.pm.searchRegistry(req.query.search)
                .then(pkgs => {
                res.json(pkgs);
            })
                .catch(next);
        }
        else {
            return pm_1.pm.getInstalled()
                .then(pkgs => {
                res.json(pkgs);
            })
                .catch(next);
        }
    }
    updatePackage(req, res, next) {
        pm_1.pm.updatePlugin(req.body.package);
        res.json({ ok: true });
    }
    uninstallPackage(req, res, next) {
        pm_1.pm.removePlugin(req.body.package);
        res.json({ ok: true });
    }
    installPackage(req, res, next) {
        pm_1.pm.installPlugin(req.body.package);
        res.json({ ok: true });
    }
    getHomebridgePackage(req, res, next) {
        if (!hb_1.hb.homebridgeFork) {
            return pm_1.pm.getHomebridge()
                .then(server => res.json(server))
                .catch(next);
        }
        else {
            return pm_1.pm.getHomebridgeFork()
                .then(server => res.json(server))
                .catch(next);
        }
    }
    upgradeHomebridgePackage(req, res, next) {
        pm_1.pm.updateHomebridge();
        res.json({ ok: true });
    }
    getChangeLog(req, res, next) {
        return pm_1.pm.getChangeLog(req.params.package)
            .then((data) => {
            res.json({ changelog: data });
        })
            .catch(next);
    }
    getConfigSchema(req, res, next) {
        return pm_1.pm.getConfigSchema(req.params.package)
            .then((data) => {
            res.json(data);
        })
            .catch(next);
    }
}
exports.PackageRouter = PackageRouter;
//# sourceMappingURL=packages.js.map