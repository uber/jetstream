var _ = require('underscore');
var AbstractPersistMiddleware = require('./middleware/persist/abstract_persist_middleware');
var async = require('async');
var Class = require('uberclass-clouseau');
var debug = require('debug')('jetstream:core:scope');
var EventEmitter = require('events').EventEmitter;
var maybeCallback = require('maybe-callback');
var maybeCallbackOnce = require('maybe-callback').once;
var SyncFragment = require('./sync_fragment');
var uuid = require('node-uuid');

var Scope = Class.extend({
    init: function(options) {
        this.options = options || {};

        if (typeof options.name !== 'string') {
            throw new Error('Requires name');
        }

        this.uuid = uuid.v4();
        this.name = options.name;
        this.persist = null;
        this._hasRootModel = false;
        this._rootModelObjectUUID = null;
        this._rootModelObjectConstructor = null;
        delete this.options.name;
    },

    _canPersist: function(userCallback) {
        return Boolean(this.persist);
    },

    uses: function(middleware) {
        if (middleware instanceof AbstractPersistMiddleware) {
            this.persist = middleware;
        } else {
            throw new Error('Middleware is not supported');
        }
    },

    setRootModelObject: function(modelObject, callback) {
        if (!this._canPersist()) {
            return maybeCallback(callback)(new Error('No persist middleware set'));
        }

        if (this._rootModelObjectUUID) {
            return maybeCallback(callback)(new Error('Already has root modelObject set'));
        }

        this.addModelObject(modelObject, function(err) {
            if (err) {
                return maybeCallback(callback)(err);
            }

            this._hasRootModel = true;
            this._rootModelObjectUUID = modelObject.uuid;
            this._rootModelObjectConstructor = modelObject.constructor;
            maybeCallback(callback)();
        }.bind(this));
    },

    addModelObject: function(modelObject, callback) {
        if (!this._canPersist()) {
            return maybeCallback(callback)(new Error('No persist middleware set'));
        }

        this.persist.addModelObject(modelObject, callback);
    },

    removeModelObject: function(modelObject, callback) {
        if (!this._canPersist()) {
            return maybeCallback(callback)(new Error('No persist middleware set'));
        }

        this.persist.removeModelObject(modelObject, callback);
    },

    updateModelObject: function(modelObject, callback) {
        if (!this._canPersist()) {
            return maybeCallback(callback)(new Error('No persist middleware set'));
        }

        this.persist.updateModelObject(modelObject, callback);
    },

    containsModelObject: function(modelObject, callback) {
        if (!this._canPersist()) {
            return maybeCallback(callback)(new Error('No persist middleware set'));
        }

        this.persist.containsModelObjectWithUUID(modelObject.uuid, callback);
    },

    getModelObjectByUUID: function(uuid, callback) {
        if (!this._canPersist()) {
            return maybeCallback(callback)(new Error('No persist middleware set'));
        }

        this.persist.getModelObjectByUUID(uuid, callback);
    },

    getAllModelObjects: function(callback) {
        if (!this._canPersist()) {
            return maybeCallback(callback)(new Error('No persist middleware set'));
        }

        if (!this._rootModelObjectUUID) {
            return maybeCallback(callback)(new Error('No root modelObject set'));
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
    },

    applySyncFragments: function(syncFragments, context, callback) {
        if (!this._canPersist()) {
            return maybeCallback(callback)(new Error('No persist middleware set'));
        }

        if (!this._hasRootModel) {
            return maybeCallback(callback)(new Error('No root model set'));
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
                return maybeCallback(callback)(err);
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
    },

    _applySyncFragment: function(fragment, callback) {
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
    },

    _getFragmentParent: function(fragment, callback) {
        this.persist.getModelObjectByUUID(fragment.parentUUID, function(err, parent) {
            if (err) {
                return callback(err);
            }
            if (!parent) {
                return callback(new Error('Parent not found at \'' + fragment.parentUUID + '\''));
            }

            callback(null, parent);
        });
    },

    _getFragmentParentProperty: function(fragment, parent, callback) {
        var keyPath = fragment.keyPath;
        var property = parent.modelObjectPropertyWithName(keyPath);
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
    },

    _verifyFragmentProperties: function(fragment, modelObject, callback) {
        var err = null;
        _.each(fragment.properties, function(value, key) {
            if (err) {
                return;
            }

            var property = modelObject.modelObjectPropertyWithName(key);
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
    },

    _applyAddSyncFragment: function(fragment, callback) {
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
                    parent[fragment.keyPath] = collection.concat([modelObject]);
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
    },

    _applyRemoveSyncFragment: function(fragment, callback) {
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
                var property = parent.modelObjectPropertyWithName(keyPath);
                if (!property) {
                    return nextCallback(new Error(
                        'No ModelObject property on parent at \'' + keyPath + '\''));
                }

                if (!property.isCollectionType) {
                    if (!parent[keyPath] || parent[keyPath].uuid !== modelObject.uuid) {
                        return nextCallback(new Error(
                            'Parent property at \'' + keyPath + '\' not set to same ModelObject instance'));
                    }
                } else {
                    var matched = _.filter(parent[keyPath], function(object) {
                        return object.uuid === modelObject.uuid;
                    });
                    if (matched.length < 1) {
                        return nextCallback(new Error(
                            'Parent property at \'' + keyPath + '\' did not contain ModelObject instance'));
                    }
                }

                nextCallback(null, modelObject, keyPath, parent, property);
            }.bind(this),

            function removeModelObject(modelObject, keyPath, parent, property, nextCallback) {
                this.persist.removeModelObject(modelObject, function(err) {
                    if (err) {
                        return nextCallback(err);
                    }

                    if (!property.isCollectionType) {
                        parent[keyPath] = null;
                    } else {
                        parent[keyPath] = _.filter(parent[keyPath], function(object) {
                            return object.uuid !== modelObject.uuid;
                        });
                    }
                    
                    nextCallback();
                });
            }.bind(this)

        ], callback);
    },

    _applyChangeSyncFragment: function(fragment, callback) {
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
    }
});

module.exports = Scope;
