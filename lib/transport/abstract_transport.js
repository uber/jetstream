module.exports = AbstractTransport;

var _ = require('underscore');
var AbstractMessage = require('../message/abstract_message');
var callbackOrEmitError = require('callback-or-emit-error');
var Client = require('../client');
var EventEmitter = require('events').EventEmitter;
var logger = require('../logger');
var MessageParser = require('../message/message_parser');
var util = require('util');

var debug = logger.debug.bind(logger, 'transport:abstractTransport');

function AbstractTransport(options) {
    options = options || {};

    if (!(options.client instanceof Client)) {
        throw new Error('Invalid client specified');
    }

    this._pendingData = [];
}

util.inherits(AbstractTransport, EventEmitter);

AbstractTransport.transportName = 'AbstractTransport';

/**
 * Allows pre-configuration of a transport when passing the type
 *
 * @param options {Object}
 * @api public
 */ 
AbstractTransport.configure = function(options) {
    var currentListen = this.listen;
    this.listen = currentListen.bind(this, options);
    return this;
};

AbstractTransport.prototype.sendMessage = function(message, callback) {
    if (!(message instanceof AbstractMessage)) {
        return callbackOrEmitError(this, callback, new Error('Invalid message'));
    }
    this.transportMessage(message, callback);
};

AbstractTransport.prototype.transportMessage = function() {
    throw new Error('Not implemented');
};

AbstractTransport.prototype._getTransportName = function() {
    return Object.getPrototypeOf(this).constructor.transportName;
};

AbstractTransport.prototype._onData = function(data) {
    if (!data) {
        return;
    }

    // Protect against parseAsRaw returning out of order
    var entry = {data: data, result: null};
    this._pendingData.push(entry);

    MessageParser.parseAsRaw(data, function(err, result) {
        if (err) {
            debug('failed to parse incoming data', err, data);
            this._pendingData = _.without(this._pendingData, entry);
        } else {
            entry.result = result instanceof Array  ? result : [result];
        }

        while (this._pendingData.length && this._pendingData[0].result) {
            var completedResult = this._pendingData.shift().result;
            for (var i = 0; i < completedResult.length; i++) {
                this._messageReceived(completedResult[i]);
            }
        }
    }.bind(this));
};

/**
 * This is the spout for messages appearing on the transport.  To do 
 * any preprocessing before emitting override this method and emit the 
 * messages yourself.
 *
 * @param message {AbstractMessage}
 */
AbstractTransport.prototype._messageReceived = function(message) {
    this.emit('message', message);
};
