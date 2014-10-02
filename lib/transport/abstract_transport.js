var _ = require('underscore');
var AbstractMessage = require('../message/abstract_message');
var Class = require('uberclass-clouseau');
var Client = require('../client');
var EventEmitter = require('events').EventEmitter;
var logger = require('../logger');
var MessageParser = require('../message/message_parser');
var util = require('util');

util.inherits(Class, EventEmitter);

var AbstractTransport = Class.extend({
    transportName: 'AbstractTransport',

    // Allows pre-configuration of a transport when passing the type
    configure: function(options) {
        return this.extend({
            listen: function() {
                return this._super(options);
            }
        }, { });
    }
}, {
    init: function(options) {
        options = options || {};

        if (!(options.client instanceof Client)) {
            throw new Error('Invalid client specified');
        }

        this.options = options;
        this._pendingData = [];
        delete this.options.client;
    },

    _getTransportName: function() {
        return Object.getPrototypeOf(this).constructor.transportName;
    },

    _onData: function(data) {
        if (!data) {
            return;
        }

        // Protect against parseAsRaw returning out of order
        var entry = {data: data, result: null};
        this._pendingData.push(entry);

        MessageParser.parseAsRaw(data, function(err, result) {
            if (err) {
                logger.debug(this._getTransportName(), 'Failed to parse incoming data', {
                    error: err,
                    data: data
                });
                this._pendingData = _.without(this._pendingData, entry);
            } else {
                entry.result = result instanceof Array 
                    ? result
                    : [result];
            }

            while (this._pendingData.length && this._pendingData[0].result) {
                var completedResult = this._pendingData.shift().result;
                completedResult.forEach(function(message) {
                    this.emit('message', message);
                }.bind(this));
            }
        }.bind(this));
    },

    sendMessage: function(message, callback) {
        if (!(message instanceof AbstractMessage)) {
            throw new Error('Invalid message');
        }

        // TODO queue before transporting?
        this.transportMessage(message, callback);
    },

    transportMessage: function() {
        throw new Error('Not implemented');
    }
});

module.exports = AbstractTransport;
