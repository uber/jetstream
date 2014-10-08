module.exports = WebsocketTransport;

var _ = require('underscore');
var AbstractTransport = require('./abstract_transport');
var MessageParser = require('../message/message_parser');
var util = require('util');
var WebsocketConnection = require('./websocket_connection');
var WebsocketTransportListener = require('./websocket_transport_listener');
var ws = require('ws');

var CONST = {};
CONST.WEBSOCKET_CODE_OFFSET  = 4096;
CONST.CODE_DENIED_CONNECTION = 0 + CONST.WEBSOCKET_CODE_OFFSET;

function WebsocketTransport(options) {
    AbstractTransport.call(this, options);

    this.setConnection(options.connection);
    this._activePendingSendImmediate = null;
    this._pendingSends = [];
}

util.inherits(WebsocketTransport, AbstractTransport);

WebsocketTransport.CONST = CONST;

WebsocketTransport.transportName = 'WebsocketTransport';

WebsocketTransport.listen = function(options) {
    return new WebsocketTransportListener(options);
};

WebsocketTransport.prototype.setConnection = function(connection) {
    if (!(connection instanceof WebsocketConnection)) {
        throw new Error('Invalid connection');
    }

    if (connection.websocket.readyState !== ws.OPEN) {
        throw new Error('Websocket connection is not open');
    }

    // If the connection ever dies we want to ensure we don't keep a reference
    connection.websocket.on('close', function() {
        this.connection = null;
    }.bind(this));

    connection.websocket.on('message', this._onData.bind(this));

    this.connection = connection;
};

WebsocketTransport.prototype.transportMessage = function(message, callback) {
    var entry = {message: message, callback: callback};

    if (!this.connection) {
        // Need to send on next time we have a connection
        return this._pendingSends.push(entry);
    }

    if (this._activePendingSendImmediate) {
        // We already started trying to transport on this IO frame, queue up for send
        return this._pendingSends.push(entry);
    }

    // Queue up and start the immediate for action from this IO frame
    this._pendingSends.push(entry);
    this._activePendingSendImmediate = setImmediate(this._transportAllPendingMessages.bind(this));
};

WebsocketTransport.prototype._transportAllPendingMessages = function() {
    if (this._activePendingSendImmediate) {
        clearImmediate(this._activePendingSendImmediate);
        this._activePendingSendImmediate = null;
    }

    if (!this.connection) {
        // We lost the connection during the immediate
        return;
    }

    if (this._pendingSends.length < 1) {
        // Queue was gutted
        return;
    }

    var messages = _.pluck(this._pendingSends, 'message');
    var callbacks = _.filter(_.pluck(this._pendingSends, 'callback'), _.isFunction);

    MessageParser.composeAsJSON(messages, function(err, json) {
        if (!this.connection) {
            // We lost the connection during the parsing
            return;
        }

        if (err) {
            callbacks.forEach(function (callback) {
                callback(err);
            });
            return;
        }

        try {
            while (json.length > 0) {
                var str = JSON.stringify(json.shift());
                this.connection.websocket.send(str);
            }
        } catch (err) {
            callbacks.forEach(function (callback) {
                callback(err);
            });
            return;
        }

        this._pendingSends = [];

        callbacks.forEach(function (callback) {
            callback(null);
        });
    }.bind(this));
};

WebsocketTransport.prototype.resumeWithConnection = function(connection) {
    this.setConnection(connection);
    // TODO: send pending messages
};
