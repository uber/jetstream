module.exports = SyntheticTransportListener;

var AbstractTransportListener = require('./abstract_transport_listener');
var Errors = require('../errors');
var logger = require('../logger');
var NetworkMessageParser = require('../message/network_message_parser');
var SessionCreateMessage = require('../message/session_create_message');
var SyntheticTransport = require('./synthetic_transport');
var util = require('util');

var debug = logger.debug.bind(logger, 'transport:syntheticListener');

function SyntheticTransportListener() {
    this.clientsBySessionToken = {};
}

util.inherits(SyntheticTransportListener, AbstractTransportListener);

/**
 * Handles an incoming connection.
 * 
 * @param {SyntheticConnection} connection The incoming connection.
 * @api public
 */ 
SyntheticTransportListener.prototype.incomingConnection = function(connection) {
    debug('received connection');

    var params = connection.params;
    if (!params.sessionToken) {
        // If no session token this must be first connection.
        debug('creating new session for connection');
        this._onNewSession(connection);
    } else {
        // Re-establish session
        debug('re-establishing existing session for connection');
        this._onResumeSession(connection, params.sessionToken);
    }
};

SyntheticTransportListener.prototype._onNewSession = function(connection) {
    this.emit('connection', connection);

    if (!connection.accepted) {
        // Middleware/application already denied this connection
        return;
    }

    // Must send SessionCreate as first and only message
    NetworkMessageParser.parseAsRaw(connection.payload, function (err, message) {
        if (err) {
            // TODO: log error
            return connection.deny(err);
        }

        if (message instanceof Array && message.length === 1) {
            message = message[0];
        }
        if (!(message instanceof SessionCreateMessage)) {
            // TODO: log error
            return connection.deny(Errors.CONNECTION_HANDSHAKE_UNRECOGNIZED);
        }

        connection.once('session', this._onAcceptNewSession.bind(this));
        connection.once('sessionDenied', this._onDenyNewSession.bind(this));
        connection.emit('message', message, connection);
    }.bind(this));
};

SyntheticTransportListener.prototype._onAcceptNewSession = function(connection, session, client, response) {
    this.clientsBySessionToken[session.token] = client;

    // Ensure when the session expires we remove it
    session.once('expire', this._onSessionExpire.bind(this, session));

    var transport = new SyntheticTransport({client: client, connection: connection});
    client.setTransport(transport);
    client.sendAcceptSessionMessage(response);
};

SyntheticTransportListener.prototype._onDenyNewSession = function(connection, session, client, response) {
    var transport = new SyntheticTransport({client: client, connection: connection});
    client.setTransport(transport);
    client.sendDenySessionMessage(response);
};

SyntheticTransportListener.prototype._onResumeSession = function(connection, sessionToken) {
    var client = this.clientsBySessionToken[sessionToken];

    if (!client) {
        // Bad token or session already expired
        return connection.deny(Errors.CONNECTION_SESSION_TOKEN_UNRECOGNIZED);
    }

    client.transport.resumeWithConnection(connection);
};

SyntheticTransportListener.prototype._onSessionExpire = function(session) {
    delete this.clientsBySessionToken[session.token];
};
