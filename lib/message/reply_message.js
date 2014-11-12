module.exports = ReplyMessage;

var AbstractNetworkMessage = require('./abstract_network_message');
var robb = require('robb/src/robb');
var util = require('util');

function ReplyMessage(options) {
    options = options || {};
    AbstractNetworkMessage.call(this, options);

    if (!robb.isInt(options.replyTo)) {
        throw new Error('Invalid replyTo index specified');
    }

    this.replyTo = options.replyTo;
    this.response = options.response || {};
}

util.inherits(ReplyMessage, AbstractNetworkMessage);

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
    var json = AbstractNetworkMessage.prototype.toJSON.call(this);
    json.replyTo = this.replyTo;
    json.response = this.response;
    return json;
};
