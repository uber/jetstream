module.exports = WebsocketTransportListener;

var AbstractTransportListener = require('./abstract_transport_listener');
var Errors = require('../errors');
var EventEmitter = require('events').EventEmitter;
var express = require('express');
var logger = require('../logger');
var MessageParser = require('../message/message_parser');
var querystring = require('querystring');
var robb = require('robb/src/robb');
var SessionCreateMessage = require('../message/session_create_message');
var util = require('util');
var WebsocketConnection = require('./websocket_connection');
var WebsocketTransport = require('./websocket_transport');
var ws = require('ws');

var debug = logger.debug.bind(logger, 'transport:websocketTransportListener');

var CONST = {};
CONST.DEFAULT_ESTABLISH_SESSION_TIMEOUT = 10000;
CONST.HEADER_PARAM_PREFIX               = 'x-jetstream-';


function WebsocketTransportListener(options) {
    options = options || {};

    if (!options.server && !options.port) {
        throw new Error('Requires server or port');
    } else if (options.server && options.port) {
        throw new Error('Can only specify server or port');
    } else if (options.server && !(options.server instanceof EventEmitter)) {
        throw new Error('Invalid server');
    } else if (options.port && !robb.isInt(options.port)) {
        throw new Error('Invalid port');
    }

    this.clientsBySessionToken = {};
    if (robb.isInt(options.establishSessionTimeout)) {
        this.establishSessionTimeout = options.establishSessionTimeout;
    } else {
        this.establishSessionTimeout = CONST.DEFAULT_ESTABLISH_SESSION_TIMEOUT;
    }

    if (options.server) {
        debug('constructed with server');
        this.server = new ws.Server({server: options.server});
    } else {
        debug('constructed with port', {port: options.port});
        var app = express();
        var server = app.listen(options.port);
        this.server = new ws.Server({server: server});
    }

    this._configure();
}

util.inherits(WebsocketTransportListener, AbstractTransportListener);

WebsocketTransportListener.CONST = CONST;

WebsocketTransportListener.prototype._configure = function() {
    this.server.on('connection', this._onConnection.bind(this));
    debug('configured connection handler');
};

WebsocketTransportListener.prototype._onConnection = function(websocket) {
    var params = {};
    var req = websocket.upgradeReq;

    // Extract params
    if (typeof req.headers === 'object') {
        this._paramsExtract(req.headers, params);
    }
    // Express will not parse the query string into 
    // req.query automagically for UPGRADE requests
    if (req.url && req.url.indexOf('?') !== -1) {
        var query = req.url.substring(req.url.indexOf('?')+1);
        var queryParams = querystring.parse(query);
        this._paramsExtract(queryParams, params);
    }

    var connection = new WebsocketConnection({
        params: params, 
        websocket: websocket
    });

    // if (typeof params.version !== 'string') {
    //     return connection.deny(Errors.NO_VERSION_IDENTIFIER);
    // }

    // TODO: validate version

    if (!params.sessiontoken) {
        // If no session token this must be first connection.
        this._onNewSession(connection);
    } else {
        // Re-establish session
        this._onResumeSession(connection, params.sessiontoken);
    }
};

WebsocketTransportListener.prototype._paramsExtract = function(object, params) {
    var minimumKeyLength = CONST.HEADER_PARAM_PREFIX.length;
    for (var key in object) {
        if (typeof key === 'string' && key.length > minimumKeyLength) {
            var prefix = key.substring(0, minimumKeyLength).toLowerCase();

            if (prefix === CONST.HEADER_PARAM_PREFIX) {
                var paramKey = key.substring(minimumKeyLength);
                params[paramKey] = object[key];
            }
        }
    }
};

WebsocketTransportListener.prototype._onNewSession = function(connection) {
    this.emit('connection', connection);

    if (!connection.accepted) {
        // Middleware/application already denied this connection
        return;
    }

    var timedOut = false;
    var timeout = null;

    connection.websocket.once('message', function(data) {
        if (timedOut) {
            return;
        }

        // Clear the timeout we started for this incoming connection 
        // to send their SessionCreate message
        clearTimeout(timeout);

        // Must send SessionCreate as first and only message
        MessageParser.parseAsRaw(data, function (err, message) {
            if (err) {
                debug('failed to parse new session payload', err);
                return connection.deny(err);
            }

            if (!(message instanceof SessionCreateMessage)) {
                debug('first message of new session was not session create');
                return connection.deny(Errors.CONNECTION_HANDSHAKE_UNRECOGNIZED);
            }

            connection.once('session', this._onAcceptNewSession.bind(this));
            connection.once('sessionDenied', this._onDenyNewSession.bind(this));
            connection.emit('message', message, connection);
        }.bind(this));
    }.bind(this));

    timeout = setTimeout(function() {
        debug('timed out establishing new session');
        timedOut = true;
        if (connection.websocket.readyState === ws.OPEN) {
            connection.deny(Errors.CONNECTION_SESSION_ESTABLISH_TIMEDOUT);
        }
    }.bind(this), this.establishSessionTimeout);
};

WebsocketTransportListener.prototype._onAcceptNewSession = function(connection, session, client, response) {
    this.clientsBySessionToken[session.token] = client;

    // Ensure when the client expires we remove it
    // client.once('expire', this._onClientExpire.bind(this));

    var transport = new WebsocketTransport({client: client, connection: connection});
    client.setTransport(transport);
    client.sendAcceptSessionMessage(response);
};

WebsocketTransportListener.prototype._onDenyNewSession = function(connection, session, client, response) {
    var transport = new WebsocketTransport({client: client, connection: connection});
    client.setTransport(transport);
    client.sendDenySessionMessage(response);
};

WebsocketTransportListener.prototype._onResumeSession = function(connection, sessionToken) {
    var client = this.clientsBySessionToken[sessionToken];

    if (!client) {
        // Bad token or session already expired
        return connection.deny(Errors.CONNECTION_SESSION_TOKEN_UNRECOGNIZED);
    }

    client.transport.resumeWithConnection(connection);
};

// TODO: expire the client and session
// _onClientExpire: function(client) {
    
// }
