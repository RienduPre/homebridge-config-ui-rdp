"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.title = 'homebridge-config-ui-x';
require("source-map-support/register");
const server_1 = require("../server");
setInterval(() => {
    if (!process.connected) {
        process.exit(1);
    }
}, 10000);
process.on('message', (message) => {
    if (typeof message === 'object') {
        return new server_1.UiServer(message);
    }
});
process.on('disconnect', () => {
    process.exit();
});
process.send('ready');
//# sourceMappingURL=fork.js.map