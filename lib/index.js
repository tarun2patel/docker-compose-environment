'use strict';

const Q        = require('q');
const _        = require('lodash');
const util     = require('util');
const logger   = require('cf-logs').newLoggerFromFilename(__filename);
const Docker   = require('dockerode');
const Instance = require('./instance/docker');


class Environment {

    constructor(environment, infoLogger, firebaseLogRef) {
        this.info          = environment;
        const instances    = [];
        this.instances     = instances;
        this.environmentId = environment.id;
        this._id           = environment._id;

        this.dockerNode = environment.dockerNode;

        const dockerOptions = {
            host: this.dockerNode.ip,
            port: this.dockerNode.port,
            protocol: this.dockerNode.protocol || 'https',
            timeout: this.dockerNode.timeout || 0,
            ca: this.dockerNode.certs.ca,
            cert: this.dockerNode.certs.cert,
            key: this.dockerNode.certs.key,
        };

        if (this.dockerNode.notCheckServerCa) {
            // See https://nodejs.org/api/tls.html -
            //    checkServerIdentity should be a function which returns undefined if ca check pass
            dockerOptions.checkServerIdentity = () => {};
        }
        this.dockerode = new Docker(dockerOptions);

        _.get(environment, 'instances', []).map((instanceDef) => {
            const instance = new Instance(instanceDef, this.dockerode);
            instances.push(instance);
        });

        this.infoLogger     = infoLogger || logger;
        this.firebaseLogRef = firebaseLogRef;
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
        this.infoLogger.info('Cleaning up any leftover containers');
        return this._cleanContainers()
            .then(() => {
                this.infoLogger.info('Cleaning up any leftover networks');
                return this._cleanNetworks();
            })
            .then(() => {
                this.infoLogger.info('Cleaning up any leftover volumes');
                return this._cleanVolumes();
            })
            .then(() => {
                this.infoLogger.info('Cleaning up environment logs');
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
                            logger.error(`Error occurred trying to cleanup leftover container ${container.Id} of environment ${this.environmentId}`,
                                err);
                            return Q.reject(err);
                        });
                });
                return Q.all(promises);
            })
            .catch((err) => {
                logger.error(`Error occurred trying to cleanup leftover containers of environment ${this.environmentId}`,
                    err);
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
                logger.error(`Error occurred trying to cleanup leftover networks of environment ${this.environmentId}`,
                    err);
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
                logger.error(`Error occurred trying to cleanup leftover volumes of environment ${this.environmentId}`,
                    err);
                return Q.resolve();
            });
    }

    cleanFirebaseLog() {
        this.firebaseLogRef.remove();
    }
}

module.exports = Environment;