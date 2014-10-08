module.exports = Collection;

var _ = require('underscore');
var ModelObject = require('./model_object');
var ModelObjectProperty = require('./model_object_property');

function Collection(options) {
    options = options || {};

    if (!(options.property instanceof ModelObjectProperty)) {
        throw new Error('Invalid property');
    }

    if (!options.property.isCollectionType) {
        throw new Error('Property is not a collection type');
    }

    if (!(options.owningModelObject instanceof ModelObject)) {
        throw new Error('Invalid owningModelObject');
    }

    this.array = [];
    this.property = options.property;
    this.owningModelObject = options.owningModelObject;
}

Object.defineProperty(Collection.prototype, 'length', {
    configurable: false,
    enumerable: true,
    get: function() {
        return this.array.length;
    }
});

Collection.prototype._filterArrayOrThrow = function(array) {
    return _.map(array, function(element) {
        return ModelObjectProperty.filterValueForPropertyOrThrow(element, this.property);
    }.bind(this));
};

Collection.prototype.setAsArray = function(array) {
    this.array = this._filterArrayOrThrow(array);
    if (this.property.isModelObjectType) {
        this.array.forEach(function(modelObject) {
            modelObject._setParent(this.owningModelObject, this.property.name);
        }.bind(this));
    }
    return this.array;
};

Collection.prototype.addFromArray = function(array) {
    var combined = this.array.concat(array);
    return this.setAsArray(combined);
};

Collection.prototype.objectAtIndex = function(index) {
    return this.array[index];
};

Collection.prototype.pop = function() {
    return this.array.pop();
};

Collection.prototype.push = function(element) {
    element = ModelObjectProperty.filterValueForPropertyOrThrow(element, this.property);
    if (this.property.isModelObjectType) {
        element._setParent(this.owningModelObject, this.property.name);
    }
    return this.array.push(element);
};

Collection.prototype.shift = function() {
    return this.array.shift();
};

Collection.prototype.unshift = function(element) {
    element = ModelObjectProperty.filterValueForPropertyOrThrow(element, this.property);
    if (this.property.isModelObjectType) {
        element._setParent(this.owningModelObject, this.property.name);
    }
    return this.array.unshift(element);
};

Collection.prototype.slice = function() {
    return this.array.slice.apply(this.array, arguments);
};

Collection.prototype.forEach = function() {
    return this.array.forEach.apply(this.array, arguments);
};

Collection.prototype.splice = function() {
    if (arguments.length <= 2) {
        return this.array.splice.apply(this.array, arguments);
    }
    var elements = Array.prototype.slice.call(arguments, 2);
    return this.addFromArray(elements);
};
