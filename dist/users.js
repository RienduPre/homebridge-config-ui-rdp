"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const cryptoNode = require("crypto");
const Bluebird = require("bluebird");
const jsonwebtoken = require("jsonwebtoken");
const crypto = Bluebird.promisifyAll(cryptoNode);
const jwt = Bluebird.promisifyAll(jsonwebtoken);
const hb_1 = require("./hb");
class Users {
    getUsers() {
        return __awaiter(this, void 0, void 0, function* () {
            const allUsers = yield fs.readJson(hb_1.hb.authPath);
            return allUsers;
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const authfile = yield this.getUsers();
            const user = authfile.find(x => x.id === id);
            return user;
        });
    }
    findByUsername(username) {
        return __awaiter(this, void 0, void 0, function* () {
            const authfile = yield this.getUsers();
            const user = authfile.find(x => x.username === username);
            return user;
        });
    }
    hashPassword(password, salt) {
        return __awaiter(this, void 0, void 0, function* () {
            const derivedKey = yield crypto.pbkdf2Async(password, salt, 1000, 64, 'sha512');
            return derivedKey.toString('hex');
        });
    }
    genSalt() {
        return __awaiter(this, void 0, void 0, function* () {
            const salt = yield crypto.randomBytesAsync(32);
            return salt.toString('hex');
        });
    }
    login(username, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.findByUsername(username);
            if (!user) {
                return null;
            }
            // using username as salt if user.salt not set to maintain backwards compatibility with older versions.
            const hashedPassword = yield this.hashPassword(password, user.salt || user.username);
            if (hashedPassword === user.hashedPassword) {
                return user;
            }
            else {
                return null;
            }
        });
    }
    addUser(user) {
        return __awaiter(this, void 0, void 0, function* () {
            const authfile = yield this.getUsers();
            const salt = yield this.genSalt();
            // user object
            const newUser = {
                id: authfile.length ? Math.max.apply(Math, authfile.map(x => x.id)) + 1 : 1,
                username: user.username,
                name: user.name,
                hashedPassword: yield this.hashPassword(user.password, salt),
                salt: salt,
                admin: user.admin
            };
            // add the user to the authfile
            authfile.push(newUser);
            // update the auth.json
            yield fs.writeJson(hb_1.hb.authPath, authfile, { spaces: 4 });
            hb_1.hb.log(`Added new user: ${user.username}`);
        });
    }
    updateUser(userId, update) {
        return __awaiter(this, void 0, void 0, function* () {
            const authfile = yield this.getUsers();
            const user = authfile.find(x => x.id === userId);
            if (!user) {
                throw new Error('User Not Found');
            }
            user.name = update.name || user.name;
            user.admin = (update.admin === undefined) ? user.admin : update.admin;
            if (update.password) {
                const salt = yield this.genSalt();
                user.hashedPassword = yield this.hashPassword(update.password, salt);
                user.salt = salt;
            }
            // update the auth.json
            yield fs.writeJson(hb_1.hb.authPath, authfile, { spaces: 4 });
            hb_1.hb.log(`Updated user: ${user.username}`);
        });
    }
    deleteUser(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const authfile = yield this.getUsers();
            const index = authfile.findIndex(x => x.id === parseInt(id, 10));
            if (index < 0) {
                throw new Error('User not found');
            }
            // prevent deleting the only admin user
            if (authfile[index].admin && authfile.filter(x => x.admin === true).length < 2) {
                throw new Error('Cannot delete only admin user');
            }
            authfile.splice(index, 1);
            // update the auth.json
            yield fs.writeJson(hb_1.hb.authPath, authfile, { spaces: 4 });
            hb_1.hb.log(`Deleted user with ID ${id}`);
        });
    }
    getJwt(user) {
        return __awaiter(this, void 0, void 0, function* () {
            return jwt.signAsync({
                username: user.username,
                name: user.name,
                admin: user.admin
            }, user.hashedPassword, { expiresIn: '8h' });
        });
    }
    verifyJwt(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const decoded = jwt.decode(token);
            if (!decoded) {
                return null;
            }
            const user = yield this.findByUsername(decoded.username);
            if (user) {
                try {
                    yield jwt.verifyAsync(token, user.hashedPassword);
                    return user;
                }
                catch (e) {
                    hb_1.hb.log(`Invalid token sent by ${user.username}: ${e.message}`);
                    return null;
                }
            }
            else {
                return null;
            }
        });
    }
    ensureAdmin(req, res, next) {
        if (req.user && req.user.admin) {
            return next();
        }
        else {
            hb_1.hb.warn(`403 Forbidden [${req.user.username}] ${req.originalUrl}`);
            return res.sendStatus(403);
        }
    }
    updateOldPasswords() {
        return __awaiter(this, void 0, void 0, function* () {
            let authfile = yield this.getUsers();
            authfile = yield Bluebird.map(authfile, (user) => __awaiter(this, void 0, void 0, function* () {
                if (user.password && !user.hashedPassword) {
                    const salt = yield this.genSalt();
                    user.hashedPassword = yield this.hashPassword(user.password, salt);
                    user.salt = salt;
                    delete user.password;
                    hb_1.hb.log(`Hashed password for "${user.username}" in auth.json`);
                    return user;
                }
                else {
                    return user;
                }
            }));
            // update the auth.json
            yield fs.writeJson(hb_1.hb.authPath, authfile, { spaces: 4 });
        });
    }
    setupDefaultUser() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.addUser({
                'username': 'admin',
                'password': 'admin',
                'name': 'Administrator',
                'admin': true
            });
        });
    }
    setupAuthFile() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield fs.pathExists(hb_1.hb.authPath))) {
                yield fs.writeJson(hb_1.hb.authPath, []);
            }
            const authfile = yield this.getUsers();
            // if there are no admin users, add the default user
            if (!authfile.find(x => x.admin === true || x.username === 'admin')) {
                yield this.setupDefaultUser();
            }
            // update older auth.json files from plain text to hashed passwords
            if (authfile.find(x => x.password && !x.hashedPassword)) {
                yield this.updateOldPasswords();
            }
        });
    }
}
exports.users = new Users();
//# sourceMappingURL=users.js.map