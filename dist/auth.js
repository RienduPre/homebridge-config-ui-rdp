"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = require("passport");
const passport_http_1 = require("passport-http");
const hb_1 = require("./hb");
const users_1 = require("./users");
class AuthMiddleware {
    constructor() {
        this.passport = new passport_1.Passport();
        this.passport.use(new passport_http_1.BasicStrategy((username, password, callback) => {
            return users_1.users.login(username, password)
                .then((user) => {
                if (!user) {
                    return callback(null, false);
                }
                return callback(null, user);
            })
                .catch((err) => callback(err, false));
        }));
        this.passport.serializeUser((user, callback) => {
            callback(null, user.id);
        });
        this.passport.deserializeUser((id, callback) => {
            return users_1.users.findById(id)
                .then((user) => {
                if (!user) {
                    return callback(null, false);
                }
                return callback(null, user);
            })
                .catch((err) => callback(err, false));
        });
        this.init = [
            this.passport.initialize(),
            this.passport.session()
        ];
        if (hb_1.hb.authMethod === 'none' || hb_1.hb.authMethod === false) {
            hb_1.hb.log('Authentication Disabled');
            this.main = this.noAuthHandler;
            this.staticAuth = this.noAuthHandler;
        }
        else if (hb_1.hb.authMethod === 'basic') {
            hb_1.hb.log('Using Basic Authentication');
            this.main = this.passport.authenticate('basic', { session: false });
            this.staticAuth = this.passport.authenticate('basic', { session: false });
        }
        else {
            hb_1.hb.log('Using Form Authentication');
            this.main = this.formAuthHandler;
            this.staticAuth = this.noAuthHandler;
        }
    }
    noAuthHandler(req, res, next) {
        return users_1.users.getUsers()
            .then((authfile) => {
            req.user = authfile[0];
            req.user.admin = true;
            return next();
        })
            .catch(next);
    }
    formAuthHandler(req, res, next) {
        if (req.headers['x-jwt']) {
            return users_1.users.verifyJwt(req.headers['x-jwt'])
                .then((user) => {
                if (user) {
                    req.user = user;
                    return next();
                }
                else {
                    return res.sendStatus(401);
                }
            })
                .catch(() => res.sendStatus(401));
        }
        else {
            return res.sendStatus(401);
        }
    }
    queryTokenAuthHandler(req, res, next) {
        if (req.query.token) {
            return users_1.users.verifyJwt(req.query.token)
                .then((user) => {
                if (user) {
                    return next();
                }
                else {
                    return res.sendStatus(401);
                }
            });
        }
        else {
            return res.sendStatus(401);
        }
    }
}
exports.AuthMiddleware = AuthMiddleware;
//# sourceMappingURL=auth.js.map