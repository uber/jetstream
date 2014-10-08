module.exports = Scope;

var _ = require('underscore');
var AbstractPersistMiddleware = require('./middleware/persist/abstract_persist_middleware');
var async = require('async');
var callbackOrEmitError = require('callback-or-emit-error');
var debug = require('debug')('jetstream:core:scope');
var EventEmitter = require('events').EventEmitter;
var maybeCallback = require('maybe-callback');
var MemoryPersistMiddleware = require('./middleware/persist/memory_persist_middleware');
var SyncFragment = require('./sync_fragment');
var util = require('util');
var uuid = require('node-uuid');

function Scope(options) {
    options = options || {};

    if (typeof options.name !== 'string') {
        throw new Error('Requires name');
    }

    this.uuid = uuid.v4();
    this.name = options.name;
    // By default use memory persistence until overriden
    this.persist = new MemoryPersistMiddleware();
    this._hasRootModel = false;
    this._rootModelObjectUUID = null;
    this._rootModelObjectConstructor = null;
}

util.inherits(Scope, EventEmitter);

Scope.prototype._canPersist = function(userCallback) {
    return Boolean(this.persist);
};

Scope.prototype.use = function(middleware) {
    if (middleware instanceof AbstractPersistMiddleware) {
        this.persist = middleware;
    } else {
        throw new Error('Middleware is not supported');
    }
};

Scope.prototype.setRootModelObject = function(modelObject, callback) {
    if (!this._canPersist()) {
        return callbackOrEmitError(this, callback, new Error('No persist middleware set'));
    }

    if (this._rootModelObjectUUID) {
        return callbackOrEmitError(this, callback, new Error('Already has root modelObject set'));
    }

    this.addModelObject(modelObject, function(err) {
        if (err) {
            return callbackOrEmitError(this, callback, err);
        }

        this._hasRootModel = true;
        this._rootModelObjectUUID = modelObject.uuid;
        this._rootModelObjectConstructor = modelObject.constructor;
        maybeCallback(callback)();
    }.bind(this));
};

Scope.prototype.addModelObject = function(modelObject, callback) {
    if (!this._canPersist()) {
        return callbackOrEmitError(this, callback, new Error('No persist middleware set'));
    }

    this.persist.addModelObject(modelObject, callback);
};

Scope.prototype.removeModelObject = function(modelObject, callback) {
    if (!this._canPersist()) {
        return callbackOrEmitError(this, callback, new Error('No persist middleware set'));
    }

    this.persist.removeModelObject(modelObject, callback);
};

Scope.prototype.updateModelObject = function(modelObject, callback) {
    if (!this._canPersist()) {
        return callbackOrEmitError(this, callback, new Error('No persist middleware set'));
    }

    this.persist.updateModelObject(modelObject, callback);
};

Scope.prototype.containsModelObject = function(modelObject, callback) {
    if (!this._canPersist()) {
        return callbackOrEmitError(this, callback, new Error('No persist middleware set'));
    }

    this.persist.containsModelObjectWithUUID(modelObject.uuid, callback);
};

Scope.prototype.getModelObjectByUUID = function(uuid, callback) {
    if (!this._canPersist()) {
        return callbackOrEmitError(this, callback, new Error('No persist middleware set'));
    }

    this.persist.getModelObjectByUUID(uuid, callback);
};

Scope.prototype.getAllModelObjects = function(callback) {
    if (!this._canPersist()) {
        return callbackOrEmitError(this, callback, new Error('No persist middleware set'));
    }

    if (!this._rootModelObjectUUID) {
        return callbackOrEmitError(this, callback, new Error('No root modelObject set'));
    }

    var persist = this.persist;

    return getRecursively(this._rootModelObjectUUID, callback);

    function getRecursively(modelObjectUUID, doneCallback) {
        var results = [];
        persist.getModelObjectByUUID(modelObjectUUID, function(err, modelObject) {
            if (err) {
                return doneCallback(err);
            }

            if (!modelObject) {
                return doneCallback(new Error(
                    'Cannot find model object with UUID \'' + modelObjectUUID + '\''));
            }

            results.push(modelObject);

            modelObject.getChildModelObjectUUIDs(function(err, uuids) {
                if (err) {
                    return doneCallback(err);
                }

                if (uuids.length < 1) {
                    return doneCallback(null, results);
                }

                async.map(uuids, getRecursively, function(err, modelObjectArrays) {
                    if (err) {
                        return doneCallback(err);
                    }

                    if (modelObjectArrays.length > 0) {
                        modelObjectArrays.forEach(function(modelObjects) {
                            results = results.concat(modelObjects);
                        });
                    }

                    doneCallback(null, results);
                });
            });
        });
    }
};

