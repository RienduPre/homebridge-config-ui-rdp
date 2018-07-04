"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const users_1 = require("../users");
class LoginRouter {
    constructor() {
        this.router = express_1.Router();
        this.router.post('/', this.login);
    }
    login(req, res, next) {
        return users_1.users.login(req.body.username, req.body.password)
            .then((user) => {
            if (!user) {
                return res.sendStatus(403);
            }
            return users_1.users.getJwt(user)
                .then((token) => {
                return res.json({
                    token: token
                });
            });
        })
            .catch(next);
    }
}
exports.LoginRouter = LoginRouter;
//# sourceMappingURL=login.js.map