module.exports = SessionCreateReplyMessage;

var AbstractNetworkMessage = require('./abstract_network_message');
var util = require('util');

function SessionCreateReplyMessage(options) {
    options = options || {};
    AbstractNetworkMessage.call(this, options);

    if (typeof options.success !== 'boolean') {
        throw new Error('Invalid success');
    }

    if (options.success === true) {
        if (typeof options.sessionToken !== 'string') {
            throw new Error('Invalid sessionToken for successful response message');
        }
    }

    this.success = options.success;

    if (options.sessionToken) {
        this.sessionToken = options.sessionToken;
    } else {
        this.sessionToken = null;
    }
}

util.inherits(SessionCreateReplyMessage, AbstractNetworkMessage);

SessionCreateReplyMessage.type = 'SessionCreateReply';

SessionCreateReplyMessage.parseAsJSON = function(json, callback) {
    if (!json || json.type !== this.type) {
        return callback(new Error('Message type was not \'' + this.type + '\''));
    }

    var message;
    try {
        message = new SessionCreateReplyMessage(json);
    } catch (err) {
        return callback(err);
    }
    
    callback(null, message);
};

SessionCreateReplyMessage.prototype.toJSON = function() {
    var json = AbstractNetworkMessage.prototype.toJSON.call(this);
    json.success = this.success;
    if (this.sessionToken) {
        json.sessionToken = this.sessionToken;
    }
    return json;
};
