module.exports = Client;

var _ = require('lodash');
var AbstractMessage = require('./message/abstract_message');
var AbstractTransport = require('./transport/abstract_transport');
var async = require('async');
var callbackOrEmitError = require('callback-or-emit-error');
var EventEmitter = require('events').EventEmitter;
var logger = require('./logger');
var maybeCallback = require('maybe-callback');
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
    this.transport = 
    this._nextMessageIndex = 1;
    this._partialSessionToken = this.session.token.substring(0, 8);
}

util.inherits(Client, EventEmitter);

Client.baseType = Client;

Client.isChildClass = function(cls) {
    if (!cls || !cls.baseType) {
        return false;
    }
    return cls.baseType === this.baseType;
};

Client.prototype._getNextMessageIndex = function() {
    return this._nextMessageIndex++;
};

Client.prototype._verboseLogWithMessage = function(str, message) {
    str = '<' + this._partialSessionToken + '> ' + str;
    var metadata = message.toJSON();
    metadata.sessionToken = this.session.token;
    logger.verbose(str, metadata);
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
            return callbackOrEmitError(this, callback, err);
        }

        this._verboseLogWithMessage('Sent message', message);
        maybeCallback(callback)();
    }.bind(this));
};

Client.prototype.sendAcceptSessionMessage = function(response, callback) {
    var message = new SessionCreateResponseMessage({
        index: this._getNextMessageIndex(),
        success: true, 
        sessionToken: this.session.token,
        response: response
    });
    this.sendMessage(message, callback);
};

Client.prototype.sendDenySessionMessage = function(response, callback) {
    var message = new SessionCreateResponseMessage({
        index: this._getNextMessageIndex(),
        success: false,
        response: response
    });
    this.sendMessage(message, callback);
};

Client.prototype.sendReplyMessage = function(options, callback) {
    var message;
    try {
        message = new ReplyMessage(_.extend(options, {
            index: this._getNextMessageIndex()
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
            index: this._getNextMessageIndex(),
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
        index: this._getNextMessageIndex(),
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

    this._verboseLogWithMessage('Received message', message);

    if (message instanceof ScopeFetchMessage) {
        // Trigger session request for scope
        return this.emit('scopeFetchMessage', message);
    } else if (message instanceof ScopeSyncMessage) {
        // Trigger persisting and sending out sync messages
        return this.emit('scopeSyncMessage', message);
    }

    // TODO: log error, unrecognized message
};
