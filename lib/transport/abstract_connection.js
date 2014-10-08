module.exports = AbstractConnection;

var EventEmitter = require('events').EventEmitter;
var util = require('util');

function AbstractConnection(options) {
    options = options || {};

    this.params = options.params || {};
    this.accepted = true;
}

util.inherits(AbstractConnection, EventEmitter);

AbstractConnection.prototype.accept = function() {
    this.emit('accept');
};

AbstractConnection.prototype.deny = function(error) {
    this.accepted = false;
    if (typeof error === 'string') {
        error = new Error(error);
    }
    this.emit('deny', error);
    return error;
};

AbstractConnection.prototype.startSession = function(session, client, response) {
    this.session = session;
    this.emit('session', this, session, client, response);
};

AbstractConnection.prototype.denySession = function(session, client, response) {
    this.emit('sessionDenied', this, session, client, response);
};
