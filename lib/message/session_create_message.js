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
        options = options || {};
        this._super(options);

        if (typeof options.version !== 'string') {
            throw new Error('Requires version');
        }

        if (!semver.valid(options.version)) {
            throw new Error('Requires valid version');
        }

        this.params = options.params || {};
        this.version = options.version;
    },

    toJSON: function() {
        var json = this._super();
        json.params = this.params;
        json.version = this.version;
        return json;
    }
});

module.exports = SessionCreateMessage;
