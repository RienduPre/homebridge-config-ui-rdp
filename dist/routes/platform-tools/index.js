"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const hb_1 = require("../../hb");
const docker_1 = require("./docker");
const linux_1 = require("./linux");
class PlatformToolsRouter {
    constructor() {
        this.router = express_1.Router();
        // docker specific routes
        if (hb_1.hb.runningInDocker) {
            this.router.use('/docker', new docker_1.DockerRouter().router);
        }
        // linux specific routes
        if (hb_1.hb.runningInLinux) {
            this.router.use('/linux', new linux_1.LinuxRouter().router);
        }
    }
}
exports.PlatformToolsRouter = PlatformToolsRouter;
//# sourceMappingURL=index.js.map