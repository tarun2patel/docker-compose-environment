'use strict';

const Environment = require('./index');
const proxyquire  = require('proxyquire');
const chai        = require('chai');
const expect      = chai.expect;
const sinon       = require('sinon'); // jshint ignore:line
const sinonChai   = require('sinon-chai');
chai.use(sinonChai);


describe('Runtime Tests - Environments', () => {

    it('1. Simple Environment - check constructor', () => {
        const info = {
            id: 'env1',
            instances: [
                { type: 'moch', id: 'inst1', status: 'start' },
            ],
        };

        const env = new Environment(info);
        expect(env).to.exists; // jshint ignore:line
    });

    it('2. Simple Environment - get status should be start', () => {
        const info = {
            id: 'env1',
            instances: [
                { type: 'moch', id: 'inst1', status: 'start' },
            ],
        };

        const env = new Environment(info);
        expect(env).to.exists; // jshint ignore:line

        return env.getStatus()
            .then((status) => {
                expect(status).to.equal('start');
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
                expect(env).to.exists; // jshint ignore:line
                env.getStatus()
                    .then((status) => {
                        expect(status).to.equal('start');
                        done();
                    })
                    .catch((err) => {
                        expect(err).to.not.exists; // jshint ignore:line
                        done();
                    });
            });

            it(`${id}.2. ${action} instance`, (done) => {
                expect(env).to.exists; // jshint ignore:line
                env[action]()
                    .then((status) => {
                        expect(status).to.equal(result);
                        done();
                    })
                    .catch((err) => {
                        expect(err).to.not.exists; // jshint ignore:line
                        done();
                    });
            });

            it(`${id}.3. ${action} instance again`, (done) => {
                expect(env).to.exists; // jshint ignore:line
                env[action]()
                    .then((status) => {
                        expect(status).to.not.equal(result);
                        done();
                    })
                    .catch((err) => {
                        expect(err).to.exists; // jshint ignore:line
                        done();
                    });
            });

            it(`${id}.4. check status ${action}`, (done) => {
                expect(env).to.exists; // jshint ignore:line
                env.getStatus()
                    .then((status) => {
                        expect(status).to.equal(action);
                        done();
                    })
                    .catch((err) => {
                        expect(err).to.not.exists; // jshint ignore:line
                        done();
                    });
            });
        });
    };
    testAction(4, 'pause', 'paused');
    testAction(5, 'unpause', 'unpaused');

    it('7. Get status of a broken environment with no instances', () => {
        const info = {
            id: 'env-broken',
            instances: [],
        };

        const env = new Environment(info);

        return env.getStatus()
            .then((status) => {
                expect(status).to.equal('fatal');
            });
    });

    // TODO - test complex environments

    describe('Environment Network Terminator', function () {
        it('With no networks belonging to the environment', function () {

            const dockerNode = {
                certs: {
                    "ca": 'ca',
                    "cert": 'cert',
                    "key": 'key'
                },
                "ip": 'ip',
                "port": 'port',
                "protocol": "https",
                "timeout": 0
            };
            const info = {
                id: 'env1',
                instances: [
                    { type: 'moch', id: 'inst1', status: 'start' },
                ],
                dockerNode
            };

            var EnvironmentProxy = proxyquire('./index', {
                'dockerode': function (nodeInfo) {
                    expect(nodeInfo).to.deep.equal({
                        "ca": "ca",
                        "cert": "cert",
                        "host": "ip",
                        "key": "key",
                        "port": "port",
                        "protocol": "https",
                        "timeout": 0
                    });

                    return {
                        listNetworks: function (callback) {
                            callback(null, []);
                        },
                    };
                },
            });

            const env = new EnvironmentProxy(info);
            return env._cleanNetworks();
        });

        it('With a network belonging to the environment', function () {
            const dockerNode = {
                certs: {
                    "ca": 'ca',
                    "cert": 'cert',
                    "key": 'key'
                },
                "ip": 'ip',
                "port": 'port',
                "protocol": "https",
                "timeout": 0
            };
            const info = {
                id: 'env1',
                instances: [
                    { type: 'moch', id: 'inst1', status: 'start' },
                ],
                dockerNode
            };

            const containerRemoveSpy = sinon.spy(function (callback) {
                callback();
            });


            var EnvironmentProxy = proxyquire('./index', {
                'dockerode': function (nodeInfo) {
                    expect(nodeInfo).to.deep.equal({
                        "ca": "ca",
                        "cert": "cert",
                        "host": "ip",
                        "key": "key",
                        "port": "port",
                        "protocol": "https",
                        "timeout": 0
                    });

                    return {
                        listNetworks: function (callback) {
                            callback(null, [{ Id: 'id1', Name: 'env1_network1' }]);
                        },
                        'getNetwork': function (networkId) {
                            expect(networkId).to.equal('id1');

                            return {
                                remove: containerRemoveSpy,
                            };
                        },
                    };
                },
            });

            const env = new EnvironmentProxy(info);
            return env._cleanNetworks()
                .then(() => {
                    expect(containerRemoveSpy).to.have.been.calledOnce; // jshint ignore:line
                });
        });
    });

    describe('Environment Volume Terminator', () => {
        it('With no volumes belonging to the environment', () => {

            const dockerNode = {
                certs: {
                    "ca": 'ca',
                    "cert": 'cert',
                    "key": 'key'
                },
                "ip": 'ip',
                "port": 'port',
                "protocol": "https",
                "timeout": 0
            };
            const info = {
                id: 'env1',
                instances: [
                    { type: 'moch', id: 'inst1', status: 'start' },
                ],
                dockerNode
            };

            var EnvironmentProxy = proxyquire('./index', {
                'dockerode': function (nodeInfo) {
                    expect(nodeInfo).to.deep.equal({
                        "ca": "ca",
                        "cert": "cert",
                        "host": "ip",
                        "key": "key",
                        "port": "port",
                        "protocol": "https",
                        "timeout": 0
                    });

                    return {
                        listVolumes(callback) {
                            callback(null, []);
                        },
                    };
                },
            });

            const env = new EnvironmentProxy(info);
            return env._cleanVolumes();
        });

        it('With a volume belonging to the environment', () => {
            const dockerNode = {
                certs: {
                    "ca": 'ca',
                    "cert": 'cert',
                    "key": 'key'
                },
                "ip": 'ip',
                "port": 'port',
                "protocol": "https",
                "timeout": 0
            };
            const info = {
                id: 'env1',
                instances: [
                    { type: 'moch', id: 'inst1', status: 'start' },
                ],
                dockerNode
            };

            const volumeRemoveSpy = sinon.spy(function (callback) {
                callback();
            });


            var EnvironmentProxy = proxyquire('./index', {
                'dockerode': function (nodeInfo) {
                    expect(nodeInfo).to.deep.equal({
                        "ca": "ca",
                        "cert": "cert",
                        "host": "ip",
                        "key": "key",
                        "port": "port",
                        "protocol": "https",
                        "timeout": 0
                    });

                    return {
                        listVolumes(callback) {
                            callback(null, { Volumes: [{ Name: 'env1_volume1' }] });
                        },
                        'getVolume': function (volumeId) {
                            expect(volumeId).to.equal('env1_volume1');

                            return {
                                remove: volumeRemoveSpy,
                            };
                        },
                    };
                },
            });

            const env = new EnvironmentProxy(info);
            return env._cleanVolumes()
                .then(() => {
                    expect(volumeRemoveSpy).to.have.been.calledOnce; // jshint ignore:line
                });
        });
    });
});