var _ = require('underscore');
var AbstractMessage = require('./message/abstract_message');
var async = require('async');
var Class = require('uberclass-clouseau');
var debug = require('debug')('jetstream:core:client');
var EventEmitter = require('events').EventEmitter;
var lazy = require('lazyrequire')(require);
var logger = require('./logger');
var maybeCallback = require('maybe-callback');
var ReplyMessage = require('./message/reply_message');
var Scope = require('./scope');
var ScopeFetchMessage = require('./message/scope_fetch_message');
var ScopeSyncMessage = require('./message/scope_sync_message');
var SessionCreateResponseMessage = require('./message/session_create_response_message');
var StaticClass = require('./static_class');
var util = require('util');

var AbstractTransport = null;
var Session = null;
var resolve = function() {
    AbstractTransport = lazy('./transport/abstract_transport')();
    Session = lazy('./session')();
};

util.inherits(Class, EventEmitter);

var Client = Class.extend(StaticClass.withBaseType(function() {
    return Client;
}), {
    init: function(options) {
        resolve();
        options = options || {};

        if (!(options.session instanceof Session)) {
            throw new Error('Invalid session');
        }

        this.options = options;
        this.session = options.session;
        this._nextMessageIndex = 1;
        this._partialSessionToken = this.session.token.substring(0, 8);
        delete this.options.session;
    },

    _getNextMessageIndex: function() {
        return this._nextMessageIndex++;
    },

    _verboseLogWithMessage: function(str, message) {
        str = '<' + this._partialSessionToken + '> ' + str;
        var metadata = message.toJSON();
        metadata.sessionToken = this.session.token;
        logger.verbose(str, metadata);
    },

    setTransport: function(transport) {
        if (!(transport instanceof AbstractTransport)) {
            throw new Error('Invalid transport');
        }

        transport.on('message', this._onMessage.bind(this));

        this.transport = transport;
    },

    sendMessage: function(message, callback) {
        this.transport.sendMessage(message, function(err) {
            if (!err) {
                this._verboseLogWithMessage('Sent message', message);
            }
            return maybeCallback(callback).apply(null, arguments);
        }.bind(this));
    },

    sendAcceptSessionMessage: function(response, callback) {
        var options = {
            success: true, 
            sessionToken: this.session.token,
            response: response
        };
        var message = new SessionCreateResponseMessage(options);
        this.sendMessage(message, callback);
    },

    sendDenySessionMessage: function(response, callback) {
        var options = {success: false, response: response};
        var message = new SessionCreateResponseMessage(options);
        this.sendMessage(message, callback);
    },

    sendReplyMessage: function(options, callback) {
        var message;
        try {
            message = new ReplyMessage(_.extend(options, {
                index: this._getNextMessageIndex()
            }));
        } catch (err) {
            debug('error creating ReplyMessage', err);
            return maybeCallback(callback)(err);
        }

        this.sendMessage(message, callback);
    },

    sendFullStateSyncMessage: function(scope, scopeIndex, callback) {
        if (!(scope instanceof Scope)) {
            var err = new Error('Invalid scope');
            logger.error('Client cannot send full sync message for invalid scope', {
                error: err
            });
            return maybeCallback(callback)(err);
        }

        if (typeof scopeIndex !== 'number') {
            var err = new Error('Invalid scopeIndex');
            logger.error('Client cannot send full sync message for scope without scopeIndex', {
                error: err
            });
            return maybeCallback(callback)(err);
        }

        async.waterfall([
            function getModelObjects(nextCallback) {
                scope.getAllModelObjects(nextCallback);
            },

            function getSyncFragments(modelObjects, nextCallback) {
                // TODO: sliced map to avoid blocking CPU
                async.map(modelObjects, function(modelObject, doneCallback) {
                    modelObject.getAddSyncFragment(doneCallback);
                }, nextCallback);
            }

        ], function(err, syncFragments) {
            if (err) {
                logger.error('Failed to send full scope sync message', {
                    error: err
                });
                return maybeCallback(callback)(err);
            }

            var message = new ScopeSyncMessage({
                index: this._getNextMessageIndex(),
                scopeIndex: scopeIndex,
                fullState: true,
                syncFragments: syncFragments
            });
            this.sendMessage(message, callback);
        }.bind(this));
    },

    sendScopeSyncMessage: function(scope, scopeIndex, syncFragments, callback) {
        if (!(scope instanceof Scope)) {
            var err = new Error('Invalid scope');
            logger.error('Client cannot send sync message for invalid scope', {
                error: err
            });
            return maybeCallback(callback)(err);
        }

        if (typeof scopeIndex !== 'number') {
            var err = new Error('Invalid scopeIndex');
            logger.error('Client cannot send sync message for scope without scopeIndex', {
                error: err
            });
            return maybeCallback(callback)(err);
        }

        this.sendMessage(new ScopeSyncMessage({
            index: this._getNextMessageIndex(),
            scopeIndex: scopeIndex,
            syncFragments: syncFragments
        }), callback);
    },

    _onMessage: function(message) {
        if (!(message instanceof AbstractMessage)) {
            return logger.error('Client received invalid message', {
                error: new Error('Invalid message')
            });
        }

        this._verboseLogWithMessage('Received message', message);

        if (message instanceof ScopeFetchMessage) {
            // Trigger session request for scope
            return this.emit('scopeFetchMessage', message);
        } else if (message instanceof ScopeSyncMessage) {
            // Trigger persisting and sending out sync messages
            return this.emit('scopeSyncMessage', message);
        }

        // TODO log error, unrecognized message
    }
});

module.exports = Client;
