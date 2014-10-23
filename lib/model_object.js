module.exports = ModelObject;

var async = require('async');
var callbackOrEmitError = require('callback-or-emit-error');
var Collection = require('./collection');
var EventEmitter = require('events').EventEmitter;
var logger = require('./logger');
var maybeCallback = require('maybe-callback');
var ModelObjectProperty = require('./model_object_property');
var ParentRelationship = require('./parent_relationship');
var Scope = require('./scope');
var SyncFragment = require('./sync_fragment');
var util = require('util');
var uuid = require('node-uuid');

var debug = logger.debug.bind(logger, 'core:modelObject');

function ModelObject(options) {
    options = options || {};

    if (typeof options.uuid === 'string') {
        this.uuid = options.uuid;
    } else {
        this.uuid = uuid.v4();
    }

    this.scope = null;
    this.isScopeRoot = false;
    this._resolvedProperties = null;
    this._resolvedPropertiesLookup = null;
    this._parentRelationships = [];
    this._parentRelationshipsByParentUUID = {};

    this._setPropertyDefaultValues();
}

util.inherits(ModelObject, EventEmitter);

ModelObject.baseType = ModelObject;

ModelObject.isChildClass = function(cls) {
    if (!cls || !cls.baseType) {
        return false;
    }

    return cls.baseType === this.baseType;
};

ModelObject.model = function(name, definition, methods) {
    if (typeof name !== 'string') {
        throw new Error('Invalid model name');
    }

    if (typeof definition !== 'function') {
        throw new Error('Invalid model definition');
    }

    if (!this._hasInitModelObjectPrototype()) {
        this._initPrototype();
    }

    // Inherit from ModelObject
    var typeClass = function() {
        ModelObject.apply(this, arguments);
    };
    util.inherits(typeClass, ModelObject);
    Object.keys(ModelObject).forEach(function(key) {
        var value = ModelObject[key];
        if (typeof value === 'function') {
            typeClass[key] = value.bind(typeClass);
        } else {
            typeClass[key] = value;
        }
    });
    typeClass.baseType = ModelObject;

    // Set any instance methods
    if (typeof methods === 'object') {
        Object.keys(methods).forEach(function(key) {
            typeClass.prototype[key] = methods[key];
        });
    }

    // Set the type name properties
    typeClass.typeName = name;
    typeClass.prototype.typeName = name;

    // Set the supertype and boot up the specific prototype
    typeClass._setSupertype(this);
    typeClass._initPrototype();

    definition.call(typeClass);

    return typeClass;
};

ModelObject.has = function(propertyName, propertyType, options) {
    options = options || {};
    options.name = propertyName;
    options.type = propertyType;

    var property = new ModelObjectProperty(options);

    this._addProperty(property);
};

ModelObject._addSubtype = function(typeClass) {
    if (!this._subtypesByTypeName[this.typeName]) {
        this._subtypesByTypeName[this.typeName] = {};
    }
    if (!this._subtypesByTypeName[this.typeName][typeClass.typeName]) {
        this._subtypesByTypeName[this.typeName][typeClass.typeName] = typeClass;
    }
    var supertype = this._getSupertype();
    if (supertype) {
        supertype._addSubtype(typeClass);
    }
};

ModelObject._getSubtypeWithTypeName = function(typeName) {
    return ModelObject._subtypesByTypeName[this.typeName][typeName];
};

ModelObject._setSupertype = function(supertype) {
    ModelObject._supertypeByTypeName[this.typeName] = supertype;
};

ModelObject._getSupertype = function() {
    return ModelObject._supertypeByTypeName[this.typeName];
};

ModelObject._setProperties = function(properties) {
    ModelObject._propertiesByTypeName[this.typeName] = properties;
};

ModelObject._getProperties = function() {
    return ModelObject._propertiesByTypeName[this.typeName];
};

ModelObject._setPropertiesLookup = function(propertiesLookup) {
    ModelObject._propertiesLookupByTypeName[this.typeName] = propertiesLookup;
};

ModelObject._getPropertiesLookup = function() {
    return ModelObject._propertiesLookupByTypeName[this.typeName];
};

ModelObject._hasInitModelObjectPrototype = function() {
    return Boolean(this.typeName);
};

ModelObject._initPrototype = function() {
    if (!this._hasInitModelObjectPrototype()) {
        this.typeName = this.name;
        ModelObject._supertypeByTypeName = {};
        ModelObject._subtypesByTypeName = {};
        ModelObject._propertiesByTypeName = {};
        ModelObject._propertiesByTypeName[this.typeName] = [];
        ModelObject._propertiesLookupByTypeName = {};
        ModelObject._propertiesLookupByTypeName[this.typeName] = {};
    }

    var supertype = this._getSupertype();
    if (supertype) {
        // Child classes need to inherit parent values but have own copy
        this._setProperties(supertype._getProperties().concat());

        var setLookup = {};
        var propertiesLookup = supertype._getPropertiesLookup();
        Object.keys(propertiesLookup).forEach(function(key) {
            setLookup[key] = propertiesLookup[key];
        });
        this._setPropertiesLookup(setLookup);
    }
};

