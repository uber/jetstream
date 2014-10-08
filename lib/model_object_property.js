var Class = require('uberclass-clouseau');
var lazy = require('lazyrequire')(require);
var LazyModelObject = require('./lazy_model_object');

var ModelObject = null;
var resolve = function() {
    ModelObject = lazy('./model_object')();
};

var ModelObjectProperty = Class.extend({
    isValidSingleType: function(type) {
        resolve();
        return type === Number || 
            type === String || 
            type === Boolean || 
            type === Date || 
            this.isModelObjectType(type);
    },

    isModelObjectType: function(type) {
        return ModelObject.isChildClass(type);
    },

    filterValueForPropertyOrThrow: function(newValue, property) {
        var propertyType = property.singleType;
        var modelObjectType = property.isModelObjectType;

        if (newValue !== null && newValue !== undefined) {
            if (propertyType === Number) {
                newValue = Number(newValue);
                if (isNaN(newValue)) {
                    throw new Error(
                        'Bad number value setting property \'' + property.name + '\'');
                }
            } else if (propertyType === String) {
                newValue = String(newValue);
            } else if (propertyType === Boolean) {
                newValue = Boolean(newValue);
            } else if (propertyType === Date) {
                var date = newValue instanceof Date ? newValue : new Date(newValue);
                if (isNaN(date.getTime())) {
                    throw new Error(
                        'Bad date value setting property \'' + property.name + '\'');
                } else {
                    newValue = date;
                }
            } else if (modelObjectType && newValue instanceof LazyModelObject) {
                // No-op, already transformed
            } else if (modelObjectType && newValue instanceof propertyType) {
                newValue = new LazyModelObject({
                    creator: this,
                    modelObject: newValue
                });
            } else if (modelObjectType && typeof newValue === 'string') {
                newValue = new LazyModelObject({
                    creator: this,
                    uuid: newValue
                });
            } else {
                throw new Error(
                    'Bad mismatch value setting property \'' + property.name + '\'');
            }
        }

        return newValue;
    }
}, {
    init: function(options) {
        resolve();
        options = options || {};

        if (typeof options.name !== 'string') {
            throw new Error('Invalid property name');
        }

        this._setType(options.type);

        this.name = options.name;
        this.key = '_' + options.name;
        this.isCollectionType = this.type instanceof Array;
        this.singleType = this.isCollectionType ? this.type[0] : this.type;
        this.isModelObjectType = ModelObjectProperty.isModelObjectType(this.singleType);
    },

    _setType: function(type) {
        if (type instanceof Array) {
            if (type.length !== 1 || !ModelObjectProperty.isValidSingleType(type[0])) {
                throw new Error('Collection type \'' + type[0] + '\' is not valid');
            }
        } else if (!ModelObjectProperty.isValidSingleType(type)) {
            throw new Error('Type \'' + type + '\' is not valid');
        }

        this.type = type;
    }
});

module.exports = ModelObjectProperty;
