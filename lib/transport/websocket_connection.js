module.exports = WebsocketTransportConnection;

var AbstractConnection = require('./abstract_connection');
var Errors = require('../errors');
var util = require('util');
var WebsocketTransport = require('./websocket_transport');
var ws = require('ws');

function WebsocketTransportConnection(options) {
    AbstractConnection.call(this, options);

    if (!(options.websocket instanceof ws)) {
        throw new Error('Invalid websocket');
    }

    this.websocket = options.websocket;
}

util.inherits(WebsocketTransportConnection, AbstractConnection);

WebsocketTransportConnection.prototype.accept = function() {
    AbstractConnection.prototype.accept.call(this);
    // Noop, hold onto connection
};

WebsocketTransportConnection.prototype.deny = function(error) {
    error = AbstractConnection.prototype.deny.call(this, error);
    var response;

    if (error && typeof error.toJSON === 'function') {
        response = error.toJSON();
    } else {
        response = Errors.REJECTED.toJSON();
        if (typeof error.message === 'string') {
            response.message = error.message;
        }
    }

    var code = WebsocketTransport.CONST.CODE_DENIED_CONNECTION;
    // TODO send error properly as part of a message or similar
    this.websocket.close(code, JSON.stringify(response));
};
