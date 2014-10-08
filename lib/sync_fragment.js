var _ = require('underscore');
var Class = require('uberclass-clouseau');

var CONST = {};
CONST.TYPE_ADD = 'add';
CONST.TYPE_CHANGE = 'change';
CONST.TYPE_REMOVE = 'remove';
CONST.TYPE_MOVECHANGE = 'movechange';
CONST.TYPES = [
    CONST.TYPE_ADD,
    CONST.TYPE_CHANGE,
    CONST.TYPE_REMOVE,
    CONST.TYPE_MOVECHANGE
];
CONST.ALLOWED_VALUE_TYPES = [
    'string',
    'number',
    'boolean'
];

var SyncFragment = Class.extend({
    CONST: CONST
}, {
    init: function(options) {
        options = options || {};

        if (CONST.TYPES.indexOf(options.type) === -1) {
            throw new Error('Invalid type');
        }

        if (typeof options.uuid !== 'string' && !options.modelObject) {
            throw new Error('Requires uuid or modelObject');
        }

        if (typeof options.clsName !== 'string' && !options.modelObject) {
            if (typeof options.cls === 'string') {
                options.clsName = options.cls;
                delete options.cls;
            }
        }

        this.type = options.type;
        this.objectUUID = options.modelObject 
            ? options.modelObject.uuid 
            : options.uuid;
        this.clsName = options.modelObject 
            ? options.modelObject.typeName
            : options.clsName;
        if (typeof options.keyPath === 'string') {
            this.keyPath = options.keyPath;
        }
        if (typeof options.parentUUID === 'string') {
            this.parentUUID = options.parentUUID;
        } else if (typeof options.parent === 'string') {
            this.parentUUID = options.parent;
        } else if (options.parent) {
            this.parentUUID = options.parent.uuid;
        }
        if (options.properties) {
            this._setProperties(options.properties);
        }
        
        if (this.objectUUID) {
            this.objectUUID = this.objectUUID.toLowerCase();    
        }
        if (this.parentUUID) {
            this.parentUUID = this.parentUUID.toLowerCase();    
        }
    },

    _setProperties: function(properties) {
        if (typeof properties !== 'object') {
            throw new Error('Requires properties');
        }

        var props = {};
        var allowedTypes = CONST.ALLOWED_VALUE_TYPES;
        _.each(properties, function(value, key) {
            if (typeof key !== 'string') {
                throw new Error('Property key not a string');
            }
            var allowedValueType = allowedTypes.indexOf(typeof value) !== -1;
            var isDate = value instanceof Date;
            if (!allowedValueType && !isDate && value !== null) {
                var allowed = allowedTypes.join(', ') + ', date, null';
                throw new Error('Property \'' + key + '\' not a ' + allowed);
            }
            if (isDate) {
                // Always send dates as timestamps for faster parsing
                props[key] = value.getTime();
            } else {
                props[key] = value;
            }
        });

        this.properties = props;
    },

    toJSON: function() {
        var json = {
            type: this.type,
            uuid: this.objectUUID
        };
        if (this.clsName) {
            json.cls = this.clsName;
        }
        if (this.keyPath) {
            json.keyPath = this.keyPath;
        }
        if (this.parentUUID) {
            json.parent = this.parentUUID;
        }
        if (this.properties) {
            json.properties = this.properties;
        }
        return json;
    }
});

module.exports = SyncFragment;
