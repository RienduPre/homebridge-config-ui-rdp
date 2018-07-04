"use strict";
/* This class and it's methods are only used when running in the oznu/homebridge docker container */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs-extra");
const child_process = require("child_process");
const dotenv = require("dotenv");
const express_1 = require("express");
const hb_1 = require("../../hb");
const users_1 = require("../../users");
class DockerRouter {
    constructor() {
        this.dockerEnvVariables = [
            'HOMEBRIDGE_DEBUG',
            'HOMEBRIDGE_INSECURE'
        ];
        this.router = express_1.Router();
        this.router.get('/startup-script', users_1.users.ensureAdmin, this.getStartupScript.bind(this));
        this.router.post('/startup-script', users_1.users.ensureAdmin, this.saveStartupScript.bind(this));
        this.router.get('/env', users_1.users.ensureAdmin, this.getDockerEnv.bind(this));
        this.router.put('/env', users_1.users.ensureAdmin, this.saveDockerEnv.bind(this));
        this.router.put('/restart-container', users_1.users.ensureAdmin, this.restartContainer);
        this.dockerEnvPath = path.resolve(hb_1.hb.storagePath, '.docker.env');
        this.startupScriptPath = path.resolve(hb_1.hb.storagePath, 'startup.sh');
    }
    getStartupScript(req, res, next) {
        res.header({ 'content-type': 'text/plain' });
        return res.sendFile(this.startupScriptPath);
    }
    saveStartupScript(req, res, next) {
        return fs.writeFile(this.startupScriptPath, req.body.script)
            .then(() => {
            hb_1.hb.log('Updated startup.sh script');
            return res.status(202).json({ ok: true });
        })
            .catch(next);
    }
    restartContainer(req, res, next) {
        hb_1.hb.log('Request to restart docker container received');
        res.status(202).json({ ok: true });
        setTimeout(() => {
            child_process.exec('killall s6-svscan');
        }, 100);
    }
    getDockerEnv(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!fs.existsSync(this.dockerEnvPath)) {
                return res.sendStatus(404);
            }
            const resp = {};
            const file = yield fs.readFile(this.dockerEnvPath);
            const env = dotenv.parse(file);
            this.dockerEnvVariables.forEach((key) => {
                resp[key] = env[key] || process.env[key] || undefined;
                if (resp[key] === '1') {
                    resp[key] = true;
                }
                else if (resp[key] === '0') {
                    resp[key] = false;
                }
            });
            return res.json(resp);
        });
    }
    saveDockerEnv(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const resp = ['### This will overide environment variables set using the docker run command ###'];
            this.dockerEnvVariables.forEach((key) => {
                if (req.body[key] !== undefined && req.body[key] !== null) {
                    if (typeof (req.body[key]) === 'boolean') {
                        req.body[key] = req.body[key] ? '1' : '0';
                    }
                    if (typeof req.body[key] === 'string' && !req.body[key].trim().length) {
                        return;
                    }
                    resp.push(`${key}="${String(req.body[key]).trim()}"`);
                }
            });
            resp.push('### This file is managed by homebridge-config-ui-x ###');
            yield fs.writeFile(this.dockerEnvPath, resp.join('\n') + '\n');
            res.json({ ok: true });
        });
    }
}
exports.DockerRouter = DockerRouter;
//# sourceMappingURL=docker.js.map