var Class = require('uberclass-clouseau');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

util.inherits(Class, EventEmitter);

var AbstractPersistMiddleware = Class.extend({
    addModelObject: function(modelObject, callback) {
        throw new Error('Not implemented');
    },

    removeModelObject: function(modelObject, callback) {
        throw new Error('Not implemented');
    },

    updateModelObject: function(modelObject, callback) {
        throw new Error('Not implemented');
    },

    containsModelObjectWithUUID: function(uuid, callback) {
        throw new Error('Not implemented');
    },

    getModelObjectByUUID: function(uuid, callback) {
        throw new Error('Not implemented');
    },

    getModelObjectsByUUIDs: function(uuids, callback) {
        throw new Error('Not implemented');
    }
});

module.exports = AbstractPersistMiddleware;
