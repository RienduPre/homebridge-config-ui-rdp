"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const bufferShim = require("buffer-shims");
const hb_1 = require("./hb");
class QRCode {
    constructor() {
        this.accessoryId = hb_1.hb.homebridgeConfig.bridge.username.split(':').join('');
        this.accessoryInfoPath = path.join(hb_1.hb.storagePath, 'persist', `AccessoryInfo.${this.accessoryId}.json`);
        this.getCode();
    }
    getCode() {
        if (this.setupCode) {
            return this.setupCode;
        }
        else {
            this.setupCode = this.generateCode();
            return this.setupCode;
        }
    }
    generateCode() {
        if (!fs.existsSync(this.accessoryInfoPath)) {
            return null;
        }
        this._accessoryInfo = require(this.accessoryInfoPath);
        // this code is from https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/Accessory.js#L369
        const buffer = bufferShim.alloc(8);
        const setupCode = parseInt(this._accessoryInfo.pincode.replace(/-/g, ''), 10);
        let valueLow = setupCode;
        const valueHigh = this._accessoryInfo.category >> 1;
        valueLow |= 1 << 28; // Supports IP;
        buffer.writeUInt32BE(valueLow, 4);
        if (this._accessoryInfo.category & 1) {
            buffer[4] = buffer[4] | 1 << 7;
        }
        buffer.writeUInt32BE(valueHigh, 0);
        let encodedPayload = (buffer.readUInt32BE(4) + (buffer.readUInt32BE(0) * Math.pow(2, 32))).toString(36).toUpperCase();
        if (encodedPayload.length !== 9) {
            for (let i = 0; i <= 9 - encodedPayload.length; i++) {
                encodedPayload = '0' + encodedPayload;
            }
        }
        return 'X-HM://' + encodedPayload + this._accessoryInfo.setupID;
    }
}
exports.qrcode = new QRCode();
//# sourceMappingURL=qrcode.js.map