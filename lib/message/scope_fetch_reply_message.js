module.exports = ScopeFetchReplyMessage;

var ReplyMessage = require('./reply_message');
var robb = require('robb/src/robb');
var util = require('util');

function ScopeFetchReplyMessage(options) {
    options = options || {};
    ReplyMessage.call(this, options);

    if (typeof options.success !== 'boolean') {
        throw new Error('Requires success');
    }
    
    this.success = options.success;

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
    json.success = this.success;
    if (this.scopeIndex !== null) {
        json.scopeIndex = this.scopeIndex;
    }
    if (this.error) {
        json.error = {message: this.error.message};
        if (this.error.code) {
            json.error.code = this.error.code;
        }
        if (this.error.slug) {
            json.error.slug = this.error.slug;
        }
    }
    return json;
};
