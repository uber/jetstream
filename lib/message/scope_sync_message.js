module.exports = ScopeSyncMessage;

var _ = require('lodash');
var AbstractMessage = require('./abstract_message');
var robb = require('robb/src/robb');
var SyncFragment = require('../sync_fragment');
var util = require('util');

function ScopeSyncMessage(options) {
    options = options || {};
    AbstractMessage.call(this, options);

    if (!robb.isInt(options.scopeIndex)) {
        throw new Error('Invalid scopeIndex');
    }

    if (!(options.syncFragments instanceof Array)) {
        throw new Error('Invalid syncFragments');
    }

    this.scopeIndex = options.scopeIndex;
    this.syncFragments = options.syncFragments;
}

util.inherits(ScopeSyncMessage, AbstractMessage);

ScopeSyncMessage.type = 'ScopeSync';

ScopeSyncMessage.parseAsJSON = function(json, callback) {
    if (!json || json.type !== this.type) {
        return callback(new Error('Message type was not \'' + this.type + '\''));
    }

    var syncFragments = [];
    try {
        if (!(json.fragments instanceof Array)) {
            throw new Error('SyncFragments not on `fragments`');
        }
        _.each(json.fragments, function(fragment) {
            syncFragments.push(new SyncFragment(fragment));
        });
    } catch (err) {
        return callback(err);
    }

    var message;
    try {
        message = new ScopeSyncMessage(_.extend(json, {
            syncFragments: syncFragments
        }));
    } catch (err) {
        return callback(err);
    }
    
    callback(null, message);
};

ScopeSyncMessage.prototype.toJSON = function() {
    var json = AbstractMessage.prototype.toJSON.call(this);
    json.scopeIndex = this.scopeIndex;
    json.fragments = this.syncFragments;
    return json;
};
