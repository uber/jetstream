var AbstractMessage = require('./abstract_message');
var robb = require('robb/src/robb');

var ReplyMessage = AbstractMessage.extend({
    type: 'Reply',

    parseAsJSON: function(json, callback) {
        if (!json || json.type !== this.type) {
            return callback(new Error('Message type was not \'' + this.type + '\''));
        }

        var message;

        try {
            message = new ReplyMessage(json);
        } catch (err) {
            return callback(err);
        }
        
        callback(null, message);
    }
}, {
    init: function(options) {
        options = options || {};
        this._super(options);

        if (typeof this.index !== 'number') {
            throw new Error('ReplyMessage requires to be reliably sent with an index');
        }

        if (!robb.isInt(options.replyTo)) {
            throw new Error('Invalid replyTo index specified');
        }

        this.replyTo = options.replyTo;
        this.response = options.response || {};
    },

    toJSON: function() {
        var json = this._super();
        json.replyTo = this.replyTo;
        json.response = this.response;
        return json;
    }
});

module.exports = ReplyMessage;
