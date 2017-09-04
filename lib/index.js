'use strict';

const Q        = require('q');
const _        = require('lodash');
const util     = require('util');
const Docker   = require('dockerode');
const CFError  = require('cf-errors');

class Environment {

    constructor(environment, infoLogger, firebaseLogRef) {
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
            timeout: _.get(this.dockerNode, 'timeout', 0),
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
        this.firebaseLogRef = firebaseLogRef;
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
        this.printInfo('Cleaning up any leftover containers');
        return this._cleanContainers()
            .then(() => {
                this.printInfo('Cleaning up any leftover networks');
                return this._cleanNetworks();
            })
            .then(() => {
                this.printInfo('Cleaning up any leftover volumes');
                return this._cleanVolumes();
            })
            .then(() => {
                this.printInfo('Cleaning up environment logs');
                this.cleanFirebaseLog();
            })
            .then(() => {
                return 'terminated';
            });
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
        return Q.ninvoke(this.dockerode,
            'listContainers',
            { all: 'true', filters: `{"label": ["com.docker.compose.project=${this.environmentId}"]}` })
            .then((containers) => {
                const promises = containers.map((container) => {
                    const containerObject = this.dockerode.getContainer(container.Id);
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
    }

    _cleanNetworks() {
        return Q.resolve()
            .then(() => {
                return Q.ninvoke(this.dockerode, 'listNetworks')
                    .then((networks) => {
                        return _.filter(networks, (network) => {
                            return network.Name.startsWith(this.environmentId);
                        });
                    })
                    .then((relevantNetworks) => {
                        return relevantNetworks.map((network) => {
                            var networkObject = this.dockerode.getNetwork(network.Id);
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
                return Q.ninvoke(this.dockerode, 'listVolumes')
                    .then((volumes) => {
                        return _.filter(volumes.Volumes, (volume) => {
                            return volume.Name.startsWith(this.environmentId);
                        });
                    })
                    .then((relevantVolumes) => {
                        return relevantVolumes.map((volume) => {
                            const volumeObject = this.dockerode.getVolume(volume.Name);
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

    cleanFirebaseLog() {
        if (this.firebaseLogRef) {
            this.firebaseLogRef.remove();
        }
    }
}

module.exports = Environment;