"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const hb_1 = require("../hb");
class BackupRouter {
    constructor() {
        this.router = express_1.Router();
        this.router.get('/', this.downloadConfig);
    }
    downloadConfig(req, res, next) {
        res.set('content-disposition', 'attachment; filename=config.json');
        res.header('content-type', 'application/json');
        return res.sendFile(hb_1.hb.configPath);
    }
}
exports.BackupRouter = BackupRouter;
//# sourceMappingURL=backup.js.map