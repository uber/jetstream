module.exports = ReplyMessage;

var AbstractMessage = require('./abstract_message');
var robb = require('robb/src/robb');
var util = require('util');

function ReplyMessage(options) {
    options = options || {};
    AbstractMessage.call(this, options);

    if (typeof this.index !== 'number') {
        throw new Error('ReplyMessage requires to be reliably sent with an index');
    }

    if (!robb.isInt(options.replyTo)) {
        throw new Error('Invalid replyTo index specified');
    }

    this.replyTo = options.replyTo;
    this.response = options.response || {};
}

util.inherits(ReplyMessage, AbstractMessage);

ReplyMessage.type = 'Reply';

ReplyMessage.parseAsJSON = function(json, callback) {
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
};

ReplyMessage.prototype.toJSON = function() {
    var json = AbstractMessage.prototype.toJSON.call(this);
    json.replyTo = this.replyTo;
    json.response = this.response;
    return json;
};
