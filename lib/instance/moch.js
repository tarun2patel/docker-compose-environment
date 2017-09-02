
var Q = require('q');

var Instance = function(instance) {
    if (!(this instanceof Instance)) return new Instance(instance);

    this.info = instance;
};

Instance.prototype.getStatus = function() {
    var deferred = Q.defer();
    deferred.resolve(this.info.status);
    return deferred.promise;
};

Instance.prototype._process = function(status, resolve) {
    var deferred = Q.defer();

    if (this.info.status === status) {
        deferred.reject(new Error('instance already ' + resolve));
    } else {
        this.info.status = status;
        deferred.resolve(resolve);
    }
    return deferred.promise;
};
Instance.prototype.start = function() {
    return this._process('start', 'started');
};
Instance.prototype.stop = function() {
    return this._process('stop', 'stopped');
};
Instance.prototype.pause = function() {
    return this._process('pause', 'paused');
};
Instance.prototype.unpause = function() {
    return this._process('unpause', 'unpaused');
};
Instance.prototype.terminate = function() {
    return this._process('terminate', 'terminated');
};
module.exports = Instance;