module.exports = SessionCreateReplyMessage;

var AbstractNetworkMessage = require('./abstract_network_message');
var Errors = require('../errors');
var util = require('util');

function SessionCreateReplyMessage(options) {
    options = options || {};
    AbstractNetworkMessage.call(this, options);

    if (typeof options.sessionToken === 'string') {
        this.sessionToken = options.sessionToken;
        this.error = null;
    } else if (options.error instanceof Error) {
        this.sessionToken = null;
        this.error = options.error;
    } else {
        throw new Error('Invalid sessionToken or error');
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
    if (this.sessionToken) {
        json.sessionToken = this.sessionToken;
    }
    if (this.error) {
        json.error = Errors.jsonify(this.error);
    }
    return json;
};
