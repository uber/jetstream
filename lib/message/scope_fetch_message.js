module.exports = ScopeFetchMessage;

var AbstractNetworkMessage = require('./abstract_network_message');
var util = require('util');

function ScopeFetchMessage(options) {
    options = options || {};
    AbstractNetworkMessage.call(this, options);

    if (typeof options.name !== 'string') {
        throw new Error('Invalid name');
    }

    this.name = options.name;
    this.params = options.params || {};
}

util.inherits(ScopeFetchMessage, AbstractNetworkMessage);

ScopeFetchMessage.type = 'ScopeFetch';

ScopeFetchMessage.parseAsJSON = function(json, callback) {
    if (!json || json.type !== this.type) {
        return callback(new Error('Message type was not \'' + this.type + '\''));
    }

    var message;
    try {
        message = new ScopeFetchMessage(json);
    } catch (err) {
        return callback(err);
    }
    
    callback(null, message);
};

ScopeFetchMessage.prototype.toJSON = function() {
    var json = AbstractNetworkMessage.prototype.toJSON.call(this);
    json.name = this.name;
    json.params = this.params;
    return json;
};
