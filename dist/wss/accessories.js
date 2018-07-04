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
const hap_client_1 = require("@oznu/hap-client");
const hb_1 = require("../hb");
class AccessoriesWssHandler {
    constructor(ws, req) {
        this.ws = ws;
        // setup hap client
        this.hapClient = new hap_client_1.HapClient(`http://localhost:${hb_1.hb.homebridgeConfig.bridge.port}`, hb_1.hb.homebridgeConfig.bridge.pin);
        // on connect send everything
        this.loadAccessories(true);
        // load accessories at an interval
        const loadAccessoriesInterval = setInterval(this.loadAccessories.bind(this), 3000);
        // handling incoming requests
        const requestHandler = (msg) => __awaiter(this, void 0, void 0, function* () {
            if (msg.set) {
                const service = this.services.find(x => x.aid === msg.set.aid && x.iid === msg.set.siid);
                yield service.setCharacteristic(msg.set.iid, msg.set.value);
                yield this.loadAccessories();
            }
        });
        ws.on('accessories', requestHandler);
        // when the client disconnects stop checking the accessories status
        const onClose = () => {
            onUnsubscribe('accessories');
        };
        ws.on('close', onClose);
        // when the client leaves the accessories page, stop checking the accessories status
        const onUnsubscribe = (sub) => {
            if (sub === 'accessories') {
                clearInterval(loadAccessoriesInterval);
                ws.removeEventListener('accessories', requestHandler);
                ws.removeEventListener('unsubscribe', onUnsubscribe);
                ws.removeEventListener('close', onClose);
            }
        };
        ws.on('unsubscribe', onUnsubscribe);
    }
    send(data) {
        if (this.ws.readyState === 1) {
            this.ws.send(JSON.stringify({ accessories: data }));
        }
    }
    loadAccessories(refreshServices) {
        return this.hapClient.getAllServices()
            .then(services => {
            this.services = services;
            this.send({ services: services });
            if (refreshServices) {
                services.forEach(service => service.refreshCharacteristics());
            }
        })
            .catch((e) => {
            if (e.statusCode === 401) {
                hb_1.hb.warn(`Homebridge must be running in insecure mode to view and control accessories from this plugin.`);
                this.ws.emit('unsubscribe', 'accessories');
            }
            else {
                hb_1.hb.error(`Failed load accessories from Homebridge: ${e.message}`);
            }
        });
    }
}
exports.AccessoriesWssHandler = AccessoriesWssHandler;
//# sourceMappingURL=accessories.js.map