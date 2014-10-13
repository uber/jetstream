module.exports = MemoryPersistMiddleware;

var _ = require('lodash');
var AbstractPersistMiddleware = require('./abstract_persist_middleware');
var async = require('async');
var callbackOrEmitError = require('callback-or-emit-error');
var maybeCallback = require('maybe-callback');
var util = require('util');

function MemoryPersistMiddleware() {
    this._modelObjects = [];
    this._modelObjectsByUUID = {};
}

util.inherits(MemoryPersistMiddleware, AbstractPersistMiddleware);

MemoryPersistMiddleware.prototype.addModelObject = function(modelObject, callback) {
    if (this._modelObjects.indexOf(modelObject) !== -1) {
        return callbackOrEmitError(this, callback, new Error('modelObject already exists'));
    }

    this._modelObjects.push(modelObject);
    this._modelObjectsByUUID[modelObject.uuid] = modelObject;

    maybeCallback(callback)();
};

MemoryPersistMiddleware.prototype.removeModelObject = function(modelObject, callback) {
    if (this._modelObjects.indexOf(modelObject) === -1) {
        return callbackOrEmitError(this, callback, new Error('modelObject does not exist'));
    }

    this._modelObjects = _.without(this._modelObjects, modelObject);
    delete this._modelObjectsByUUID[modelObject.uuid];

    maybeCallback(callback)();
};

MemoryPersistMiddleware.prototype.updateModelObject = function(modelObject, callback) {
    if (!this._modelObjectsByUUID[modelObject.uuid]) {
        return callbackOrEmitError(this, callback, new Error('modelObject does not exist'));
    }

    // No-op, we already have this model object in 
    // memory and any updates were already applied
    maybeCallback(callback)();
};

MemoryPersistMiddleware.prototype.containsModelObjectWithUUID = function(uuid, callback) {
    callback(null, Boolean(this._modelObjectsByUUID[uuid]));
};

MemoryPersistMiddleware.prototype.getModelObjectByUUID = function(uuid, callback) {
    callback(null, this._modelObjectsByUUID[uuid]);
};

MemoryPersistMiddleware.prototype.getModelObjectsByUUIDs = function(uuids, callback) {
    var err;
    var results = new Array(uuids.length);
    uuids.forEach(function(uuid) {
        if (err) {
            return;
        }
        var modelObject = this._modelObjectsByUUID[uuid];
        if (!modelObject) {
            err = new Error('\'' + uuid + '\' not found');
            return;
        }
        results.push(modelObject);
    }.bind(this));

    if (err) {
        return callback(err);
    }
    callback(null, results);
};
