var _ = require('underscore');
var AbstractPersistMiddleware = require('./abstract_persist_middleware');
var async = require('async');
var maybeCallback = require('maybe-callback');

var MemoryPersistMiddleware = AbstractPersistMiddleware.extend({
    init: function(options) {
        this.options = options || {};

        this._modelObjects = [];
        this._modelObjectsByUUID = {};
    },

    addModelObject: function(modelObject, callback) {
        if (this._modelObjects.indexOf(modelObject) !== -1) {
            return maybeCallback(callback)(new Error('modelObject already exists'));
        }

        this._modelObjects.push(modelObject);
        this._modelObjectsByUUID[modelObject.uuid] = modelObject;

        maybeCallback(callback)();
    },

    removeModelObject: function(modelObject, callback) {
        if (this._modelObjects.indexOf(modelObject) === -1) {
            return maybeCallback(callback)(new Error('modelObject does not exist'));
        }

        this._modelObjects = _.without(this._modelObjects, modelObject);
        delete this._modelObjectsByUUID[modelObject.uuid];

        maybeCallback(callback)();
    },

    updateModelObject: function(modelObject, callback) {
        if (!this._modelObjectsByUUID[modelObject.uuid]) {
            return maybeCallback(callback)(new Error('modelObject does not exist'));
        }

        // No-op, we already have this model object in 
        // memory and any updates were already applied
        maybeCallback(callback)();
    },

    containsModelObjectWithUUID: function(uuid, callback) {
        callback(null, Boolean(this._modelObjectsByUUID));
    },    

    getModelObjectByUUID: function(uuid, callback) {
        callback(null, this._modelObjectsByUUID[uuid]);
    },

    getModelObjectsByUUIDs: function(uuids, callback) {
        async.map(uuids, function(uuid, doneCallback) {
            this.getModelObjectByUUID(uuid, doneCallback);
        }.bind(this), callback);
    }
});

module.exports = MemoryPersistMiddleware;
