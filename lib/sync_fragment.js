module.exports = SyncFragment;

var _ = require('lodash');

var CONST = {};
CONST.TYPE_ROOT = 'root';
CONST.TYPE_ADD = 'add';
CONST.TYPE_CHANGE = 'change';
CONST.TYPE_REMOVE = 'remove';
CONST.TYPE_MOVECHANGE = 'movechange';
CONST.TYPES = Object.freeze([
    CONST.TYPE_ROOT,
    CONST.TYPE_ADD,
    CONST.TYPE_CHANGE,
    CONST.TYPE_REMOVE,
    CONST.TYPE_MOVECHANGE
]);
CONST.ALLOWED_VALUE_TYPES = Object.freeze([
    'string',
    'number',
    'boolean'
]);
CONST = Object.freeze(CONST);

function SyncFragment(options) {
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
    if (options.modelObject) {
        this.objectUUID = options.modelObject.uuid;
    } else {
        this.objectUUID = options.uuid;
    }
    if (options.modelObject) {
        this.clsName = options.modelObject.typeName;
    } else {
        this.clsName = options.clsName;
    }
    if (options.properties) {
        this._setProperties(options.properties);
    } else {
        this.properties = null;
    }
    
    if (this.objectUUID) {
        this.objectUUID = this.objectUUID.toLowerCase();
    }
}

SyncFragment.CONST = CONST;

SyncFragment.prototype._getValidTypeOrThrow = function(key, value) {
    var valueTypeIndex = CONST.ALLOWED_VALUE_TYPES.indexOf(typeof value);
    var allowedValueType = valueTypeIndex !== -1;
    var isArray = value instanceof Array;
    var isDate = value instanceof Date;
    if (!allowedValueType && !isArray && !isDate && value !== null) {
        var allowed = CONST.ALLOWED_VALUE_TYPES.join(', ') + ', array, date, null';
        throw new Error('Property \'' + key + '\' not a ' + allowed);
    }
    if (isArray) {
        return 'array';
    } else if (isDate) {
        return 'date';
    } else if (value === null) {
        return 'null';
    } else {
        return CONST.ALLOWED_VALUE_TYPES[valueTypeIndex];
    }
};

SyncFragment.prototype._setProperties = function(properties) {
    if (typeof properties !== 'object') {
        throw new Error('Requires properties');
    }

    var props = {};
    _.each(properties, function(value, key) {
        if (typeof key !== 'string') {
            throw new Error('Property key not a string');
        }
        var valueType = this._getValidTypeOrThrow(key, value);
        if (valueType === 'array') {
            var firstElementValueType = null;
            _.each(value, function(element) {
                var elementValueType = this._getValidTypeOrThrow(key, element);
                if (elementValueType === 'array') {
                    throw new Error(
                        'Property \'' + key + '\' cannot have arrays in an array');
                }
                if (!firstElementValueType) {
                    firstElementValueType = elementValueType;
                } else if (firstElementValueType !== elementValueType) {
                    throw new Error(
                        'Property \'' + key + '\' not all array value types match');
                }
            }.bind(this));
            props[key] = value;
        } else if (valueType === 'date') {
            // Always send dates as timestamps for faster parsing
            props[key] = value.getTime();
        } else {
            props[key] = value;
        }
    }.bind(this));

    this.properties = props;
};

SyncFragment.prototype.toJSON = function() {
    var json = {
        type: this.type,
        uuid: this.objectUUID
    };
    if (this.clsName) {
        json.cls = this.clsName;
    }
    if (this.parentUUID) {
        json.parent = this.parentUUID;
    }
    if (this.properties) {
        json.properties = this.properties;
    }
    return json;
};
