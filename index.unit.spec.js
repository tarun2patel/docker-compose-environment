'use strict';

const should      = require('should');
const Environment = require('./environment');
const proxyquire  = require('proxyquire');
const chai        = require('chai');
const expect      = chai.expect;
const Q           = require('q');
const sinon       = require('sinon'); // jshint ignore:line
const sinonChai   = require('sinon-chai');
chai.use(sinonChai);



describe('Runtime Tests - Environments', () => {

    it('1. Simple Environment - check constructor', (done) => {
        const info = {
            id: 'env1',
            instances: [
                { type: 'moch', id: 'inst1', status: 'start' },
            ],
        };

        const env = new Environment(info);
        should.exists(env);
        done();
    });

    it('2. Simple Environment - get status should be start', (done) => {
        const info = {
            id: 'env1',
            instances: [
                { type: 'moch', id: 'inst1', status: 'start' },
            ],
        };

        const env = new Environment(info);
        should.exists(env);

        env.getStatus()
            .then((status) => {
                status.should.equal('start');
                done();
            })
            .catch((err) => {
                should.not.exists(err);
                done();
            });
    });

    const testAction = function (id, action, result) {
        describe(`${id}. ${action}`, () => {
            const info = {
                id: 'env1',
                instances: [
                    { type: 'moch', id: 'inst1', status: 'start' },
                ],
            };

            const env = new Environment(info);

            it(`${id}.1. Get default status`, (done) => {
                should.exists(env);
                env.getStatus()
                    .then((status) => {
                        status.should.equal('start');
                        done();
                    })
                    .catch((err) => {
                        should.not.exists(err);
                        done();
                    });
            });

            it(`${id}.2. ${action} instance`, (done) => {
                should.exists(env);
                env[action]()
                    .then((status) => {
                        status.should.equal(result);
                        done();
                    })
                    .catch((err) => {
                        should.not.exists(err);
                        done();
                    });
            });

            it(`${id}.3. ${action} instance again`, (done) => {
                should.exists(env);
                env[action]()
                    .then((status) => {
                        status.should.not.equal(result);
                        done();
                    })
                    .catch((err) => {
                        should.exists(err);
                        done();
                    });
            });

            it(`${id}.4. check status ${action}`, (done) => {
                should.exists(env);
                env.getStatus()
                    .then((status) => {
                        status.should.equal(action);
                        done();
                    })
                    .catch((err) => {
                        should.not.exists(err);
                        done();
                    });
            });
        });
    };
    testAction(3, 'stop', 'stopped');
    testAction(4, 'pause', 'paused');
    testAction(5, 'unpause', 'unpaused');

    it('Terminate an environment', (done) => {
        const info = {
            id: 'env1',
            instances: [
                { type: 'moch', id: 'inst1', status: 'start' },
            ],
            dockerNode: {
                id: 'dockerNodeId',
            },
        };

        const EnvProxy = proxyquire('./environment', {
            '../../../server/tasks/helpers/runner/pipe/cleanEnvironment': {
                manualClean: function (dockerNode, environmentId) {
                    expect(dockerNode).to.deep.equal({
                        'id': 'dockerNodeId',
                    });
                    expect(environmentId).to.equal('env1');
                    return Q.resolve();
                },
            },
        });
        new EnvProxy(info).terminate()
            .then((status) => {
                status.should.equal('terminated');
                done();
            })
            .catch((err) => {
                done(err);
            });
    });

    it('7. Get status of a broken environment with no instances', (done) => {
        const info = {
            id: 'env-broken',
            instances: [],
        };

        const env = new Environment(info);

        env.getStatus()
            .then((status) => {
                status.should.equal('fatal');
                done();
            })
            .catch((err) => {
                should.not.exists(err);
                done(err);
            });
    });

    // TODO - test complex environments

    describe('Environment Network Terminator', function () {
        it('With no networks belonging to the environment', function () {

            var dockerNode = {};

            var terminatorProxy = proxyquire('./environmentNetworkTerminator.js', {
                '../../../docker': function (nodeInfo) {
                    chai.expect(nodeInfo).to.equal(dockerNode);

                    return {
                        listNetworks: function (callback) {
                            callback(null, []);
                        },
                    };
                },
            });

            return terminatorProxy.terminate({ dockerNode: dockerNode });
        });

        it('With a network belonging to the environment', function () {
            var containerRemoveSpy = sinon.spy(function (callback) {
                callback();
            });

            var dockerNode = {};

            var terminatorProxy = proxyquire('./environmentNetworkTerminator.js', {
                '../../../docker': function (nodeInfo) {
                    chai.expect(nodeInfo).to.equal(dockerNode);

                    return {
                        listNetworks: function (callback) {
                            callback(null, [{ Id: 'id1', Name: 'comp_network1' }]);
                        },
                        'getNetwork': function (networkId) {
                            chai.expect(networkId).to.equal('id1');

                            return {
                                remove: containerRemoveSpy,
                            };
                        },
                    };
                },
            });

            return terminatorProxy.terminate({ id: 'comp', dockerNode: dockerNode })
                .then(function () {
                    chai.expect(containerRemoveSpy).to.have.callCount(1);
                });
        });
    });

    describe('Environment Volume Terminator', () => {
        it('With no volumes belonging to the environment', () => {

            const dockerNode = {};

            const terminatorProxy = proxyquire('./environmentVolumeTerminator.js', {
                '../../../docker': function (nodeInfo) {
                    chai.expect(nodeInfo).to.equal(dockerNode);

                    return {
                        listVolumes(callback) {
                            callback(null, []);
                        },
                    };
                },
            });

            return terminatorProxy.terminate({ dockerNode });
        });

        it('With a volume belonging to the environment', () => {
            const volumeRemoveSpy = sinon.spy((callback) => {
                callback();
            });

            const dockerNode = {};

            const terminatorProxy = proxyquire('./environmentVolumeTerminator.js', {
                '../../../docker': function (nodeInfo) {
                    chai.expect(nodeInfo).to.equal(dockerNode);

                    return {
                        listVolumes(callback) {
                            callback(null, { Volumes: [{ Name: 'comp_volume1' }] });
                        },
                        'getVolume': function (volumeId) {
                            chai.expect(volumeId).to.equal('comp_volume1');

                            return {
                                remove: volumeRemoveSpy,
                            };
                        },
                    };
                },
            });

            return terminatorProxy.terminate({ id: 'comp', dockerNode })
                .then(() => {
                    chai.expect(volumeRemoveSpy).to.have.callCount(1);
                });
        });
    });
});