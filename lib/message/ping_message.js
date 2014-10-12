module.exports = PingMessage;

var AbstractMessage = require('./ping_message');
var robb = require('robb/src/robb');
var util = require('util');

function PingMessage(options) {
    options = options || {};
    AbstractMessage.call(this, options);

    if (!robb.isInt(options.ack)) {
        throw new Error('Invalid ack');
    }

    this.ack = options.ack;
}

util.inherits(PingMessage, AbstractMessage);

PingMessage.type = 'Ping';

PingMessage.parseAsJSON = function(json, callback) {
    if (!json || json.type !== this.type) {
        return callback(new Error('Message type was not \'' + this.type + '\''));
    }

    var message;
    try {
        message = new PingMessage(json);
    } catch (err) {
        return callback(err);
    }
    
    callback(null, message);
};

PingMessage.prototype.toJSON = function() {
    var json = AbstractMessage.prototype.toJSON.call(this);
    json.ack = this.ack;
    return json;
};
