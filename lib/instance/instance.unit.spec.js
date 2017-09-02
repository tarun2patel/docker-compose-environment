var should      = require('should'),
    Instance = require('./moch');

describe('Runtime Tests - Instances', function() {

    it('1. Create instance', function(done) {
        var instance = new Instance({
            type: 'moch',
            id: 'test1',
            status: 'start'
        });
        should.exists(instance);
        done();
    });

    describe('2. Statuses', function() {
        var instance = new Instance({
            type: 'moch',
            id: 'test1',
            status: 'start'
        });

        it('2.1. Get default status', function(done) {
            should.exists(instance);
            instance.getStatus()
                .then(function(status) {
                    status.should.equal('start');
                    done();
                })
                .catch(function(err) {
                    should.not.exists(err);
                    done();
                });
        });

        it('2.2. check that we are not in stop status', function(done) {
            should.exists(instance);
            instance.getStatus()
                .then(function(status) {
                    status.should.not.equal('stop');
                    done();
                })
                .catch(function(err) {
                    should.not.exists(err);
                    done();
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
                should.exists(instance);
                instance.getStatus()
                    .then(function(status) {
                        status.should.equal('start');
                        done();
                    })
                    .catch(function(err) {
                        should.not.exists(err);
                        done();
                    });
            });

            it(id +'.2. ' + action + ' instance', function(done) {
                should.exists(instance);
                instance[action]()
                    .then(function(status) {
                        status.should.equal(result);
                        done();
                    })
                    .catch(function(err) {
                        should.not.exists(err);
                        done();
                    });
            });

            it(id +'.3. ' + action + ' instance again', function(done) {
                should.exists(instance);
                instance[action]()
                    .then(function(status) {
                        status.should.not.equal(result);
                        done();
                    })
                    .catch(function(err) {
                        should.exists(err);
                        done();
                    });
            });

            it(id +'.4. check status ' + action, function(done) {
                should.exists(instance);
                instance.getStatus()
                    .then(function(status) {
                        status.should.equal(action);
                        done();
                    })
                    .catch(function(err) {
                        should.not.exists(err);
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