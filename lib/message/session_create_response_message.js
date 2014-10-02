var _ = require('underscore');
var AbstractMessage = require('./abstract_message');

var SessionCreateResponseMessage = AbstractMessage.extend({
    type: 'SessionCreateResponse',

    parseAsJSON: function(json, callback) {
        if (!json || json.type !== this.type) {
            return callback(new Error('Message type was not \'' + this.type + '\''));
        }

        var message;

        try {
            message = new SessionCreateResponseMessage(json);
        } catch (err) {
            return callback(err);
        }
        
        callback(null, message);
    }
}, {
    init: function(options) {
        this._super(options);

        if (typeof options.success !== 'boolean') {
            throw new Error('Invalid success');
        }

        if (options.success === true) {
            if (typeof options.sessionToken !== 'string') {
                throw new Error('Invalid sessionToken for successful response message');
            }
        }

        if (typeof options.response !== 'object') {
            throw new Error('Invalid response');
        }

        this.success = options.success;
        if (options.sessionToken) {
            this.sessionToken = options.sessionToken;    
        }
        this.response = options.response || {};
        delete this.options.success;
        delete this.options.sessionToken;
        delete this.options.response;
    },

    toJSON: function() {
        var json = _.extend(this._super(), {
            success: this.success,
            response: this.response
        });
        if (this.sessionToken) {
            json.sessionToken = this.sessionToken;
        }
        return json;
    }
});

module.exports = SessionCreateResponseMessage;
