var Class = require('uberclass-clouseau');
var lazy = require('lazyrequire')(require);

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
    }
}, {
    init: function(options) {
        resolve();
        options = options || {};

        if (typeof options.name !== 'string') {
            throw new Error('Invalid property name');
        }

        this._setType(options.type);

        this.options = options;
        this.name = options.name;
        this.isCollectionType = this.type instanceof Array;
        this.singleType = this.isCollectionType ? this.type[0] : this.type;
        this.isModelObjectType = ModelObjectProperty.isModelObjectType(this.singleType);
        delete this.options.name;
        delete this.options.type;
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
