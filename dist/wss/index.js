"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url = require("url");
const qs = require("qs");
const WebSocket = require("ws");
const hb_1 = require("../hb");
const users_1 = require("../users");
const logs_1 = require("./logs");
const status_1 = require("./status");
const accessories_1 = require("./accessories");
const terminal_1 = require("./terminal");
class WSS {
    constructor(server) {
        this.server = new WebSocket.Server({
            server: server,
            verifyClient: this.verifyClient
        });
        this.subscriptions = {
            logs: logs_1.LogsWssHandler,
            status: status_1.StatusWssHandler,
            accessories: accessories_1.AccessoriesWssHandler,
            terminal: terminal_1.TerminalWssHandler,
        };
        this.routes = Object.keys(this.subscriptions);
        this.server.on('connection', (ws, req) => {
            // basic ws router
            ws.on('message', (data) => {
                let msg;
                try {
                    msg = JSON.parse(data.toString());
                }
                catch (e) {
                    hb_1.hb.log(`Invalid message sent to WebSocket server: ${data}`);
                    return null;
                }
                if (msg.subscribe) {
                    this.subscribeHandler(ws, req, msg);
                }
                else if (msg.unsubscribe) {
                    this.unsubscribeHandler(ws, req, msg);
                }
                this.routes.forEach((sub) => {
                    if (sub in msg) {
                        ws.emit(sub, msg[sub]);
                    }
                });
            });
            // absorb websocket errors
            ws.on('error', () => { });
        });
    }
    verifyClient(info, callback) {
        // authenticate the websocket connection using a jwt
        const params = qs.parse(url.parse(info.req.url).query);
        if (params.token) {
            return users_1.users.verifyJwt(params.token)
                .then((user) => {
                if (user) {
                    info.req.user = user;
                    return callback(true);
                }
                else {
                    // invalid token - reject the websocket connection
                    hb_1.hb.log('Unauthorised WebSocket Connection Closed');
                    return callback(false);
                }
            })
                .catch(() => callback(false));
        }
        else {
            // no token provided - reject the websocket connection
            hb_1.hb.log('Unauthorised WebSocket Connection Closed');
            return callback(false);
        }
    }
    subscribeHandler(ws, req, msg) {
        if (this.subscriptions[msg.subscribe]) {
            return new this.subscriptions[msg.subscribe](ws, req);
        }
        else {
            hb_1.hb.log(`Invalid subscription: ${msg.subscribe}`);
        }
    }
    unsubscribeHandler(ws, req, msg) {
        if (this.subscriptions[msg.unsubscribe]) {
            ws.emit('unsubscribe', msg.unsubscribe);
        }
        else {
            hb_1.hb.log(`Invalid subscription: ${msg.unsubscribe}`);
        }
    }
}
exports.WSS = WSS;
//# sourceMappingURL=index.js.map