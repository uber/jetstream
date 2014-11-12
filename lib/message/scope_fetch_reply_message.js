module.exports = ScopeFetchReplyMessage;

var Errors = require('../errors');
var ReplyMessage = require('./reply_message');
var robb = require('robb/src/robb');
var util = require('util');

function ScopeFetchReplyMessage(options) {
    options = options || {};
    ReplyMessage.call(this, options);

    if (robb.isInt(options.scopeIndex) && !options.error) {
        this.scopeIndex = options.scopeIndex;
        this.error = null;
    } else if (options.error instanceof Error) {
        this.scopeIndex = null;
        this.error = options.error;
    } else {
        throw new Error('Requires scopeIndex or Error');
    }
}

util.inherits(ScopeFetchReplyMessage, ReplyMessage);

ScopeFetchReplyMessage.type = 'ScopeFetchReply';

ScopeFetchReplyMessage.parseAsJSON = function(json, callback) {
    if (!json || json.type !== this.type) {
        return callback(new Error('Message type was not \'' + this.type + '\''));
    }

    var message;
    try {
        message = new ScopeFetchReplyMessage(json);
    } catch (err) {
        return callback(err);
    }
    
    callback(null, message);
};

ScopeFetchReplyMessage.prototype.toJSON = function() {
    var json = ReplyMessage.prototype.toJSON.call(this);
    if (this.scopeIndex !== null) {
        json.scopeIndex = this.scopeIndex;
    }
    if (this.error) {
        json.error = Errors.jsonify(this.error);
    }
    return json;
};
