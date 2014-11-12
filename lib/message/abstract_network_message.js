module.exports = AbstractNetworkMessage;

var EventEmitter = require('events').EventEmitter;
var robb = require('robb/src/robb');
var util = require('util');

function AbstractNetworkMessage(options) {
    options = options || {};

    if (!robb.isInt(options.index)) {
        throw new Error('Message requires to be reliably sent with an index');
    }

    this.index = options.index;

    if (typeof options.replyCallback === 'function') {
        this.replyCallback = options.replyCallback;
    } else {
        this.replyCallback = null;
    }
}

util.inherits(AbstractNetworkMessage, EventEmitter);

AbstractNetworkMessage.type = 'Abstract';

AbstractNetworkMessage.prototype.toJSON = function() {
    var type = Object.getPrototypeOf(this).constructor.type;
    if (type === AbstractNetworkMessage.type) {
        throw new Error('Cannot call toJSON on an AbstractNetworkMessage');
    }
    return {
        type: type,
        index: this.index
    };
};
