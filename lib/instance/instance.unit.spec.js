'use strict';

const Instance = require('./moch');
const chai        = require('chai');
const expect      = chai.expect;
const sinon       = require('sinon'); // jshint ignore:line
const sinonChai   = require('sinon-chai');
chai.use(sinonChai);

describe('Runtime Tests - Instances', function() {

    it('1. Create instance', function() {
        const instance = new Instance({
            type: 'moch',
            id: 'test1',
            status: 'start'
        });
        expect(instance).to.exists; // jshint ignore:line
    });

    describe('2. Statuses', function() {
        const instance = new Instance({
            type: 'moch',
            id: 'test1',
            status: 'start'
        });

        it('2.1. Get default status', function() {
            expect(instance).to.exists; // jshint ignore:line

            return instance.getStatus()
                .then(function(status) {
                    expect(status).to.equal('start');
                });
        });

        it('2.2. check that we are not in stop status', function() {
            expect(instance).to.exists; // jshint ignore:line

            return instance.getStatus()
                .then(function(status) {
                    expect(status).to.not.equal('stop');
                });
        });
    });

    var testAction = function(id, action, result) {
        describe(id +'. ' + action, function() {
            var instance = new Instance({
                type: 'moch',
                id: 'test1',
                status: 'start'
            });

            it(id +'.1. Get default status', function(done) {
                expect(instance).to.exists; // jshint ignore:line

                instance.getStatus()
                    .then(function(status) {
                        expect(status).to.equal('start');
                        done();
                    })
                    .catch(function(err) {
                        expect(err).to.not.exists; // jshint ignore:line
                        done();
                    });
            });

            it(id +'.2. ' + action + ' instance', function(done) {
                expect(instance).to.exists; // jshint ignore:line

                instance[action]()
                    .then(function(status) {
                        expect(status).to.equal(result);
                        done();
                    })
                    .catch(function(err) {
                        expect(err).to.not.exists; // jshint ignore:line
                        done();
                    });
            });

            it(id +'.3. ' + action + ' instance again', function(done) {
                expect(instance).to.exists; // jshint ignore:line

                instance[action]()
                    .then(function(status) {
                        expect(status).to.not.equal(result);
                        done();
                    })
                    .catch(function(err) {
                        expect(err).to.exists; // jshint ignore:line
                        done();
                    });
            });

            it(id +'.4. check status ' + action, function(done) {
                expect(instance).to.exists; // jshint ignore:line

                instance.getStatus()
                    .then(function(status) {
                        expect(status).to.equal(action);
                        done();
                    })
                    .catch(function(err) {
                        expect(err).to.not.exists; // jshint ignore:line
                        done();
                    });
            });
        });
    };
    testAction(3, 'stop', 'stopped');
    testAction(4, 'pause', 'paused');
    testAction(5, 'unpause', 'unpaused');
    testAction(6, 'terminate', 'terminated');
});