ModelObject._addProperty = function(property) {
    var propertiesLookup = this._getPropertiesLookup();
    if (propertiesLookup[property.name]) {
        throw new Error('Property \'' + property.name + '\' already exists');
    }

    this._getProperties().push(property);
    propertiesLookup[property.name] = property;

    if (property.type instanceof Array) {
        this._initCollectionProperty(property);
    } else {
        this._initValueProperty(property);
    }

    if (property.isModelObjectType) {
        this._addSubtype(property.singleType);
    }
};

ModelObject._initCollectionProperty = function(property) {
    Object.defineProperty(this.prototype, property.name, {
        configurable: false,
        enumerable: true,
        get: function() {
            return this[property.key];
        },
        set: function(newValue) {
            if (!(newValue instanceof Array)) {
                debug('Bad non-array value for property \'' + property.name + '\'');
                return this[property.key];
            }

            var newArray;
            try {
                newArray = this[property.key].setAsArray(newValue);
            } catch(err) {
                debug(err.message);
                return this[property.key];
            }

            return this[property.key];
        }
    });
};

ModelObject._initValueProperty = function(property) {
    Object.defineProperty(this.prototype, property.name, {
        configurable: false,
        enumerable: true,
        get: function() {
            return this[property.key];
        },
        set: function(newValue) {
            if (newValue === this[property.key]) {
                return;
            }

            try {
                newValue = ModelObjectProperty.filterValueForPropertyOrThrow(newValue, property);
            } catch(err) {
                debug(err.message);
                return this[property.key];
            }

            var oldValue = this[property.key];
            if (property.isModelObjectType && oldValue) {
                oldValue._removeParent(this, property.name);
            }

            if (property.isModelObjectType && newValue) {
                newValue._addParent(this, property.name);
            }

            this[property.key] = newValue;

            return this[property.key];
        }
    });
};

ModelObject.prototype._setPropertyDefaultValues = function() {
    this.getProperties().forEach(function(property) {
        if (property.isCollectionType) {
            this[property.key] = new Collection({
                property: property,
                owningModelObject: this
            });
        } else {
            this[property.key] = null;
        }
    }.bind(this));
};

ModelObject.prototype._addParent = function(parent, key) {
    if (!(parent instanceof ModelObject) || typeof key !== 'string') {
        throw new Error('Invalid parent or key');
    }

    if (parent.scope && !this.scope) {
        this.scope = parent.scope;
    } else if (parent.scope && this.scope && this.scope !== parent.scope) {
        throw new Error('Cannot add parent with differing scope');
    }

    var parentRelationship = new ParentRelationship({
        parent: parent,
        key: key
    });

    if (!this._parentRelationshipsByParentUUID[parent.uuid]) {
        this._parentRelationshipsByParentUUID[parent.uuid] = {};
    }
    if (!this._parentRelationshipsByParentUUID[parent.uuid][key]) {
        this._parentRelationships.push(parentRelationship);
        this._parentRelationshipsByParentUUID[parent.uuid][key] = parentRelationship;
    }
};

ModelObject.prototype._removeParent = function(parent, key) {
    if (!(parent instanceof ModelObject) || typeof key !== 'string') {
        throw new Error('Invalid parent or key');
    }

    if (!this._parentRelationshipsByParentUUID[parent.uuid]) {
        throw new Error('No such parent');
    }
    if (!this._parentRelationshipsByParentUUID[parent.uuid][key]) {
        throw new Error('No such parent on key');
    }

    var parentRelationship = this._parentRelationshipsByParentUUID[parent.uuid][key];
    var array = this._parentRelationships;
    array.splice(array.indexOf(parentRelationship), 1);

    delete this._parentRelationshipsByParentUUID[parent.uuid][key];
    if (Object.keys(this._parentRelationshipsByParentUUID[parent.uuid]).length === 0) {
        delete this._parentRelationshipsByParentUUID[parent.uuid];
    }
};

