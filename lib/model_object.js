var _ = require('underscore');
var async = require('async');
var Class = require('uberclass-clouseau');
var debug = require('debug')('jetstream:core:modelObject');
var EventEmitter = require('events').EventEmitter;
var LazyModelObject = require('./lazy_model_object');
var maybeCallback = require('maybe-callback');
var ModelObjectProperty = require('./model_object_property');
var ParentRelationship = require('./parent_relationship');
var Scope = require('./scope');
var StaticClass = require('./static_class');
var SyncFragment = require('./sync_fragment');
var util = require('util');
var uuid = require('node-uuid');

util.inherits(Class, EventEmitter);

var ModelObject = Class.extend(StaticClass.withBaseType(function() {
    return ModelObject;
}, {
    model: function(name, definition, methods) {
        if (typeof name !== 'string') {
            throw new Error('Invalid model name');
        }

        if (typeof definition !== 'function') {
            throw new Error('Invalid model definition');
        }

        var typeClass = this.extend({typeName: name}, methods || {});
        typeClass.prototype.typeName = name;
        typeClass._setSupertype(this);

        definition.apply(typeClass, []);

        this._initPrototype();
        this._addSubtype(name, typeClass);

        return typeClass;
    },

    has: function(propertyName, propertyType, options) {
        options = options || {};
        options.name = propertyName;
        options.type = propertyType;

        var property = new ModelObjectProperty(options);

        this._initPrototype();
        this._addProperty(property);
    },

    _initPrototype: function() {
        if (this.prototype._hasInitPrototype) {
            return;
        }

        this.prototype._hasInitPrototype = true;
        this.prototype._supertype = null;
        this.prototype._subtypes = {};
        this.prototype._properties = [];
        this.prototype._propertyLookup = {};
    },

    _setSupertype: function(typeClass) {
        this.prototype._supertype = typeClass;
    },

    _addSubtype: function(name, typeClass) {
        this.prototype._subtypes[name] = typeClass;
        if (this.prototype._supertype) {
            this.prototype._supertype._addSubtype(name, typeClass);
        }
    },

    _addProperty: function(property) {
        var propertyName = property.name;
        var propertyKey = '_' + propertyName;

        if (this.prototype._propertyLookup[propertyName]) {
            throw new Error('Property \'' + propertyName + '\' already exists');
        }

        this.prototype._properties.push(property);
        this.prototype._propertyLookup[propertyName] = property;

        if (property.type instanceof Array) {
            this._initCollectionProperty(property, propertyName, propertyKey);
        } else {
            this._initValueProperty(property, propertyName, propertyKey);
        }
    },

    _initCollectionProperty: function(property, propertyName, propertyKey) {
        var modelObjectType = property.isModelObjectType;
        Object.defineProperty(this.prototype, propertyName, {
            configurable: false,
            enumerable: true,
            get: function() {
                function getModelObjects(callback) {
                    async.map(this, function(lazyModelObject, doneCallback) {
                        lazyModelObject.getModelObject(doneCallback);
                    }, callback);
                }

                this[propertyKey] = this[propertyKey] || [];

                if (modelObjectType && typeof this[propertyKey].getModelObjects !== 'function') {
                    this[propertyKey].getModelObjects = getModelObjects;
                }

                return this[propertyKey];
            }.bind(this),
            set: function(newValue) {
                if (!(newValue instanceof Array)) {
                    return debug('bad non array value for property "%s"', propertyName);
                }
                
                if (propertyType === Number) {
                    newValue = _.map(newValue, function(entry) {
                        return Number(entry);
                    });
                } else if (propertyType === String) {
                    newValue = _.map(newValue, function(entry) {
                        return String(entry);
                    });
                } else if (propertyType === Boolean) {
                    newValue = _.map(newValue, function(entry) {
                        return Boolean(entry);
                    });
                } else if (propertyType === Date) {
                    newValue = _.map(newValue, function(entry) {
                        return Date(entry);
                    });
                } else if (modelObjectType) {
                    var valid = true;
                    newValue = _.map(newValue, function(entry) {
                        if (entry instanceof ModelObject) {
                            return new LazyModelObject({
                                creator: this,
                                modelObject: entry
                            });
                        } else if (typeof entry === 'string') {
                            return new LazyModelObject({
                                creator: this,
                                uuid: entry
                            });
                        } else {
                            valid = false;
                            return null;
                        }
                    }.bind(this));

                    if (!valid) {
                        return debug('bad value setting collection property "%s"', propertyName);
                    } else {
                        _.each(newValue, function(lazyModelObject) {
                            var childModelObject = lazyModelObject.modelObject;
                            if (childModelObject) {
                                childModelObject._setParent(this, propertyName);
                            }
                        }.bind(this));
                    }
                } else {
                    return debug('bad value setting collection property "%s"', propertyName);
                }

                this[propertyKey] = newValue;

                return newValue;
            }.bind(this)
        });
    },

    _initValueProperty: function(property, propertyName, propertyKey) {
        var modelObjectType = property.isModelObjectType;
        Object.defineProperty(this.prototype, propertyName, {
            configurable: false,
            enumerable: true,
            get: function() {
                return this[propertyKey];
            }.bind(this),
            set: function(newValue) {
                if (newValue !== null && newValue !== undefined) {
                    if (propertyType === Number) {
                        newValue = Number(newValue);
                    } else if (propertyType === String) {
                        newValue = String(newValue);
                    } else if (propertyType === Boolean) {
                        newValue = Boolean(newValue);
                    } else if (propertyType === Date) {
                        newValue = Date(newValue);
                    } else if (modelObjectType && entry instanceof propertyType) {
                        newValue = new LazyModelObject({
                            creator: this,
                            modelObject: newValue
                        });
                        newValue._setParent(this, propertyName);
                    } else if (modelObjectType && typeof newValue === 'string') {
                        newValue = new LazyModelObject({
                            creator: this,
                            uuid: newValue
                        });
                    } else {
                        return debug('bad value setting property "%s"', propertyName);
                    }
                }

                this[propertyKey] = newValue;

                return newValue;
            }.bind(this)
        });
    }
}), {
    init: function(options) {
        options = options || {};

        if (typeof options.uuid === 'string') {
            this.uuid = options.uuid;
        } else {
            this.uuid = uuid.v4();
        }

        this.options = options || {};
        this.scope = null;
        this.isScopeRoot = false;
        this._parentRelationship = null;
        this._setParent(options.parent, options.keyPath);
        delete this.options.uuid;
        delete this.options.parent;
    },

    _setParent: function(parent, keyPath) {
        if (!(parent instanceof ModelObject) || typeof keyPath !== 'string') {
            this.scope = null;
            this._parentRelationship = null;
            return;
        }

        this.scope = parent.scope;
        this._parentRelationship = new ParentRelationship({
            keyPath: keyPath,
            parent: parent
        });
    },

    setScope: function(scope, callback) {
        if (this.scope === scope) {
            return maybeCallback(callback)();
        }

        var oldScope = this.scope;
        this.scope = scope;

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
                        return nextCallback();
                    } else {
                        scope.addModelObject(this, nextCallback);    
                    }
                }.bind(this));
            }.bind(this),

        ], function scopeAttached(err) {
            if (err){ 
                return maybeCallback(callback)(err);
            }

            this.emit('scope', scope);

            this.getChildModelObjects(function(err, childModelObjects) {
                if (err) {
                    return maybeCallback(callback)(err);
                }

                async.each(childModelObjects, function(modelObject, doneCallback) {
                    modelObject.setScope(modelObject, doneCallback);
                }, maybeCallback(callback));
            }.bind(this));
        }.bind(this));
    },

    setIsScopeRoot: function(isScopeRoot, callback) {
        isScopeRoot = Boolean(isScopeRoot)

        if (this.isScopeRoot !== isScopeRoot) {
            if (!isScopeRoot) {
                this.setScope(null, function(err) {
                    if (err) {
                        return maybeCallback(callback)(err);
                    }   

                    this.isScopeRoot = false;
                    maybeCallback(callback)();
                });
            } else {
                var scope = new Scope({
                    name: this.constructor.name
                });
                this.setScopeAndMakeRootModel(scope, function(err) {
                    if (err) {
                        debug('setting ModelObject as scope root failed', err);
                        return maybeCallback(callback)(err);
                    }

                    maybeCallback(callback)(null, scope);
                }.bind(this));
            } 
        }
    },

    setScopeAndMakeRootModel: function(scope, callback) {
        scope.setRootModelObject(this, function(err) {
            if (err) {
                debug('setting ModelObject as root for scope failed', err);
                return maybeCallback(callback)(err);
            }

            this.setScope(scope, function(err) {
                if (err) {
                    return maybeCallback(callback)(err);
                }   

                this.isScopeRoot = true;
                maybeCallback(callback)();
            });
        }.bind(this));
    },

    getChildModelObjectUUIDs: function(callback) {
        var uuids = [];
        this._properties.forEach(function(property) {
            if (property.isModelObjectType) {
                if (property.isCollectionType) {
                    _.each(this[property.name], function(lazyModelObject) {
                        uuids.push(lazyModelObject.uuid);
                    });
                } else {
                    uuids.push(this[property.name].uuid);    
                }
            }
        }.bind(this));
        maybeCallback(callback)(null, uuids);
        return uuids;
    },

    getChildModelObjects: function(callback) {
        var results = [];
        async.each(this._properties, function(property, doneCallback) {
            if (!property.isModelObjectType) {
                return doneCallback();
            }

            if (property.isCollectionType) {
                this[property.name].getModelObjects(function(err, modelObjects) {
                    if (err) {
                        return doneCallback(err);
                    }

                    results = results.concat(modelObjects);
                    doneCallback();
                });
            } else {
                this[property.name].getModelObject(function(err, modelObject) {
                    if (err) {
                        return doneCallback(err);
                    }

                    results.push(modelObject);
                    doneCallback();
                });
            }
        }.bind(this), function(err) {
            if (err) {
                return callback(err);
            }

            callback(null, results);
        });
    },

    getPropertiesWithoutModelObjects: function() {
        var properties = {};
        this._properties.forEach(function(property) {
            if (!property.isModelObjectType) {
                properties[property.name] = this[property.name];
            }
        }.bind(this));
        return properties;
    },

    getPropertiesWithModelObjectsAsUUIDs: function() {
        var properties = {};
        this._properties.forEach(function(property) {
            if (property.isModelObjectType) {
                if (property.isCollectionType) {
                    var uuids = _.map(this[property.name], function(lazyModelObject) {
                        return lazyModelObject.uuid;
                    });
                    properties[property.name] = uuids;
                } else {
                    properties[property.name] = this[property.name].uuid;
                }
            } else {
                properties[property.name] = this[property.name];
            }
        }.bind(this));
        return properties;
    },

    getAddSyncFragment: function(callback) {
        var syncFragment;
        try {
            if (this._parentRelationship) {
                syncFragment = new SyncFragment({
                    type: 'add',
                    modelObject: this,
                    keyPath: this._parentRelationship.keyPath,
                    parent: this._parentRelationship.parent,
                    properties: this.getPropertiesWithoutModelObjects()
                });
            } else {
                syncFragment = new SyncFragment({
                    type: 'add',
                    modelObject: this,
                    properties: this.getPropertiesWithoutModelObjects()
                });
            }
        } catch (err) {
            return callback(err);
        }

        callback(null, syncFragment);
    },

    modelObjectPropertyWithName: function(propertyName) {
        return this._properties[propertyName];
    },

    getParent: function(callback) {
        if (!this._parentRelationship) {
            return callback();
        }

        if (!this.scope) {
            return callback(new Error('No scope to retrieve parent from'));
        }

        var maybeLazyModelObject = this._parentRelationship.parent;
        if (maybeLazyModelObject instanceof LazyModelObject) {
            if (maybeLazyModelObject.modelObject) {
                return callback(null, maybeLazyModelObject.modelObject);
            } else {
                return this.scope.getModelObjectByUUID(maybeLazyModelObject.uuid, callback);
            }
        } else if (maybeLazyModelObject instanceof ModelObject) {
            return callback(null, maybeLazyModelObject);
        } else {
            return callback(new Error('Parent not set correctly'));
        }
    },

    getKeyPath: function() {
        if (!this._parentRelationship) {
            return null;
        }
        return this._parentRelationship.keyPath;
    }
});

module.exports = ModelObject;
