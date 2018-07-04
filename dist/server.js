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
const http = require("http");
const https = require("https");
const fs = require("fs");
const hb_1 = require("./hb");
const users_1 = require("./users");
class UiServer {
    constructor(setup) {
        this.setup = setup;
        this.init().catch((err) => {
            hb_1.hb.error(err);
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            hb_1.hb.init(this.setup);
            yield users_1.users.setupAuthFile();
            yield hb_1.hb.refreshHomebridgeConfig();
            // dynamically load modules
            const { ExpressServer } = yield Promise.resolve().then(() => require('./app'));
            const { WSS } = yield Promise.resolve().then(() => require('./wss'));
            const app = new ExpressServer().app;
            if (this.setup.config.ssl && ((this.setup.config.ssl.key && this.setup.config.ssl.cert) || this.setup.config.ssl.pfx)) {
                // start the server using https if user has supplied certificates
                yield this.startWithHttps(app);
            }
            else {
                // start the http server
                yield this.startServer(app);
            }
            // attach websocker server to the express server
            hb_1.hb.wss = new WSS(this.server);
            this.server.listen(hb_1.hb.port);
            this.server.on('error', this.onServerError.bind(this));
            this.server.on('listening', this.onServerListening.bind(this));
        });
    }
    startServer(app) {
        return __awaiter(this, void 0, void 0, function* () {
            this.server = http.createServer(app);
        });
    }
    startWithHttps(app) {
        return __awaiter(this, void 0, void 0, function* () {
            hb_1.hb.warn('Starting server using HTTPS');
            this.server = https.createServer({
                key: this.setup.config.ssl.key ? fs.readFileSync(this.setup.config.ssl.key) : undefined,
                cert: this.setup.config.ssl.cert ? fs.readFileSync(this.setup.config.ssl.cert) : undefined,
                pfx: this.setup.config.ssl.pfx ? fs.readFileSync(this.setup.config.ssl.pfx) : undefined,
                passphrase: this.setup.config.ssl.passphrase
            }, app);
        });
    }
    onServerListening() {
        const addr = this.server.address();
        const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
        const msg = `Console v${hb_1.hb.ui.version} is listening on ${bind}.`;
        hb_1.hb.log(msg);
    }
    onServerError(error) {
        if (error.syscall !== 'listen') {
            throw error;
        }
        const bind = typeof hb_1.hb.port === 'string' ? 'Pipe ' + hb_1.hb.port : 'Port ' + hb_1.hb.port;
        switch (error.code) {
            case 'EACCES':
                console.error(bind + ' requires elevated privileges');
                process.exit(1);
                break;
            case 'EADDRINUSE':
                console.error(bind + ' is already in use');
                process.exit(1);
                break;
            default:
                throw error;
        }
    }
}
exports.UiServer = UiServer;
//# sourceMappingURL=server.js.map