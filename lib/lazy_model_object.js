var Class = require('uberclass-clouseau');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

util.inherits(Class, EventEmitter);

var LazyModelObject = Class.extend({
    init: function(options) {
        options = options || {};

        if (typeof options.uuid !== 'string' && !options.modelObject) {
            throw new Error('Requires uuid or modelObject');
        }

        if (!options.creator) {
            throw new Error('Requires creator');
        }

        this.uuid = options.modelObject ? options.modelObject.uuid : options.uuid;
        this.creator = options.creator;
        this.modelObject = options.modelObject ? options.modelObject : null;
    },

    getModelObject: function(callback) {
        if (this.modelObject) {
            callback(null, this.modelObject);
        } else if (this.creator.scope) {
            this.creator.scope.getModelObjectByUUID(this.uuid, callback);
        } else {
            callback(new Error('No scope to get ModelObject from'));
        }
    }
});

module.exports = LazyModelObject;