Scope.prototype.applySyncFragments = function(syncFragments, context, callback) {
    if (!this._canPersist()) {
        return callbackOrEmitError(this, callback, new Error('No persist middleware set'));
    }

    if (!this._hasRootModel) {
        return callbackOrEmitError(this, callback, new Error('No root model set'));
    }

    var results = new Array(syncFragments.length);
    var index = 0;

    async.mapSeries(syncFragments, function(syncFragment, doneCallback) {
        this._applySyncFragment(syncFragment, function(err) {
            var result = {};
            if (err) {
                result.error = {message: err.message};
                if (err.code) {
                    result.error.code = err.code;
                }
                if (err.slug) {
                    result.error.slug = err.slug;
                }
            }
            results[index] = result;
            index++;
            doneCallback();
        });

    }.bind(this), function(err) {
        if (err) {
            return callbackOrEmitError(this, callback, err);
        }

        var appliedFragments = [];
        _.each(results, function(result, index) {
            var syncFragment = syncFragments[index];
            if (!result.error) {
                appliedFragments.push(syncFragment);
            }
        });
        
        if (appliedFragments.length > 0) {
            this.emit('changes', appliedFragments, context);    
        }

        maybeCallback(callback)(null, results);

    }.bind(this));
};

Scope.prototype._applySyncFragment = function(fragment, callback) {
    switch (fragment.type) {
        case SyncFragment.CONST.TYPE_ADD:
            this._applyAddSyncFragment(fragment, callback);
            break;
        case SyncFragment.CONST.TYPE_REMOVE:
            this._applyRemoveSyncFragment(fragment, callback);
            break;
        case SyncFragment.CONST.TYPE_CHANGE:
            this._applyChangeSyncFragment(fragment, callback);
            break;
        // TODO: support movechange
        default:
            callback(null, new Error('Misunderstood SyncFragment type')); 
    }
};

Scope.prototype._getFragmentParent = function(fragment, callback) {
    this.persist.getModelObjectByUUID(fragment.parentUUID, function(err, parent) {
        if (err) {
            return callback(err);
        }
        if (!parent) {
            return callback(new Error('Parent not found at \'' + fragment.parentUUID + '\''));
        }

        callback(null, parent);
    });
};

Scope.prototype._getFragmentParentProperty = function(fragment, parent, callback) {
    var keyPath = fragment.keyPath;
    var property = parent.getProperty(keyPath);
    if (!property) {
        return callback(new Error('Parent has no property at \'' + keyPath + '\''));
    }

    if (!property.isModelObjectType) {
        return callback(new Error(
            'Parent property at \'' + keyPath + '\' is not a model object type'));
    }

    if (property.singleType.typeName !== fragment.clsName) {
        return callback(new Error(
            'Parent property at \'' + keyPath + '\' is type \'' + 
            property.singleType.typeName + '\' not \'' + 
            fragment.clsName + '\''));
    }

    callback(null, property);
};

Scope.prototype._verifyFragmentProperties = function(fragment, modelObject, callback) {
    var err = null;
    _.each(fragment.properties, function(value, key) {
        if (err) {
            return;
        }

        var property = modelObject.getProperty(key);
        if (!property) {
            err = new Error('No property at \'' + key + '\'');
            return;
        }
        // TODO: support ref modelobjectype setting
        if (property.isModelObjectType) {
            err = new Error('Cannot set ModelObject type property at \'' + key + '\'');
            return;                            
        }

        var validNumber = property.singleType === Number &&
            typeof value === 'number' && 
            !isNaN(value);
        var validString = property.singleType === String &&
            typeof value === 'string';
        var validBoolean = property.singleType === Boolean &&
            typeof value === 'boolean';
        var validDate = property.singleType === Date && 
            !isNaN(new Date(value).getTime());

        if (!validNumber && !validString && !validBoolean && !validDate) {
            err = new Error(
                'Not valid type at \'' + key + '\', should be ' + 
                property.singleType.name);
            return;
        }
    });

    if (err) {
        return callback(err);
    }
    callback();
};

