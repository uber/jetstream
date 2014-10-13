module.exports = WebsocketTransport;

var _ = require('lodash');
var AbstractTransport = require('./abstract_transport');
var logger = require('../logger');
var MessageParser = require('../message/message_parser');
var PingMessage = require('../message/ping_message');
var util = require('util');
var WebsocketConnection = require('./websocket_connection');
var WebsocketTransportListener = require('./websocket_transport_listener');
var ws = require('ws');

var debug = logger.debug.bind(logger.debug, 'transport:websocket');

var CONST = {};
CONST.WEBSOCKET_CODE_OFFSET  = 4096;
CONST.CODE_DENIED_CONNECTION = 0 + CONST.WEBSOCKET_CODE_OFFSET;
CONST = Object.freeze(CONST);

function WebsocketTransport(options) {
    AbstractTransport.call(this, options);

    this.setConnection(options.connection);
    this._activePendingSendImmediate = null;
    this._pendingSends = [];
    this._sending = false;
}

util.inherits(WebsocketTransport, AbstractTransport);

WebsocketTransport.CONST = CONST;

WebsocketTransport.transportName = 'WebsocketTransport';

WebsocketTransport.configure = AbstractTransport.configure.bind(WebsocketTransport);

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

WebsocketTransport.prototype.resumeWithConnection = function(connection) {
    this.setConnection(connection);
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

    if (this._sending) {
        // Messages arrived during transportation, resend after the current send attempt
        return this.once('sendAttempt', this._transportAllPendingMessages.bind(this));
    }

    this._sending = true;

    var messages = _.pluck(this._pendingSends, 'message');
    var unsent = messages.slice(0);
    var callbacks = _.filter(_.pluck(this._pendingSends, 'callback'), _.isFunction);
    this._pendingSends = [];

    var done = function(err) {
        if (err) {
            // Push unsent messages back on the queue
            var args = [0, 0].concat(messages.map(function(message) {
                return {message: message};
            }));
            this._pendingSends.splice.apply(this._pendingSends, args);
        }

        this._sending = false;
        this.emit('sendAttempt');

        callbacks.forEach(function(callback) {
            try {
                callback(err);
            } catch (exc) {
                debug('callback raised error', exc);
            }
        });
    }.bind(this);

    MessageParser.composeAsJSON(messages, function(err, json) {
        if (err) {
            return done(err);
        }

        if (!this.connection) {
            // We lost the connection during the parsing
            return done(new Error('Lost connection during initial send'));
        }

        try {
            var str = JSON.stringify(json);
            this.connection.websocket.send(str);
        } catch (err) {
            return done(err);
        }

        done();
    }.bind(this));
};

WebsocketTransport.prototype._messageReceived = function(message) {
    if (message instanceof PingMessage) {

    }

    this.emit('message', message);
};
