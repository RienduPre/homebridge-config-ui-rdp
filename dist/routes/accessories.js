"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const hb_1 = require("../hb");
class AccessoriesRouter {
    constructor() {
        this.router = express_1.Router();
        this.router.get('/layout', this.getAccessoryLayout);
        this.router.post('/layout', this.updateAccessoryLayout);
    }
    getAccessoryLayout(req, res, next) {
        return hb_1.hb.getAccessoryLayout(req.user.username)
            .then((data) => {
            return res.json(data);
        })
            .catch(next);
    }
    updateAccessoryLayout(req, res, next) {
        return hb_1.hb.updateAccessoryLayout(req.user.username, req.body)
            .then((data) => {
            return res.json(data);
        })
            .catch(next);
    }
}
exports.AccessoriesRouter = AccessoriesRouter;
//# sourceMappingURL=accessories.js.map