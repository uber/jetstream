module.exports = Collection;

var _ = require('lodash');
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
    var oldArray = this.array;
    this.array = this._filterArrayOrThrow(array);
    if (this.property.isModelObjectType) {
        var removed = _.difference(oldArray, this.array);
        var added = _.difference(this.array, oldArray);

        removed.forEach(function(modelObject) {
            modelObject._removeParent(this.owningModelObject, this.property.name);
        }.bind(this));

        added.forEach(function(modelObject) {
            modelObject._addParent(this.owningModelObject, this.property.name);
        }.bind(this));
    }
    return this.array;
};

Collection.prototype.objectAtIndex = function(index) {
    return this.array[index];
};

Collection.prototype.pop = function() {
    var element = this.array.pop();
    if (this.property.isModelObjectType && element) {
        element._removeParent(this.owningModelObject, this.property.name);
    }
    return element;
};

Collection.prototype.push = function(element) {
    element = ModelObjectProperty.filterValueForPropertyOrThrow(element, this.property);
    if (this.property.isModelObjectType) {
        element._addParent(this.owningModelObject, this.property.name);
    }
    return this.array.push(element);
};

Collection.prototype.shift = function() {
    var element = this.array.shift();
    if (this.property.isModelObjectType && element) {
        element._removeParent(this.owningModelObject, this.property.name);
    }
    return element;
};

Collection.prototype.unshift = function(element) {
    element = ModelObjectProperty.filterValueForPropertyOrThrow(element, this.property);
    if (this.property.isModelObjectType) {
        element._addParent(this.owningModelObject, this.property.name);
    }
    return this.array.unshift(element);
};

Collection.prototype.slice = function() {
    return this.array.slice.apply(this.array, arguments);
};

Collection.prototype.forEach = function() {
    return this.array.forEach.apply(this.array, arguments);
};

Collection.prototype.map = function() {
    return this.array.map.apply(this.array, arguments);
};

Collection.prototype.splice = function() {
    var args = Array.prototype.slice.call(arguments, 0);

    if (args.length > 2) {
        var added = this._filterArrayOrThrow(args.slice(2));
        if (this.property.isModelObjectType) {
            added.forEach(function(modelObject) {
                modelObject._addParent(this.owningModelObject, this.property.name);
            }.bind(this));
        }
        args = [args[0], args[1]].concat(added);
    }

    var removed = this.array.splice.apply(this.array, args);
    if (this.property.isModelObjectType && removed.length > 0) {
        removed.forEach(function(modelObject) {
            modelObject._removeParent(this.owningModelObject, this.property.name);
        }.bind(this));
    }

    return removed;
};
