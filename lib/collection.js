var _ = require('underscore');
var async = require('async');
var debug = require('debug')('jetstream:core:collection');
var ModelObjectProperty = require('./model_object_property');

function Collection(options) {
    options = options || {};

    if (!(options.property instanceof ModelObjectProperty)) {
        throw new Error('Invalid property');
    }

    if (!options.property.isCollectionType) {
        throw new Error('Property is not a collection type');
    }

    this.array = [];
    this.property = options.property;
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
    return this.array.push(element);
};

Collection.prototype.shift = function() {
    return this.array.shift();
};

Collection.prototype.unshift = function() {
    element = ModelObjectProperty.filterValueForPropertyOrThrow(element, this.property);
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

module.exports = Collection;
