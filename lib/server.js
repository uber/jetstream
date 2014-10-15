module.exports = Server;

var bodyParser = require('body-parser');
var EventEmitter = require('events').EventEmitter;
var express = require('express');
var logger = require('./logger');
var robb = require('robb/src/robb');
var Session = require('./session');
var SessionCreateMessage = require('./message/session_create_message');
var util = require('util');
var WebsocketTransport = require('./transport/websocket_transport');

function Server(options) {
    options = options || {};

    if (options.transports !== undefined && !(options.transports instanceof Array)) {
        throw new Error('Invalid transports specified');
    }

    if (!options.transports) {
        if (robb.isInt(options.port)) {
            options.transports = Server.getDefaultTransports(options.port);
        } else {
            options.transports = Server.getDefaultTransports();
        }
    }

    this.transports = options.transports;
    this.listeners = [];
}

util.inherits(Server, EventEmitter);

Server.getDefaultTransports = function(port) {
    if (!port) {
        var defaultPortKey = '--jetstream-default-port=';
        process.argv.forEach(function(arg) {
            if (arg.length > defaultPortKey.length) {
                var prefix = arg.substring(0, defaultPortKey.length);
                if (prefix === defaultPortKey) {
                    var value = parseInt(arg.substring(defaultPortKey.length));
                    if (!isNaN(value) && value > 0) {
                        port = value;
                    }
                }
            }
        });
    }

    port = port || 3000;
    var app = express();
    app.use(bodyParser.json());
    app.server = app.listen(port);
    return [
        WebsocketTransport.configure({server: app.server})
    ];
};

Server.prototype.start = function() {
    logger.info('Starting server');

    this.transports.forEach(function(transport) {
        var listener = transport.listen();
        listener.on('connection', this._onConnection.bind(this));
        this.listeners.push(listener);

        var log = {transport: transport.transportName};
        try {
            log.address = listener.app.server.address();
        } catch (err) { }
        try {
            log.address = listener.server.options.server.address();
        } catch (err) { }
        logger.info('Listening with transport', log);
    }.bind(this));
};

Server.prototype._onConnection = function(connection) {
    this.emit('connection', connection);

    // If the connection was accepted listen for messages
    if (connection.accepted) {
        var messageListener;
        messageListener = function(message, connection) {
            this._onMessage(messageListener, message, connection);
        }.bind(this);

        connection.on('message', messageListener);
    }
};

Server.prototype._onMessage = function(messageListener, message, connection) {
    if (message instanceof SessionCreateMessage) {
        var session = new Session({params: message.params});

        session.once('accept', function(session, client, response) {
            connection.startSession(session, client, response);
        });

        session.once('deny', function(session, client, response) {
            connection.denySession(session, client, response);
        });

        this.emit('session', session, session.params);

        if (session.accepted && !session.explictlyAccepted) {
            session.accept();
        }

        // Can unsubscribe from this connection's messages
        connection.removeListener('message', messageListener);
    }
};
