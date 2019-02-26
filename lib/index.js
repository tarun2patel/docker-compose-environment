'use strict';

const Q        = require('q');
const _        = require('lodash');
const util     = require('util');
const Docker   = require('dockerode');
const CFError  = require('cf-errors');

class Environment {

    constructor(environment, infoLogger, taskLogger) {
        this.info          = environment;
        const instances    = [];
        this.instances     = instances;
        this.environmentId = environment.id;
        this._id           = environment._id;

        this.dockerNode = environment.dockerNode;

        const dockerOptions = {
            host: _.get(this.dockerNode, 'ip'),
            port: _.get(this.dockerNode, 'port'),
            protocol: _.get(this.dockerNode, 'protocol', 'https'),
            timeout: _.get(this.dockerNode, 'timeout', 30000),
            ca: _.get(this.dockerNode, 'certs.ca'),
            cert: _.get(this.dockerNode, 'certs.cert'),
            key: _.get(this.dockerNode, 'certs.key'),
        };

        if (_.get(this.dockerNode, 'notCheckServerCa')) {
            // See https://nodejs.org/api/tls.html -
            //    checkServerIdentity should be a function which returns undefined if ca check pass
            dockerOptions.checkServerIdentity = () => {};
        }
        this.dockerode = new Docker(dockerOptions);

        _.get(environment, 'instances', []).map((instanceDef) => {
            const instanceType = _.get(instanceDef, 'type', 'docker');
            const instance = new (require(`./instance/${instanceType}`))(instanceDef, this.dockerode);
            instances.push(instance);
        });

        this.infoLogger     = infoLogger;
        this.taskLogger     = taskLogger;
    }

    printError(error) {
        console.error(error.stack);
    }

    printInfo(message) {
        if (this.infoLogger) {
            this.infoLogger.info(message);
        } else {
            console.log(message);
        }
    }

    pause() {
        return this._process(this.instances, 'pause', 'paused');
    }

    unpause() {
        return this._process(this.instances, 'unpause', 'unpaused');
    }

    getStatus() {
        const deferred = Q.defer();

        const list = [];
        this.instances.map((instance) => {
            list.push(instance.getStatus());
        });

        Q.all(list)
            .then((statuses) => {
                let latest = null;

                statuses.map((status) => {
                    if (status === 'exited') {
                        return;
                    }

                    if (!latest) {
                        latest = status;
                    }
                    if (latest !== status) {
                        latest = 'warning';
                    }
                });

                if (util.isNullOrUndefined(latest)) {
                    latest = 'fatal';
                }

                deferred.resolve(latest);
            })
            .catch((err) => {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    terminate() {
        console.log(`Terminating environment: ${this.environmentId}`);
        return Q.resolve()
            .then(this._cleanContainers.bind(this))
            .then(this._cleanNetworks.bind(this))
            .then(this._cleanVolumes.bind(this))
            .then(this.cleanLog.bind(this))
            .then(() => 'terminated');
    }

    _process(instances, func, expct) {

        const deferred = Q.defer();

        const list = [];
        instances.map((instance) => {
            list.push(instance[func]());
        });

        Q.all(list)
            .then((statuses) => {
                let rc = true;
                statuses.map((status) => {
                    if (status !== expct) {
                        rc = false;
                    }
                });
                return rc ? deferred.resolve(expct) : deferred.reject('error');

            })
            .catch((err) => {
                deferred.reject(err);
            });

        return deferred.promise;
    }

    _cleanContainers() {

        return Q.resolve()
            .then(() => {
                this.printInfo('Cleaning up any leftover containers');
                const label = `"com.docker.compose.project=${this.environmentId}"`;
                console.log(`Reqeust all containers that match to label: ${label}`);
                const options = { all: 'true', filters: `{"label": [${label}]}` };
                return Q.ninvoke(this.dockerode, 'listContainers', options)
                .then((containers = []) => {
                    console.log(`Total containers on daemon that matched to query is: ${containers.length}`);
                    const promises = containers.map((container) => {
                        const containerObject = this.dockerode.getContainer(container.Id);
                        console.log(`Removing container id: ${container.Id}`);
                        return Q.ninvoke(containerObject, 'remove', { force: true })
                            .catch((err) => {
                                const error = new CFError({
                                    cause: err,
                                    message: `Error occurred trying to cleanup leftover container ${container.Id} of environment ${this.environmentId}`
                                });
                                this.printError(error);
                                return Q.reject(error);
                            });
                    });
                    return Q.all(promises);
                })
                .catch((err) => {
                    const error = new CFError({
                        cause: err,
                        message: `Error occurred trying to cleanup leftover containers of environment ${this.environmentId}`
                    });
                    this.printError(error);
                    return Q.resolve();
                });
            });
    }

    _cleanNetworks() {
        return Q.resolve()
            .then(() => {
                this.printInfo('Cleaning up any leftover networks');
                console.log('Reqeust all networks on daemon');
                return Q.ninvoke(this.dockerode, 'listNetworks')
                    .then((networks = []) => {
                        console.log(`Total networks on daemon: ${networks.length}`);
                        return _.filter(networks, (network) => {
                            return network.Name.startsWith(this.environmentId);
                        });
                    })
                    .then((relevantNetworks = []) => {
                        console.log(`Total networks on daemon that match to environment: ${relevantNetworks.length}`);
                        return relevantNetworks.map((network) => {
                            var networkObject = this.dockerode.getNetwork(network.Id);
                            console.log(`Removing network id: ${network.Id}`);
                            return Q.ninvoke(networkObject, 'remove');
                        });
                    })
                    .all();
            })
            .catch((err) => {
                const error = new CFError({
                    cause: err,
                    message: `Error occurred trying to cleanup leftover networks of environment ${this.environmentId}`
                });
                this.printError(error);
                return Q.resolve();
            });
    }

    _cleanVolumes() {
        return Q.resolve()
            .then(() => {
                this.printInfo('Cleaning up any leftover volumes');
                console.log('Reqeust all volumes on daemon');
                return Q.ninvoke(this.dockerode, 'listVolumes')
                    .then((volumes = {}) => {
                        console.log(`Total volumes on daemon: ${volumes.Volumes.length}`);
                        return _.filter(volumes.Volumes, (volume) => {
                            return volume.Name.startsWith(this.environmentId);
                        });
                    })
                    .then((relevantVolumes = []) => {
                        console.log(`Total volumes on daemon that match to environment: ${relevantVolumes.length}`);
                        return relevantVolumes.map((volume) => {
                            const volumeObject = this.dockerode.getVolume(volume.Name);
                            console.log(`Removing volume name: ${volume.Name}`);
                            return Q.ninvoke(volumeObject, 'remove');
                        });
                    })
                    .all();
            })
            .catch((err) => {
                const error = new CFError({
                    cause: err,
                    message: `Error occurred trying to cleanup leftover volumes of environment ${this.environmentId}`
                });
                this.printError(error);
                return Q.resolve();
            });
    }

    cleanLog() {
        if (this.taskLogger) {
            this.printInfo('Cleaning up environment logs');
            return this.taskLogger.delete();
        }
        return Q.resolve();
    }
}

module.exports = Environment;
