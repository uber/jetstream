var _ = require('underscore');
var AbstractMessage = require('./abstract_message');
var semver = require('semver');

var SessionCreateMessage = AbstractMessage.extend({
    type: 'SessionCreate',

    parseAsJSON: function(json, callback) {
        if (!json || json.type !== this.type) {
            return callback(new Error('Message type was not \'' + this.type + '\''));
        }

        var message;

        try {
            message = new SessionCreateMessage(json);
        } catch (err) {
            return callback(err);
        }
        
        callback(null, message);
    }
}, {
    init: function(options) {
        this._super(options);

        if (typeof options.version !== 'string') {
            throw new Error('Requires version');
        }

        if (!semver.valid(options.version)) {
            throw new Error('Requires valid version');
        }

        this.params = options.params || {};
        this.version = options.version;
        delete this.options.params;
        delete this.options.version;
    },

    toJSON: function() {
        return _.extend(this._super(), {
            params: this.params,
            version: this.version
        });
    }
});

module.exports = SessionCreateMessage;
