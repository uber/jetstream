var _ = require('underscore');
var async = require('async');
var callbackOrEmitError = require('callback-or-emit-error');
var Class = require('uberclass-clouseau');
var Collection = require('./collection');
var debug = require('debug')('jetstream:core:modelObject');
var EventEmitter = require('events').EventEmitter;
var maybeCallback = require('maybe-callback');
var ModelObjectProperty = require('./model_object_property');
var ParentRelationship = require('./parent_relationship');
var Scope = require('./scope');
var StaticClass = require('./static_class');
var SyncFragment = require('./sync_fragment');
var util = require('util');
var uuid = require('node-uuid');

function ModelObject(options) {
    options = options || {};

    if (typeof options.uuid === 'string') {
        this.uuid = options.uuid;
    } else {
        this.uuid = uuid.v4();
    }

    this.scope = null;
    this.isScopeRoot = false;
    this._parentRelationship = null;
    this._resolvedProperties = null;
    this._resolvedPropertiesLookup = null;
    this._setParent(options.parent, options.keyPath);
}

util.inherits(ModelObject, EventEmitter);

ModelObject.defaults = {
    baseType: function() {
        return ModelObject;
    }
};

ModelObject.isChildClass = StaticClass.isChildClass;

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
};

ModelObject._initCollectionProperty = function(property) {
    Object.defineProperty(this.prototype, property.name, {
        configurable: false,
        enumerable: true,
        get: function() {
            if (!this[property.key]) {
                this[property.key] = new Collection({property: property});
            }

            return this[property.key];
        },
        set: function(newValue) {
            if (!this[property.key]) {
                this[property.key] = new Collection({property: property});
            }

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

            if (property.isModelObjectType) {
                _.each(newArray, function(modelObject) {
                    modelObject._setParent(this, property.name);
                }.bind(this));
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
            try {
                newValue = ModelObjectProperty.filterValueForPropertyOrThrow(newValue, property);
            } catch(err) {
                debug(err.message);
                return this[property.key];
            }

            if (property.isModelObjectType && newValue) {
                newValue._setParent(this, property.name);
            }

            this[property.key] = newValue;

            return this[property.key];
        }
    });
};

ModelObject.prototype._setParent = function(parent, keyPath) {
    if (!(parent instanceof ModelObject) || typeof keyPath !== 'string') {
        this.scope = null;
        this._parentRelationship = null;
        return;
    }

    if (parent.scope) {
        this.scope = parent.scope;
    }
    this._parentRelationship = new ParentRelationship({
        keyPath: keyPath,
        parent: parent
    });
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
            } else {
                uuids.push(this[property.name].uuid);    
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
        }
    }.bind(this));
    maybeCallback(callback)(null, results);
    return results;
};

ModelObject.prototype.getAddSyncFragment = function(callback) {
    var syncFragment;
    var parentRelationship = this._parentRelationship;
    try {
        if (parentRelationship) {
            syncFragment = new SyncFragment({
                type: 'add',
                modelObject: this,
                keyPath: parentRelationship.keyPath,
                parent: parentRelationship.parent,
                properties: this.getValues()
            });
        } else {
            syncFragment = new SyncFragment({
                type: 'add',
                modelObject: this,
                properties: this.getValues()
            });
        }
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

ModelObject.prototype.getParent = function(callback) {
    if (!this._parentRelationship) {
        return callback();
    }
    callback(null, this._parentRelationship.parent);
};

ModelObject.prototype.getKeyPath = function() {
    if (!this._parentRelationship) {
        return null;
    }
    return this._parentRelationship.keyPath;
};

module.exports = ModelObject;
