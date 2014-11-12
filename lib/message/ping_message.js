module.exports = PingMessage;

var AbstractNetworkMessage = require('./abstract_network_message');
var robb = require('robb/src/robb');
var util = require('util');

function PingMessage(options) {
    options = options || {};
    AbstractNetworkMessage.call(this, options);

    if (!robb.isInt(options.ack)) {
        throw new Error('Invalid ack');
    }

    this.ack = options.ack;
    if (options.resendMissing === true) {
        this.resendMissing = true;
    } else {
        this.resendMissing = false;
    }
}

util.inherits(PingMessage, AbstractNetworkMessage);

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
    var json = AbstractNetworkMessage.prototype.toJSON.call(this);
    json.ack = this.ack;
    json.resendMissing = this.resendMissing;
    return json;
};