ModelObject.prototype.setScope = function(scope, callback) {
    if (this.scope === scope) {
        return maybeCallback(callback)();
    }

    var oldScope = this.scope;

    async.series([
        function removeFromCurrentScope(nextCallback) {
            if (!oldScope) {
                return nextCallback();
            }

            oldScope.removeModelObject(this, function(err) {
                if (err) {
                    return nextCallback(err);
                }

                this.emit('scopeDetach', oldScope);
                nextCallback();
            }.bind(this));
        }.bind(this),

        function addModelObjectToScope(nextCallback) {
            if (!scope) {
                return nextCallback();
            }

            scope.containsModelObject(this, function(err, result) {
                if (err) {
                    return nextCallback(err);
                }

                if (result) {
                    // For setting root scope ModelObject we add it 
                    // before setting scope of this ModelObject
                    return nextCallback();
                } else {
                    scope.addModelObject(this, nextCallback);
                }
            }.bind(this));
        }.bind(this),

    ], function scopeAttached(err) {
        if (err){
            return callbackOrEmitError(this, callback, err);
        }

        this.scope = scope;
        this.emit('scope', scope);

        this.getChildModelObjects(function(err, childModelObjects) {
            if (err) {
                return callbackOrEmitError(this, callback, err);
            }

            async.each(childModelObjects, function(modelObject, doneCallback) {
                modelObject.setScope(scope, doneCallback);
            }, function(err) {
                if (err) {
                    return callbackOrEmitError(this, callback, err);
                }

                maybeCallback(callback)();
            }.bind(this));
        }.bind(this));
    }.bind(this));
};

ModelObject.prototype.setIsScopeRoot = function(isScopeRoot, callback) {
    isScopeRoot = Boolean(isScopeRoot);

    if (this.isScopeRoot !== isScopeRoot) {
        if (!isScopeRoot) {
            this.setScope(null, function(err) {
                if (err) {
                    return callbackOrEmitError(this, callback, err);
                }   

                this.isScopeRoot = false;
                maybeCallback(callback)();
            }.bind(this));
        } else {
            var scope = new Scope({
                name: this.typeName
            });
            this.setScopeAndMakeRootModel(scope, function(err) {
                if (err) {
                    debug('setting ModelObject as scope root failed', err);
                    return callbackOrEmitError(this, callback, err);
                }

                maybeCallback(callback)(null, scope);
            }.bind(this));
        } 
    } else {
        maybeCallback(callback)();
    }
};

ModelObject.prototype.setScopeAndMakeRootModel = function(scope, callback) {
    scope.setRootModelObject(this, function(err) {
        if (err) {
            debug('setting ModelObject as root for scope failed', err);
            return callbackOrEmitError(this, callback, err);
        }

        this.setScope(scope, function(err) {
            if (err) {
                return callbackOrEmitError(this, callback, err);
            }   

            this.isScopeRoot = true;
            maybeCallback(callback)();
        }.bind(this));
    }.bind(this));
};

ModelObject.prototype.getChildModelObjectUUIDs = function(callback) {
    var uuids = [];
    this.getProperties().forEach(function(property) {
        if (property.isModelObjectType) {
            if (property.isCollectionType) {
                this[property.name].forEach(function(modelObject) {
                    uuids.push(modelObject.uuid);
                });
            } else  {
                var modelObject = this[property.name];
                if (modelObject) {
                    uuids.push(this[property.name].uuid);
                }
            }
        }
    }.bind(this));
    maybeCallback(callback)(null, uuids);
    return uuids;
};

ModelObject.prototype.getChildModelObjects = function(callback) {
    var results = [];
    async.each(this.getProperties(), function(property, doneCallback) {
        if (!property.isModelObjectType) {
            return doneCallback();
        }

        if (property.isCollectionType) {
            // Prepare the splice
            var args = [results.length, 0].concat(this[property.name].slice(0));
            // Splice results in
            results.splice.apply(results, args);
        } else if (this[property.name]) {
            results.push(this[property.name]);
        }

        doneCallback();

    }.bind(this), function(err) {
        if (err) {
            return callback(err);
        }

        callback(null, results);
    });
};

ModelObject.prototype.getValues = function(callback) {
    var results = {};
    this.getProperties().forEach(function(property) {
        if (!property.isModelObjectType) {
            if (property.isCollectionType) {
                results[property.name] = this[property.name].slice(0);
            } else {
                results[property.name] = this[property.name];
            }
        } else {
            if (property.isCollectionType) {
                results[property.name] = this[property.name].map(function(modelObject) {
                    return modelObject.uuid;
                });
            } else {
                var modelObject = this[property.name];
                if (modelObject) {
                    results[property.name] = modelObject.uuid;    
                }
            }
        }
    }.bind(this));
    maybeCallback(callback)(null, results);
    return results;
};

ModelObject.prototype.getAddSyncFragment = function(callback) {
    var syncFragment;
    try {
        syncFragment = new SyncFragment({
            type: 'add',
            modelObject: this,
            properties: this.getValues()
        });
    } catch (err) {
        return callback(err);
    }

    callback(null, syncFragment);
};

ModelObject.prototype.getProperty = function(propertyName) {
    if (!this._resolvedPropertiesLookup) {
        this._resolvedPropertiesLookup = ModelObject._getPropertiesLookup.call(this);
    }
    return this._resolvedPropertiesLookup[propertyName];
};

ModelObject.prototype.getProperties = function() {
    if (!this._resolvedProperties) {
        this._resolvedProperties = ModelObject._getProperties.call(this);
    }
    return this._resolvedProperties;
};

ModelObject.prototype.getParentRelationships = function(callback) {
    callback(null, this._parentRelationships);
};
