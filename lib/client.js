module.exports = Client;

var _ = require('lodash');
var AbstractMessage = require('./message/abstract_message');
var AbstractTransport = require('./transport/abstract_transport');
var async = require('async');
var callbackOrEmitError = require('callback-or-emit-error');
var EventEmitter = require('events').EventEmitter;
var logger = require('./logger');
var maybeCallback = require('maybe-callback');
var PingMessage = require('./message/ping_message');
var ReplyMessage = require('./message/reply_message');
var Scope = require('./scope');
var ScopeFetchMessage = require('./message/scope_fetch_message');
var ScopeStateMessage = require('./message/scope_state_message');
var ScopeSyncMessage = require('./message/scope_sync_message');
var Session = require('./session');
var SessionCreateResponseMessage = require('./message/session_create_response_message');
var SyncFragment = require('./sync_fragment');
var util = require('util');

var debug = logger.debug.bind(logger, 'core:client');

function Client(options) {
    options = options || {};

    if (!(options.session instanceof Session)) {
        throw new Error('Invalid session');
    }

    this.session = options.session;
    this.transport = null;
    this._partialSessionToken = this.session.token.substring(0, 12);
    this._bindSessionEvents();
}

util.inherits(Client, EventEmitter);

Client.baseType = Client;

Client.isChildClass = function(cls) {
    if (!cls || !cls.baseType) {
        return false;
    }
    return cls.baseType === this.baseType;
};

Client.prototype._bindSessionEvents = function() {
    this.session.on('expire', this._onSessionExpire.bind(this));
};

Client.prototype._traceLogWithMessage = function(str, message) {
    str = '<' + this._partialSessionToken + '> ' + str;

    // Only perform toJSON when trace which actually be emitted, perform on toString
    var messageDescriber = function() {};
    messageDescriber.toString = function() {
        return JSON.stringify(message.toJSON());
    };
    logger.trace(str, {
        sessionToken: this.session.token,
        message: messageDescriber
    });
};

Client.prototype.setTransport = function(transport) {
    if (!(transport instanceof AbstractTransport)) {
        throw new Error('Invalid transport');
    }

    transport.on('message', this._onMessage.bind(this));

    this.transport = transport;
};

Client.prototype.sendMessage = function(message, callback) {
    this.transport.sendMessage(message, function(err) {
        if (err) {
            debug('Failed to send message due to error', err);
            return callbackOrEmitError(this, callback, err);
        }

        this._traceLogWithMessage('Sent message', message);
        maybeCallback(callback)();
    }.bind(this));
};

Client.prototype.sendAcceptSessionMessage = function(response, callback) {
    var message = new SessionCreateResponseMessage({
        index: this.session.getNextMessageIndex(),
        success: true, 
        sessionToken: this.session.token,
        response: response
    });
    this.sendMessage(message, callback);
};

Client.prototype.sendDenySessionMessage = function(response, callback) {
    var message = new SessionCreateResponseMessage({
        index: this.session.getNextMessageIndex(),
        success: false,
        response: response
    });
    this.sendMessage(message, callback);
};

Client.prototype.sendReplyMessage = function(options, callback) {
    var message;
    try {
        message = new ReplyMessage(_.extend(options, {
            index: this.session.getNextMessageIndex(),
        }));
    } catch (err) {
        debug('error creating ReplyMessage', err);
        return callbackOrEmitError(this, callback, err);
    }

    this.sendMessage(message, callback);
};

Client.prototype.sendScopeStateMessage = function(scope, scopeIndex, callback) {
    var err;
    if (!(scope instanceof Scope)) {
        err = new Error('Invalid scope');
        logger.error('Client cannot send full sync message for invalid scope', {
            error: err
        });
        return callbackOrEmitError(this, callback, err);
    }

    if (typeof scopeIndex !== 'number') {
        err = new Error('Invalid scopeIndex');
        logger.error('Client cannot send full sync message for scope without scopeIndex', {
            error: err
        });
        return callbackOrEmitError(this, callback, err);
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
            logger.error('Failed to send scope state message', {
                error: err
            });
            return callbackOrEmitError(this, callback, err);
        }

        if (syncFragments.length < 1) {
            err = new Error('syncFragments for state message is empty array');
            logger.error('Scope state message is empty', {
                error: err
            });
            return callbackOrEmitError(this, callback, err);
        }

        var rootFragment = syncFragments.shift();
        rootFragment.type = SyncFragment.CONST.TYPE_ROOT;

        var message = new ScopeStateMessage({
            index: this.session.getNextMessageIndex(),
            scopeIndex: scopeIndex,
            rootFragment: rootFragment,
            syncFragments: syncFragments
        });
        this.sendMessage(message, callback);
    }.bind(this));
};

Client.prototype.sendScopeSyncMessage = function(scope, scopeIndex, syncFragments, callback) {
    var err;
    if (!(scope instanceof Scope)) {
        err = new Error('Invalid scope');
        logger.error('Client cannot send sync message for invalid scope', {
            error: err
        });
        return callbackOrEmitError(this, callback, err);
    }

    if (typeof scopeIndex !== 'number') {
        err = new Error('Invalid scopeIndex');
        logger.error('Client cannot send sync message for scope without scopeIndex', {
            error: err
        });
        return callbackOrEmitError(this, callback, err);
    }

    var message = new ScopeSyncMessage({
        index: this.session.getNextMessageIndex(),
        scopeIndex: scopeIndex,
        syncFragments: syncFragments
    });
    this.sendMessage(message, callback);
};

Client.prototype._onMessage = function(message) {
    if (!(message instanceof AbstractMessage)) {
        return logger.error('Client received invalid message', {
            error: new Error('Invalid message')
        });
    }

    this.emit('activity');
    if (!(message instanceof PingMessage)) {
        this._traceLogWithMessage('Received message', message);
    }

    if (message instanceof ScopeFetchMessage) {
        // Trigger session request for scope
        return this.emit('scopeFetchMessage', message);
    } else if (message instanceof ScopeSyncMessage) {
        // Trigger persisting and sending out sync messages
        return this.emit('scopeSyncMessage', message);
    }
};

Client.prototype._onSessionExpire = function() {
    if (!this.transport) {
        return;
    }

    this.transport.close(function(err) {
        if (err) {
            logger.error('Failed to close up transport after client session expired', {
                error: err,
                sessionToken: this.session.token
            });
        }
    }.bind(this));
};
