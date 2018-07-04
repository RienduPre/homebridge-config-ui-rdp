"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const express = require("express");
const bodyParser = require("body-parser");
const hb_1 = require("./hb");
const auth_1 = require("./auth");
const users_1 = require("./routes/users");
const login_1 = require("./routes/login");
const settings_1 = require("./routes/settings");
const server_1 = require("./routes/server");
const config_1 = require("./routes/config");
const packages_1 = require("./routes/packages");
const accessories_1 = require("./routes/accessories");
const platform_tools_1 = require("./routes/platform-tools");
class ExpressServer {
    constructor() {
        this.cspWsOveride = '';
        this.auth = new auth_1.AuthMiddleware();
        this.app = express();
        if (hb_1.hb.proxyHost) {
            this.cspWsOveride = `wss://${hb_1.hb.proxyHost} ws://${hb_1.hb.proxyHost}`;
        }
        // set some headers to help secure the app
        this.app.use(helmet({
            hsts: false,
            frameguard: false,
            referrerPolicy: true,
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ['\'self\''],
                    scriptSrc: ['\'self\'', '\'unsafe-inline\'', '\'unsafe-eval\''],
                    styleSrc: ['\'self\'', '\'unsafe-inline\''],
                    imgSrc: ['\'self\'', 'data:', 'https://raw.githubusercontent.com'],
                    workerSrc: ['blob:'],
                    connectSrc: ['\'self\'', (req) => {
                            return `wss://${req.headers.host} ws://${req.headers.host} ${this.cspWsOveride}`;
                        }],
                }
            }
        }));
        // authentication middleware
        this.app.use(this.auth.init);
        // load angular spa
        this.app.get('/', this.auth.staticAuth, this.serveSpa);
        // login page image
        this.app.use('/assets/snapshot.jpg', (req, res, next) => {
            if (hb_1.hb.loginWallpaper) {
                res.sendFile(path.resolve(hb_1.hb.loginWallpaper));
            }
            else {
                res.sendFile(path.resolve(__dirname, '../public/assets/snapshot.jpg'));
            }
        });
        // static assets
        this.app.use(express.static(path.resolve(__dirname, '../public')));
        // enable cors for development using ng serve
        this.app.use(cors({
            origin: ['http://localhost:4200'],
            credentials: true
        }));
        // json post handler
        this.app.use(bodyParser.json());
        this.app.use('/api/login', new login_1.LoginRouter().router);
        this.app.use('/api/settings', new settings_1.SettingsRouter().router);
        // force authentication on all other /api routes
        this.app.use('/api', this.auth.main);
        // authenticated routes
        this.app.use('/api/server', new server_1.ServerRouter().router);
        this.app.use('/api/users', new users_1.UserRouter().router);
        this.app.use('/api/packages', new packages_1.PackageRouter().router);
        this.app.use('/api/config', new config_1.ConfigRouter().router);
        this.app.use('/api/accessories', new accessories_1.AccessoriesRouter().router);
        // platform tools router
        this.app.use('/api', new platform_tools_1.PlatformToolsRouter().router);
        // serve index.html for anything not on the /api routes
        this.app.get(/^((?!api\/).)*$/, this.auth.staticAuth, this.serveSpa);
        // 404 handler
        this.app.use(this.notFound);
        // error handler
        this.app.use(this.errorHandler);
    }
    serveSpa(req, res, next) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(path.resolve(__dirname, '../public/index.html'), { etag: false });
    }
    notFound(req, res, next) {
        res.sendStatus(404);
    }
    errorHandler(err, req, res, next) {
        hb_1.hb.error(err);
        if (res.statusCode === 200) {
            res.status(500);
        }
        res.json({
            error: err,
            message: err.message
        });
    }
}
exports.ExpressServer = ExpressServer;
//# sourceMappingURL=app.js.map