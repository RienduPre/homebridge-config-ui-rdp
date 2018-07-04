"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const users_1 = require("../users");
class UserRouter {
    constructor() {
        this.router = express_1.Router();
        this.router.get('/', users_1.users.ensureAdmin, this.getUser);
        this.router.post('/', users_1.users.ensureAdmin, this.createUser);
        this.router.delete('/:id', users_1.users.ensureAdmin, this.deleteUser);
        this.router.put('/:id', users_1.users.ensureAdmin, this.updateUser);
    }
    getUser(req, res, next) {
        return users_1.users.getUsers()
            .then((authfile) => {
            // remove sensitive data before sending user list to client
            authfile = authfile.map((user) => {
                delete user.hashedPassword;
                return user;
            });
            return res.json(authfile);
        })
            .catch(next);
    }
    createUser(req, res, next) {
        // check to see if user already exists
        return users_1.users.findByUsername(req.body.username)
            .then((user) => {
            if (user) {
                return res.sendStatus(409);
            }
            return users_1.users.addUser(req.body)
                .then(() => {
                return res.json({ ok: true });
            });
        })
            .catch(next);
    }
    deleteUser(req, res, next) {
        return users_1.users.deleteUser(req.params.id)
            .then(() => {
            return res.json({ ok: true });
        })
            .catch(next);
    }
    updateUser(req, res, next) {
        return users_1.users.updateUser(parseInt(req.params.id, 10), req.body)
            .then(() => {
            return res.json({ ok: true });
        })
            .catch(next);
    }
}
exports.UserRouter = UserRouter;
//# sourceMappingURL=users.js.map