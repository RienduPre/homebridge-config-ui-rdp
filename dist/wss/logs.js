"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const os = require("os");
const fs = require("fs");
const pty = require("node-pty");
const color = require("bash-color");
const child_process = require("child_process");
const hb_1 = require("../hb");
class LogsWssHandler {
    constructor(ws, req) {
        this.ws = ws;
        if (typeof hb_1.hb.logOpts === 'object' && hb_1.hb.logOpts.method) {
            if (['file', 'systemd', 'custom'].indexOf(hb_1.hb.logOpts.method) < 0) {
                this.parseLegacyLogConfig();
            }
            else if (hb_1.hb.logOpts.method === 'file' && !hb_1.hb.logOpts.path) {
                this.parseLegacyLogConfig();
            }
            else if (hb_1.hb.logOpts.method === 'custom' && !hb_1.hb.logOpts.command) {
                this.parseLegacyLogConfig();
            }
            else {
                this.logOpts = hb_1.hb.logOpts;
            }
        }
        else {
            this.parseLegacyLogConfig();
        }
        if (this.logOpts.method === 'file' && this.logOpts.path) {
            this.logFromFile();
        }
        else if (this.logOpts.method === 'systemd') {
            this.logFromSystemd();
        }
        else if (this.logOpts.method === 'custom' && this.logOpts.command) {
            this.logFromCommand();
        }
        else {
            this.logNotConfigured();
        }
        // listen for resize events from the client
        ws.on('logs', (msg) => {
            if (msg.size) {
                this.resizeTerminal(msg.size);
            }
        });
        // when the client disconnects stop tailing the log file
        const onClose = () => {
            onUnsubscribe('logs');
        };
        ws.on('close', onClose);
        // when the client leaves the log page, stop tailing the log file
        const onUnsubscribe = (sub) => {
            if (sub === 'logs') {
                this.killTerm();
                ws.removeAllListeners('logs');
                ws.removeEventListener('unsubscribe', onUnsubscribe);
                ws.removeEventListener('close', onClose);
            }
        };
        ws.on('unsubscribe', onUnsubscribe);
    }
    /**
     * @deprecated since 5.6.0
     */
    parseLegacyLogConfig() {
        if (hb_1.hb.logOpts && hb_1.hb.logOpts === 'systemd') {
            this.logOpts = {
                method: 'systemd',
                service: 'homebridge',
            };
            this.legacyConfigWarning();
        }
        else if (hb_1.hb.logOpts && typeof (hb_1.hb.logOpts) === 'string' && fs.existsSync(hb_1.hb.logOpts)) {
            this.logOpts = {
                method: 'file',
                path: hb_1.hb.logOpts,
            };
            this.legacyConfigWarning();
        }
        else if (hb_1.hb.logOpts && typeof (hb_1.hb.logOpts) === 'object' && hb_1.hb.logOpts.systemd && hb_1.hb.logOpts.systemd.length) {
            this.logOpts = {
                method: 'systemd',
                service: hb_1.hb.logOpts.systemd,
            };
            this.legacyConfigWarning();
        }
        else if (hb_1.hb.logOpts && typeof (hb_1.hb.logOpts) === 'object' && hb_1.hb.logOpts.tail) {
            this.logOpts = {
                method: 'custom',
                command: hb_1.hb.logOpts.tail,
            };
            this.legacyConfigWarning();
        }
        else {
            this.logOpts = {
                method: null
            };
        }
    }
    legacyConfigWarning() {
        hb_1.hb.warn('You are using a depreciated log config format, please update your config.json to use this new format:');
        hb_1.hb.warn(JSON.stringify(this.logOpts));
    }
    send(data) {
        if (this.ws.readyState === 1) {
            this.ws.send(JSON.stringify({ logs: data }));
        }
    }
    logFromFile() {
        let command;
        if (os.platform() === 'win32') {
            // windows - use powershell to tail log
            command = ['powershell.exe', '-command', `Get-Content -Path '${this.logOpts.path}' -Wait -Tail 200`];
        }
        else {
            // linux / macos etc
            command = ['tail', '-n', '200', '-f', this.logOpts.path];
            // sudo mode is requested in plugin config
            if (hb_1.hb.useSudo) {
                command.unshift('sudo', '-n');
            }
        }
        this.send(color.cyan(`Loading logs from file\r\nCMD: ${command.join(' ')}\r\n\r\n`));
        this.tailLog(command);
    }
    logFromSystemd() {
        const command = ['journalctl', '-o', 'cat', '-n', '500', '-f', '-u', this.logOpts.service || 'homebridge'];
        // sudo mode is requested in plugin config
        if (hb_1.hb.useSudo) {
            command.unshift('sudo', '-n');
        }
        this.send(color.cyan(`Using systemd to tail logs\r\nCMD: ${command.join(' ')}\r\n\r\n`));
        this.tailLog(command);
    }
    logFromCommand() {
        const command = this.logOpts.command.split(' ');
        this.send(color.cyan(`Using custom command to tail logs\r\nCMD: ${command.join(' ')}\r\n\r\n`));
        this.tailLog(command);
    }
    logNotConfigured() {
        this.send(color.red(`Cannot show logs. "log" option is not configured correctly in your Homebridge config.json file.\r\n\r\n`));
        this.send(color.cyan(`See https://github.com/oznu/homebridge-config-ui-x#log-viewer-configuration for instructions.\r\n`));
    }
    tailLog(command) {
        const cmd = command.join(' ');
        // spawn the process that will output the logs
        this.term = pty.spawn(command.shift(), command, {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: hb_1.hb.storagePath,
            env: process.env
        });
        // send stdout data from the process to the client
        this.term.on('data', this.send.bind(this));
        // send an error message to the client if the log tailing process exits early
        this.term.on('exit', (code) => {
            try {
                this.send('\n\r');
                this.send(color.red(`The log tail command "${cmd}" exited with code ${code}.\n\r`));
                this.send(color.red(`Please check the command in your config.json is correct.\n\r\n\r`));
                this.send(color.cyan(`See https://github.com/oznu/homebridge-config-ui-x#log-viewer-configuration for instructions.\r\n`));
            }
            catch (e) {
                // the client socket probably closed
            }
        });
    }
    resizeTerminal(size) {
        if (this.term) {
            this.term.resize(size.cols, size.rows);
        }
    }
    killTerm() {
        if (this.term) {
            try {
                this.term.kill();
                this.term.destroy();
            }
            catch (e) { }
            this.forceKillProcess();
        }
    }
    forceKillProcess() {
        if (hb_1.hb.useSudo && this.term && this.term.pid) {
            // really make sure the log tail command is killed when using sudo mode
            child_process.exec(`sudo -n kill -9 ${this.term.pid}`);
        }
    }
}
exports.LogsWssHandler = LogsWssHandler;
//# sourceMappingURL=logs.js.map