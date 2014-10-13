module.exports = SyntheticTransport;

var _ = require('lodash');
var AbstractTransport = require('./abstract_transport');
var MessageParser = require('../message/message_parser');
var SyntheticTransportConnection = require('./synthetic_connection');
var SyntheticTransportListener = require('./synthetic_transport_listener');
var util = require('util');

function SyntheticTransport(options) {
    AbstractTransport.call(this, options);

    this.setConnection(options.connection);
    this._activePendingSendImmediate = null;
    this._pendingSends = [];
    this._sending = false;
}

util.inherits(SyntheticTransport, AbstractTransport);

SyntheticTransport.transportName = 'SyntheticTransport';

SyntheticTransport.activeListener = null;

SyntheticTransport.configure = AbstractTransport.configure.bind(SyntheticTransport);

SyntheticTransport.listen = function(options) {
    SyntheticTransport.activeListener = new SyntheticTransportListener(options);
    return SyntheticTransport.activeListener;
};

SyntheticTransport.onConnection = function(connection) {
    if (connection instanceof SyntheticTransportConnection) {
        if (SyntheticTransport.activeListener) {
            SyntheticTransport.activeListener.onConnection(connection);
        }
    }
};

SyntheticTransport.prototype.setConnection = function(connection) {
    if (!(connection instanceof SyntheticTransportConnection)) {
        throw new Error('Invalid connection');
    }

    this._onData(connection.payload);
    this.connection = connection;
};  

SyntheticTransport.prototype.transportMessage = function(message, callback) {
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

SyntheticTransport.prototype._transportAllPendingMessages = function() {
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
    var callbacks = _.filter(_.pluck(this._pendingSends, 'callback'), _.isFunction);
    var done = function() {
        this._sending = false;
        this.emit('sendAttempt');
    }.bind(this);

    MessageParser.composeAsJSON(messages, function(err, json) {
        if (!this.connection) {
            // We lost the connection during the parsing
            return done();
        }

        if (err) {
            callbacks.forEach(function(callback) {
                try {
                    callback(err);
                } catch(exc) {}
            });
            return done();
        }

        try {
            this.connection.emit('response', json);
            this._pendingSends = [];
        } catch (exc) {
            callbacks.forEach(function(callback) {
                try {
                    callback(err);
                } catch(innerExc) {}
            });
            return done();
        }

        callbacks.forEach(function(callback) {
            try {
                callback(null);
            } catch (exc) { }
        });

        done();
    }.bind(this));
};

SyntheticTransport.prototype.resumeWithConnection = function(connection) {
    // Setting connection will parse the payload of incoming messages
    this.setConnection(connection);
};
