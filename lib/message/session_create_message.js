module.exports = SessionCreateMessage;

var AbstractMessage = require('./abstract_message');
var semver = require('semver');
var util = require('util');

function SessionCreateMessage(options) {
    options = options || {};
    AbstractMessage.call(this, options);

    if (typeof options.version !== 'string') {
        throw new Error('Requires version');
    }

    if (!semver.valid(options.version)) {
        throw new Error('Requires valid version');
    }

    this.params = options.params || {};
    this.version = options.version;
}

util.inherits(SessionCreateMessage, AbstractMessage);

SessionCreateMessage.type = 'SessionCreate';

SessionCreateMessage.parseAsJSON = function(json, callback) {
    if (!json || json.type !== this.type) {
        return callback(new Error('Message type was not \'' + this.type + '\''));
    }

    var message;
    try {
        message = new SessionCreateMessage(json);
    } catch (err) {
        return callback(err);
    }
    
    callback(null, message);
};

SessionCreateMessage.prototype.toJSON = function() {
    var json = AbstractMessage.prototype.toJSON.call(this);
    json.params = this.params;
    json.version = this.version;
    return json;
};
