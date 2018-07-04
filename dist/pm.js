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
const os = require("os");
const _ = require("lodash");
const path = require("path");
const fs = require("fs-extra");
const pty = require("node-pty");
const semver = require("semver");
const color = require("bash-color");
const Bluebird = require("bluebird");
const rp = require("request-promise");
const child_process = require("child_process");
const childProcess = Bluebird.promisifyAll(child_process);
const hb_1 = require("./hb");
class PackageManager {
    constructor() {
        // load base paths where plugins might be installed
        this.paths = this.getBasePaths();
        // setup requests with default options
        this.rp = rp.defaults({ json: true });
        // get npm path
        this.npm = this.getNpmPath();
        // pre-load installed plugins
        this.plugins = [];
        this.getInstalled();
    }
    getNpmPath() {
        if (os.platform() === 'win32') {
            // if running on windows find the full path to npm
            const windowsNpmPath = [
                path.join(process.env.APPDATA, 'npm/npm.cmd'),
                path.join(process.env.ProgramFiles, 'nodejs/npm.cmd')
            ]
                .filter(fs.existsSync);
            if (windowsNpmPath.length) {
                return [windowsNpmPath[0], '--no-update-notifier'];
            }
            else {
                hb_1.hb.error(`ERROR: Cannot find npm binary. You will not be able to manage plugins or update homebridge.`);
                hb_1.hb.error(`ERROR: You might be able to fix this problem by running: npm install -g npm`);
            }
        }
        // Linux and macOS don't require the full path to npm
        return ['npm', '--no-update-notifier'];
    }
    getBasePaths() {
        // this is the same code used by homebridge to find plugins
        // https://github.com/nfarina/homebridge/blob/c73a2885d62531925ea439b9ad6d149a285f6daa/lib/plugin.js#L105-L134
        let paths = [];
        // add the paths used by require()
        paths = paths.concat(require.main.paths);
        if (hb_1.hb.pluginPath) {
            this.customPluginPath = path.resolve(process.cwd(), hb_1.hb.pluginPath);
            paths.unshift(this.customPluginPath);
        }
        // THIS SECTION FROM: https://github.com/yeoman/environment/blob/master/lib/resolver.js
        // Adding global npm directories
        // We tried using npm to get the global modules path, but it haven't work out
        // because of bugs in the parseable implementation of `ls` command and mostly
        // performance issues. So, we go with our best bet for now.
        if (process.env.NODE_PATH) {
            paths = process.env.NODE_PATH.split(path.delimiter)
                .filter((p) => !!p) // trim out empty values
                .concat(paths);
        }
        else {
            // Default paths for each system
            if ((os.platform() === 'win32')) {
                paths.push(path.join(process.env.APPDATA, 'npm/node_modules'));
            }
            else {
                paths.push('/usr/local/lib/node_modules');
                paths.push('/usr/lib/node_modules');
                paths.push(childProcess.execSync('/bin/echo -n "$(npm --no-update-notifier -g prefix)/lib/node_modules"').toString('utf8'));
            }
        }
        // filter out duplicates and non-existent paths
        return _.uniq(paths).filter((requiredPath) => {
            return fs.existsSync(requiredPath);
        });
    }
    wssBroadcast(data) {
        hb_1.hb.wss.server.clients.forEach(function each(client) {
            if (client.readyState === 1) {
                client.send(JSON.stringify({ npmLog: data }));
            }
        });
    }
    wssBroadcastComplete(pkg, succeeded) {
        hb_1.hb.wss.server.clients.forEach(function each(client) {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    npmInstall: {
                        pkg: pkg,
                        succeeded: succeeded,
                    }
                }));
            }
        });
    }
    executeCommand(command, cwd) {
        let timeoutTimer;
        command = command.filter(x => x.length);
        // sudo mode is requested in plugin config
        if (hb_1.hb.useSudo) {
            command.unshift('sudo', '-E', '-n');
        }
        hb_1.hb.log(`Running Command: ${command.join(' ')}`);
        this.wssBroadcast(color.cyan(`USER: ${os.userInfo().username}\n\r`));
        this.wssBroadcast(color.cyan(`DIR: ${cwd}\n\r`));
        this.wssBroadcast(color.cyan(`CMD: ${command.join(' ')}\n\r\n\r`));
        return new Bluebird((resolve, reject) => {
            const term = pty.spawn(command.shift(), command, {
                name: 'xterm-color',
                cols: 80,
                rows: 30,
                cwd: cwd,
                env: process.env
            });
            // send stdout data from the process to all clients
            term.on('data', (data) => {
                this.wssBroadcast(data);
            });
            // send an error message to the client if the command does not exit with code 0
            term.on('exit', (code) => {
                if (code === 0) {
                    this.wssBroadcast(color.green(`\n\rCommand succeeded!.\n\r`));
                    clearTimeout(timeoutTimer);
                    resolve();
                }
                else {
                    clearTimeout(timeoutTimer);
                    reject(`Command failed. Please review log for details`);
                }
            });
            // if the command spends to long trying to execute kill it after 5 minutes
            timeoutTimer = setTimeout(() => {
                term.kill('SIGTERM');
            }, 300000);
        })
            .then(() => {
            // update the installed cache
            return this.getInstalled();
        });
    }
    getInstalled() {
        const staging = [];
        const plugins = [];
        return Bluebird.map(this.paths, (requiredPath) => {
            return Bluebird.resolve(fs.readdir(requiredPath))
                .then((standardPlugins) => __awaiter(this, void 0, void 0, function* () {
                // check if any certified homebridge plugins are installed and add them to the list
                if (fs.existsSync(path.resolve(requiredPath, '@homebridge'))) {
                    const certifiedPlugins = yield fs.readdir(path.resolve(requiredPath, '@homebridge'));
                    certifiedPlugins.forEach((certifiedPlugin) => {
                        standardPlugins.push(path.join('@homebridge', certifiedPlugin));
                    });
                }
                return standardPlugins;
            }))
                .map(name => path.join(requiredPath, name))
                .filter(pluginPath => fs.stat(path.join(pluginPath, 'package.json')).catch(x => false))
                .map(pluginPath => fs.readFile(path.join(pluginPath, 'package.json'), 'utf8').then(JSON.parse).catch(x => false))
                .filter(pluginPath => pluginPath)
                .filter(pjson => pjson.name && ((pjson.name.indexOf('homebridge-') === 0) || pjson.name.indexOf('@homebridge/homebridge-') === 0))
                .filter(pjson => pjson.keywords && pjson.keywords.includes('homebridge-plugin'))
                .map(pjson => {
                const plugin = {
                    name: pjson.name,
                    installed: pjson.version || '0.0.1',
                    description: (pjson.description) ?
                        pjson.description.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '').trim() : pjson.name,
                    globalInstall: (requiredPath !== this.customPluginPath),
                    pluginPath: requiredPath,
                    settingsSchema: fs.existsSync(path.resolve(requiredPath, pjson.name, 'config.schema.json')),
                    certifiedPlugin: (pjson.name.indexOf('@homebridge/homebridge-') === 0),
                };
                return this.rp.get(`https://registry.npmjs.org/${encodeURIComponent(pjson.name).replace('%40', '@')}`)
                    .then((pkg) => {
                    // found on npm, it's a public package
                    plugin.publicPackage = true;
                    plugin.version = pkg['dist-tags'].latest;
                    plugin.update = semver.lt(plugin.installed, plugin.version);
                    plugin.links = {
                        npm: `https://www.npmjs.com/package/${pjson.name}`,
                        homepage: pkg.homepage,
                        bugs: (pkg.bugs) ? pkg.bugs.url : null
                    };
                    plugin.author = (pkg.maintainers.length) ? pkg.maintainers[0].name : null;
                    if (!staging.find(x => x.name === plugin.name && x.globalInstall === plugin.globalInstall)) {
                        staging.push(plugin);
                    }
                })
                    .catch((err) => {
                    if (err.statusCode !== 404) {
                        console.error(err.message);
                    }
                    // not found on npm, assuming a non public package
                    plugin.publicPackage = false;
                    plugin.version = 'N/A';
                    plugin.update = false;
                    plugin.links = false;
                    if (!staging.find(x => x.name === plugin.name && x.globalInstall === plugin.globalInstall)) {
                        staging.push(plugin);
                    }
                });
            });
        })
            .then(() => {
            // filter out duplicate plugins and give preference to non-global plugins
            staging.forEach((plugin) => {
                if (!plugins.find(x => plugin.name === x.name)) {
                    plugins.push(plugin);
                }
                else if (!plugin.globalInstall && plugins.find(x => plugin.name === x.name && x.globalInstall === true)) {
                    const index = plugins.findIndex(x => plugin.name === x.name && x.globalInstall === true);
                    plugins[index] = plugin;
                }
            });
            this.plugins = _.sortBy(plugins, ['name']);
            return this.plugins;
        });
    }
    searchRegistry(query) {
        const packages = [];
        const q = ((!query || !query.length) ? '' : query + '+') + 'keywords:homebridge-plugin+not:deprecated&size=30';
        return this.rp.get(`https://registry.npmjs.org/-/v1/search?text=${q}`)
            .then((res) => {
            return res.objects;
        })
            .filter(pkg => pkg.package.name
            && ((pkg.package.name.indexOf('homebridge-') === 0)) || pkg.package.name.indexOf('@homebridge/homebridge-') === 0)
            .map((pkg) => {
            if (this.plugins.find(x => x.name === pkg.package.name)) {
                // a plugin with the same name is already installed
                const installedPlugin = this.plugins.find(x => x.name === pkg.package.name);
                packages.push({
                    publicPackage: true,
                    name: pkg.package.name,
                    installed: installedPlugin.installed,
                    version: pkg.package.version,
                    update: semver.lt(installedPlugin.installed, pkg.package.version),
                    description: (pkg.package.description) ?
                        pkg.package.description.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '').trim() : pkg.package.name,
                    links: pkg.package.links,
                    author: (pkg.package.publisher) ? pkg.package.publisher.username : null,
                    certifiedPlugin: (pkg.package.name.indexOf('@homebridge/homebridge-') === 0),
                });
            }
            else {
                packages.push({
                    publicPackage: true,
                    name: pkg.package.name,
                    version: pkg.package.version,
                    description: (pkg.package.description) ?
                        pkg.package.description.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '').trim() : pkg.package.name,
                    links: pkg.package.links,
                    author: (pkg.package.publisher) ? pkg.package.publisher.username : null,
                    certifiedPlugin: (pkg.package.name.indexOf('@homebridge/homebridge-') === 0),
                });
            }
        })
            .then(x => packages);
    }
    getHomebridge() {
        return this.rp.get(`https://registry.npmjs.org/${encodeURIComponent(hb_1.hb.homebridgeNpmPkg).replace('%40', '@')}`)
            .then(pkg => {
            return {
                name: pkg.name,
                installed: hb_1.hb.homebridgeVersion,
                version: pkg['dist-tags'].latest,
                update: semver.lt(hb_1.hb.homebridgeVersion, pkg['dist-tags'].latest),
                description: (pkg.description) ?
                    pkg.description.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '').trim() : pkg.name,
                fork: false
            };
        });
    }
    getHomebridgeFork() {
        return this.rp.get(`https://raw.githubusercontent.com/${hb_1.hb.homebridgeFork}/master/package.json`)
            .then(pkg => {
            return {
                name: pkg.name,
                installed: hb_1.hb.homebridgeVersion,
                version: pkg.version,
                update: semver.lt(hb_1.hb.homebridgeVersion, pkg.version),
                description: (pkg.description) ?
                    pkg.description.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '').trim() : pkg.name,
                fork: hb_1.hb.homebridgeFork
            };
        });
    }
    installPlugin(pkg) {
        return this.getInstalled()
            .then(plugins => {
            // install new plugins in the same location as this plugin
            let installPath = (this.customPluginPath) ? this.customPluginPath : plugins.find(x => x.name === hb_1.hb.ui.name).pluginPath;
            // prepare flags for npm command
            const installOptions = [];
            // check to see if custom plugin path is using a package.json file
            if (installPath === this.customPluginPath && fs.existsSync(path.resolve(installPath, '../package.json'))) {
                installPath = path.resolve(installPath, '../');
                installOptions.push('--save');
            }
            return this.executeCommand([...this.npm, 'install', '--unsafe-perm', ...installOptions, `${pkg}@latest`], installPath);
        })
            .then(() => {
            this.wssBroadcastComplete(pkg, true);
        })
            .catch((err) => {
            this.wssBroadcast(color.red(`\n\r${err}\n\r`));
            this.wssBroadcastComplete(pkg, false);
            hb_1.hb.error(`Failed to install ${pkg}`);
        });
    }
    removePlugin(pkg) {
        return this.getInstalled()
            .then(plugins => {
            // install new plugins in the same location as this plugin
            let installPath;
            if (plugins.find(x => x.name === pkg)) {
                installPath = plugins.find(x => x.name === pkg).pluginPath;
            }
            else {
                throw new Error(`Plugin "${pkg}" Not Found`);
            }
            // prepare flags for npm command
            const installOptions = [];
            // check to see if custom plugin path is using a package.json file
            if (installPath === this.customPluginPath && fs.existsSync(path.resolve(installPath, '../package.json'))) {
                installPath = path.resolve(installPath, '../');
                installOptions.push('--save');
            }
            return this.executeCommand([...this.npm, 'uninstall', '--unsafe-perm', ...installOptions, pkg], installPath);
        })
            .then(() => {
            this.wssBroadcastComplete(pkg, true);
        })
            .catch((err) => {
            this.wssBroadcast(color.red(`\n\r${err}\n\r`));
            this.wssBroadcastComplete(pkg, false);
            hb_1.hb.error(`Failed to remove ${pkg}`);
        });
    }
    updatePlugin(pkg) {
        return this.getInstalled()
            .then(plugins => {
            // install new plugins in the same location as this plugin
            let installPath;
            if (plugins.find(x => x.name === pkg)) {
                installPath = plugins.find(x => x.name === pkg).pluginPath;
            }
            else {
                throw new Error(`Plugin "${pkg}" Not Found`);
            }
            // prepare flags for npm command
            const installOptions = [];
            // check to see if custom plugin path is using a package.json file
            if (installPath === this.customPluginPath && fs.existsSync(path.resolve(installPath, '../package.json'))) {
                installPath = path.resolve(installPath, '../');
                installOptions.push('--save');
            }
            return this.executeCommand([...this.npm, 'install', '--unsafe-perm', ...installOptions, `${pkg}@latest`], installPath);
        })
            .then(() => {
            this.wssBroadcastComplete(pkg, true);
        })
            .catch((err) => {
            this.wssBroadcast(color.red(`\n\r${err}\n\r`));
            this.wssBroadcastComplete(pkg, false);
            hb_1.hb.error(`Failed to update ${pkg}`);
        });
    }
    updateHomebridge() {
        const paths = this.getBasePaths();
        let yarnDir = null;
        // check if homebridge was installed using yarn
        return childProcess.execAsync('yarn global dir', { cwd: os.tmpdir() })
            .then(data => {
            yarnDir = path.join(data.trim(data), 'node_modules');
            paths.push(yarnDir);
            return paths;
        })
            .catch(() => {
            return paths;
        })
            .filter(requiredPath => fs.stat(path.join(requiredPath, hb_1.hb.homebridgeNpmPkg, 'package.json')).catch(x => false))
            .map(installPath => {
            hb_1.hb.log(`Using npm to upgrade homebridge at ${installPath}...`);
            const pkg = hb_1.hb.homebridgeFork ? hb_1.hb.homebridgeFork : `${hb_1.hb.homebridgeNpmPkg}@latest`;
            return this.executeCommand([...this.npm, 'install', '--unsafe-perm', pkg], installPath)
                .then(() => {
                hb_1.hb.log(`Upgraded homebridge using npm at ${installPath}`);
            });
        })
            .then(() => {
            this.wssBroadcastComplete('homebridge', true);
        })
            .catch((err) => {
            this.wssBroadcast(color.red(`\n\r${err}\n\r`));
            this.wssBroadcastComplete('homebridge', false);
            hb_1.hb.error('Failed to update homebridge');
        });
    }
    getChangeLog(pkg) {
        return this.getInstalled()
            .then(plugins => {
            let installPath;
            if (plugins.find(x => x.name === pkg)) {
                installPath = plugins.find(x => x.name === pkg).pluginPath;
            }
            else {
                throw new Error(`Plugin "${pkg}" Not Found`);
            }
            // possible change log file name
            let changeLogFileNames = [
                'CHANGELOG.md',
                'CHANGELOG'
            ];
            // check to see which ones is used
            changeLogFileNames = changeLogFileNames.filter((fileName) => fs.existsSync(path.resolve(installPath, pkg, fileName)));
            // no change log found, return null
            if (!changeLogFileNames.length) {
                return Promise.resolve(null);
            }
            // the plugin change log path
            const changeLogPath = path.resolve(installPath, pkg, changeLogFileNames[0]);
            // return the change log
            return fs.readFile(changeLogPath, 'utf8');
        });
    }
    getConfigSchema(pkg) {
        let installPath;
        if (this.plugins.find(x => x.name === pkg)) {
            installPath = this.plugins.find(x => x.name === pkg).pluginPath;
        }
        else {
            throw new Error(`Plugin "${pkg}" Not Found`);
        }
        const schemaPath = path.resolve(installPath, pkg, 'config.schema.json');
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Plugin "${pkg}" Does Not Container "config.schema.json"`);
        }
        return fs.readJson(schemaPath);
    }
}
exports.pm = new PackageManager();
//# sourceMappingURL=pm.js.map