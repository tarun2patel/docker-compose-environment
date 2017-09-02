'use strict';

const Q = require('q');

class Instance {

    constructor(instance, dockerode) {
        this.dockerode = dockerode;
        this.info      = instance;

        var id         = instance.container;
        this.container = this.dockerode.getContainer(id);
    }

    getStatus() {
        var deferred = Q.defer();

        console.log('getting status of instance for ' + this.info.container);
        this.container.inspect(function (err, info) {
            if (err) {
                return deferred.resolve('error', err);
            }
            var state = info.State;
            if (state.Paused) {
                return deferred.resolve('pause');
            }
            if (state.Running) {
                return deferred.resolve('start');
            }
            if (state.Status === 'exited') {
                return deferred.resolve('exited');
            }

            return deferred.resolve('stop');
        });

        return deferred.promise;
    }

    pause() {
        var container = this.container;

        var deferred = Q.defer();
        container.inspect(function (err, info) {
            if (err) {
                return deferred.reject(err);
            }
            var state = info.State;
            if (state.Status === 'exited') {
                return deferred.resolve('paused');
            }

            container.pause(function (err) {
                if (err) {
                    return deferred.reject(err);
                }
                deferred.resolve('paused');
            });
        });
        return deferred.promise;
    }

    unpause() {
        var container = this.container;

        var deferred = Q.defer();
        container.inspect(function (err, info) {
            if (err) {
                return deferred.reject(err);
            }
            var state = info.State;
            if (state.Status === 'exited') {
                return deferred.resolve('unpaused');
            }

            container.unpause(function (err) {
                if (err) {
                    return deferred.reject(err);
                }
                deferred.resolve('unpaused');
            });
        });
        return deferred.promise;
    }
}

module.exports = Instance;