Scope.prototype._applyAddSyncFragment = function(fragment, callback) {
    async.waterfall([
        this._getFragmentParent.bind(this, fragment),

        function verifyAdd(parent, nextCallback) {
            this._getFragmentParentProperty(fragment, parent, function(err, property) {
                if (err) {
                    return nextCallback(err);
                }
                nextCallback(null, parent, property, property.singleType);
            });
        }.bind(this),

        function createModelObject(parent, parentProperty, modelObjectType, nextCallback) {
            var modelObject;
            try {
                modelObject = new modelObjectType();

                var uuid = String(fragment.objectUUID);
                // TODO: better UUID validation
                if (!uuid || typeof uuid !== 'string') {
                    var err = new Error('Bad UUID \'' + fragment.objectUUID + '\'');
                    return nextCallback(err);
                }

                modelObject.uuid = uuid;
            } catch (err) {
                return nextCallback(err);
            }

            nextCallback(null, parent, parentProperty, modelObject);
        }.bind(this),

        function verifyProperties(parent, parentProperty, modelObject, nextCallback) {
            this._verifyFragmentProperties(fragment, modelObject, function(err) {
                if (err) {
                    return nextCallback(err);
                }

                nextCallback(null, parent, parentProperty, modelObject);
            });
        }.bind(this),

        function setProperties(parent, parentProperty, modelObject, nextCallback) {
            _.each(fragment.properties, function(value, key) {
                modelObject[key] = value;
            }.bind(this));

            nextCallback(null, parent, parentProperty, modelObject);
        }.bind(this),

        function addModelObjectToParent(parent, parentProperty, modelObject, nextCallback) {
            if (!parentProperty.isCollectionType) {
                parent[fragment.keyPath] = modelObject;
            } else {
                var collection = parent[fragment.keyPath];
                try {
                    collection.push(modelObject);
                } catch (err) {
                    return nextCallback(err);
                }
            }

            // TODO: this before so no need to rollback if it fails
            this.persist.addModelObject(modelObject, function(err) {
                if (err) {
                    return nextCallback(err);
                }

                nextCallback();
            });
        }.bind(this)
    ], callback);
};

Scope.prototype._applyRemoveSyncFragment = function(fragment, callback) {
    async.waterfall([
        function getModelObject(nextCallback) {
            this.persist.getModelObjectByUUID(fragment.objectUUID, function(err, modelObject) {
                if (err) {
                    return nextCallback(err);
                }
                if (!modelObject) {
                    return nextCallback(new Error('ModelObject not found'))
                }

                nextCallback(null, modelObject);
            });
        }.bind(this),

        function getParent(modelObject, nextCallback) {
            modelObject.getParent(function(err, parent) {
                if (err) {
                    return nextCallback(err);
                }
                nextCallback(null, modelObject, parent);
            });
        }.bind(this),

        function verifyRemove(modelObject, parent, nextCallback) {
            var keyPath = modelObject.getKeyPath();
            var property = parent.getProperty(keyPath);
            if (!property) {
                return nextCallback(new Error(
                    'No ModelObject property on parent at \'' + keyPath + '\''));
            }

            var foundIndexes = [];
            if (!property.isCollectionType) {
                if (!parent[keyPath] || parent[keyPath].uuid !== modelObject.uuid) {
                    return nextCallback(new Error(
                        'Parent property at \'' + keyPath + '\' not set to same ModelObject instance'));
                }
            } else {
                parent[keyPath].forEach(function(object, index) {
                    if (object.uuid === modelObject.uuid) {
                        foundIndexes.push(index);
                    }
                });
                if (foundIndexes.length === 0) {
                    return nextCallback(new Error(
                        'Parent property at \'' + keyPath + '\' did not contain ModelObject instance'));
                }
            }

            nextCallback(null, modelObject, keyPath, parent, property, foundIndexes);
        }.bind(this),

        function removeModelObject(modelObject, keyPath, parent, property, foundIndexes, nextCallback) {
            this.persist.removeModelObject(modelObject, function(err) {
                if (err) {
                    return nextCallback(err);
                }

                if (!property.isCollectionType) {
                    parent[keyPath] = null;
                } else {
                    try {
                        foundIndexes.forEach(function(index) {
                            parent[keyPath].splice(index, 1);
                        });
                    } catch(err) {
                        return nextCallback(err);
                    }
                }
                
                nextCallback();
            });
        }.bind(this)

    ], callback);
};

Scope.prototype._applyChangeSyncFragment = function(fragment, callback) {
    async.waterfall([
        function getModelObject(nextCallback) {
            this.persist.getModelObjectByUUID(fragment.objectUUID, function(err, modelObject) {
                if (err) {
                    return nextCallback(err);
                }
                if (!modelObject) {
                    return nextCallback(new Error('ModelObject not found'))
                }

                nextCallback(null, modelObject);
            });
        }.bind(this),

        function verifyProperties(modelObject, nextCallback) {
            this._verifyFragmentProperties(fragment, modelObject, function(err) {
                if (err) {
                    return nextCallback(err);
                }

                nextCallback(null, modelObject);
            });
        }.bind(this),

        function setProperties(modelObject, nextCallback) {
            _.each(fragment.properties, function(value, key) {
                modelObject[key] = value;
            }.bind(this));

            nextCallback(null, modelObject);
        }.bind(this),

        function updateModelObject(modelObject, nextCallback) {
            // TODO: do this first somehow without modifying object
            this.persist.updateModelObject(modelObject, nextCallback);
        }.bind(this)

    ], callback);
};
