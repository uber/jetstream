module.exports = ScopeStateMessage;

var _ = require('lodash');
var AbstractMessage = require('./abstract_message');
var SyncFragment = require('../sync_fragment');
var util = require('util');
var robb = require('robb/src/robb');

function ScopeStateMessage(options) {
    options = options || {};
    AbstractMessage.call(this, options);

    if (!robb.isInt(options.scopeIndex)) {
        throw new Error('Invalid scopeIndex');
    }

    if (!(options.rootFragment instanceof SyncFragment)) {
        throw new Error('Invalid rootFragment');
    }

    if (!(options.syncFragments instanceof Array)) {
        throw new Error('Invalid syncFragments');
    }

    this.scopeIndex = options.scopeIndex;
    this.rootFragment = options.rootFragment;
    this.syncFragments = options.syncFragments;
}

util.inherits(ScopeStateMessage, AbstractMessage);

ScopeStateMessage.type = 'ScopeState';

ScopeStateMessage.parseAsJSON = function(json, callback) {
    if (!json || json.type !== this.type) {
        return callback(new Error('Message type was not \'' + this.type + '\''));
    }

    var rootFragment;
    try {
        if (typeof json.rootFragment !== 'object') {
            throw new Error('Root SyncFragment not on `rootFragment`');
        }
        rootFragment = new SyncFragment(json.rootFragment);
    } catch (err) {
        return callback(err);
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
        message = new ScopeStateMessage(_.extend(json, {
            rootFragment: rootFragment,
            syncFragments: syncFragments
        }));
    } catch (err) {
        return callback(err);
    }
    
    callback(null, message);
};

ScopeStateMessage.prototype.toJSON = function() {
    var json = AbstractMessage.prototype.toJSON.call(this);
    json.scopeIndex = this.scopeIndex;
    json.rootFragment = this.rootFragment;
    json.fragments = this.syncFragments;
    return json;
};