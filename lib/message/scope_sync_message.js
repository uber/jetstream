var _ = require('underscore');
var AbstractMessage = require('./abstract_message');
var Scope = require('../scope');
var SyncFragment = require('../sync_fragment');

var ScopeSyncMessage = AbstractMessage.extend({
    type: 'ScopeSync',

    parseAsJSON: function(json, callback) {
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
    }
}, {
    init: function(options) {
        this._super(options);

        if (typeof this.index !== 'number') {
            throw new Error('ScopeSyncMessage requires to be reliably sent with an index');
        }

        if (typeof options.scopeIndex !== 'number') {
            throw new Error('Invalid scopeIndex');
        }

        if (typeof options.fullScope !== 'undefined' &&
            typeof options.fullScope !== 'boolean') {
            throw new Error('Invalid fullScope');
        }

        if (!(options.syncFragments instanceof Array)) {
            throw new Error('Invalid syncFragments');
        }

        this.scopeIndex = options.scopeIndex;
        if (typeof options.fullScope === 'boolean') {
            this.fullScope = options.fullScope;
        }
        this.syncFragments = options.syncFragments;

        delete this.options.scopeIndex;
        delete this.options.fullScope;
        delete this.options.syncFragments;
    },

    toJSON: function() {
        var json = this._super();
        json.scopeIndex = this.scopeIndex;
        if (this.fullScope !== undefined) {
            json.fullScope = this.fullScope;
        }
        json.fragments = this.syncFragments;
        return json;
    }
});

module.exports = ScopeSyncMessage;
