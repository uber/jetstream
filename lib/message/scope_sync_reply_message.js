module.exports = ScopeSyncReplyMessage;

var ReplyMessage = require('./reply_message');
var robb = require('robb/src/robb');
var util = require('util');

function ScopeSyncReplyMessage(options) {
    options = options || {};
    ReplyMessage.call(this, options);

    if (!(options.fragmentReplies instanceof Array)) {
        throw new Error('Invalid fragmentReplies');
    }
    
    this.fragmentReplies = options.fragmentReplies;
}

util.inherits(ScopeSyncReplyMessage, ReplyMessage);

ScopeSyncReplyMessage.type = 'ScopeSyncReply';

ScopeSyncReplyMessage.parseAsJSON = function(json, callback) {
    if (!json || json.type !== this.type) {
        return callback(new Error('Message type was not \'' + this.type + '\''));
    }

    var message;
    try {
        message = new ScopeSyncReplyMessage(json);
    } catch (err) {
        return callback(err);
    }
    
    callback(null, message);
};

ScopeSyncReplyMessage.prototype.toJSON = function() {
    var json = ReplyMessage.prototype.toJSON.call(this);
    json.fragmentReplies = this.fragmentReplies;
    return json;
};
