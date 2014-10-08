module.exports = AbstractPersistMiddleware;

var EventEmitter = require('events').EventEmitter;
var util = require('util');

util.inherits(AbstractPersistMiddleware, EventEmitter);

function AbstractPersistMiddleware() {

}

AbstractPersistMiddleware.prototype.addModelObject = function(modelObject, callback) {
    throw new Error('Not implemented');
};

AbstractPersistMiddleware.prototype.removeModelObject = function(modelObject, callback) {
    throw new Error('Not implemented');
};

AbstractPersistMiddleware.prototype.updateModelObject = function(modelObject, callback) {
    throw new Error('Not implemented');
};

AbstractPersistMiddleware.prototype.containsModelObjectWithUUID = function(uuid, callback) {
    throw new Error('Not implemented');
};

AbstractPersistMiddleware.prototype.getModelObjectByUUID = function(uuid, callback) {
    throw new Error('Not implemented');
};

AbstractPersistMiddleware.prototype.getModelObjectsByUUIDs = function(uuids, callback) {
    throw new Error('Not implemented');
};
