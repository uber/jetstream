var AbstractConnection = require('./abstract_connection');
var Errors = require('../errors');
var lazy = require('lazyrequire')(require);
var ws = require('ws');

var WebsocketTransport = null;
var resolve = function() {
    WebsocketTransport = lazy('./websocket_transport')();
};

var WebsocketTransportConnection = AbstractConnection.extend({
    init: function(options) {
        resolve();
        this._super(options);

        if (!(options.websocket instanceof ws)) {
            throw new Error('Invalid websocket');
        }

        this.websocket = options.websocket;
        delete this.options.websocket;
    },

    accept: function() {
        this._super();
        // Noop, hold onto connection
    },

    deny: function(error) {
        error = this._super(error);
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
    }
});

module.exports = WebsocketTransportConnection;
