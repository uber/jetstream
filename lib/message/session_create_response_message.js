module.exports = SessionCreateResponseMessage;

var AbstractMessage = require('./abstract_message');
var util = require('util');

function SessionCreateResponseMessage(options) {
    options = options || {};
    AbstractMessage.call(this, options);

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
}

util.inherits(SessionCreateResponseMessage, AbstractMessage);

SessionCreateResponseMessage.type = 'SessionCreateResponse';

SessionCreateResponseMessage.parseAsJSON = function(json, callback) {
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
};

SessionCreateResponseMessage.prototype.toJSON = function() {
    var json = AbstractMessage.prototype.toJSON.call(this);
    json.success = this.success;
    json.response = this.response;
    if (this.sessionToken) {
        json.sessionToken = this.sessionToken;
    }
    return json;
};
