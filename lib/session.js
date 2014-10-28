module.exports = Session;

var _ = require('lodash');
var Client = require('./client');
var Errors = require('./errors');
var EventEmitter = require('events').EventEmitter;
var logger = require('./logger');
var Scope = require('./scope');
var ScopeFetch = require('./scope_fetch');
var Token = require('./token');
var util = require('util');
var uuid = require('node-uuid');

var CONST = {};
CONST.DEFAULT_INACTIVITY_EXPIRY_TIMEOUT = 10 * 60 * 1000;
CONST = Object.freeze(CONST);

function Session(options) {
    options = options || {};

    if (options.clientType) {
        this.setClientType(options.clientType);
    } else {
        this.clientType = null;
    }

    this.uuid = uuid.v4();
    this.client = null;
    this.token = null;
    this.params = options.params || {};
    this.accepted = true;
    this.explictlyAccepted = false;
    this._nextMessageIndex = 0;
    this._scopes = [];
    this._inactivityExpiryTimeout = null;
    this._inactivityExpiryTimeoutDuration = 
        options.inactivityExpiryTimeoutDuration ||
        CONST.DEFAULT_INACTIVITY_EXPIRY_TIMEOUT;
}

util.inherits(Session, EventEmitter);

Session.CONST = CONST;

Session.prototype.getNextMessageIndex = function() {
    return this._nextMessageIndex++;
};

Session.prototype.setClientType = function(clientType) {
    if (!Client.isChildClass(clientType)) {
        throw new Error('Invalid clientType');
    }
    this.clientType = clientType;
};

Session.prototype.accept = function(optionalResponse, clientType) {
    if (!clientType && Client.isChildClass(optionalResponse)) {
        clientType = optionalResponse;
        optionalResponse = null;
    }

    optionalResponse = optionalResponse || {};

    if (clientType) {
        this.setClientType(clientType);
    }

    this.accepted = true;
    this.explictlyAccepted = true;

    Token.create(function(err, token) {
        if (err) {
            // TODO: log an error
            return this.deny();
        }

        this.token = token;
        var ClientType = this.clientType || Client;
        this.client = new ClientType({token: token, session: this, params: this.params});
        this._bindClientEvents();
        this.emit('accept', this, this.client, optionalResponse);
        this._startInactivityExpiryTimeout();
    }.bind(this));
};

Session.prototype.deny = function(optionalResponse, clientType) {
    if (!clientType && Client.isChildClass(optionalResponse)) {
        clientType = optionalResponse;
        optionalResponse = null;
    }

    optionalResponse = optionalResponse || {};

    if (clientType) {
        this.setClientType(clientType);
    }

    this.accepted = false;
    this.explictlyAccepted = false;

    var ClientType = this.clientType || Client;
    var deniedClient = new ClientType({session: this, params: this.params});

    this.emit('deny', this, deniedClient, optionalResponse);
};

Session.prototype._bindClientEvents = function() {
    this.client.on('scopeFetchMessage', this._onScopeFetchMessage.bind(this));
    this.client.on('scopeSyncMessage', this._onScopeSyncMessage.bind(this));
    this.client.on('activity', this._onClientActivity.bind(this));
};

Session.prototype._onScopeFetchMessage = function(message) {
    var fetch = new ScopeFetch({
        name: message.name,
        params: message.params
    });

    fetch.once('accept', function(scope) {
        if (!(scope instanceof Scope)) {
            return fetch.deny(Errors.SERVER_ERROR);
        }

        this._addScope(scope);

        scope.on('changes', function(syncFragments, context) {
            var index = this._getScopeIndex(scope);
            if (index !== -1) {
                this._onScopeChanges(scope, index, syncFragments, context);
            }
        }.bind(this));

        var scopeIndex = this._getScopeIndex(scope);

        this.client.sendReplyMessage({
            replyTo: message.index,
            response: {
                result: true,
                scopeIndex: scopeIndex
            }
        });
        this.client.sendScopeStateMessage(scope, scopeIndex);
    }.bind(this));

    fetch.once('deny', function(err) {
        var response = {result: false};
        if (err) {
            response.error = {message: err.message};
            if (err.code) {
                response.error.code = err.code;
            }
            if (err.slug) {
                response.error.slug = err.slug;
            }
        }

        this.client.sendReplyMessage({
            replyTo: message.index,
            response: response
        });
    }.bind(this));
    
    this.emit('fetch', fetch);
};

Session.prototype._onScopeSyncMessage = function(message) {
    var scope = this._scopes[message.scopeIndex];

    if (!scope) {
        return this.client.sendReplyMessage({
            replyTo: message.index,
            response: {
                result: false,
                error: Errors.SCOPE_NOT_FOUND
            }
        });
    }

    var context = {client: this.client};
    scope.applySyncFragments(message.syncFragments, context, function(err, results) {
        if (err) {
            return this.client.sendReplyMessage({
                replyTo: message.index,
                response: {
                    result: false,
                    error: Errors.COULD_NOT_APPLY_SYNC_MESSAGE
                }
            });
        }

        // TODO: support additional fragments
        return this.client.sendReplyMessage({
            replyTo: message.index,
            response: {results: results}
        });
    }.bind(this));
};

Session.prototype._startInactivityExpiryTimeout = function() {
    this._inactivityExpiryTimeout = setTimeout(
        this._inactivityExpiryTimeoutFired.bind(this),
        this._inactivityExpiryTimeoutDuration);
};

Session.prototype._onClientActivity = function(message) {
    if (this._inactivityExpiryTimeout) {
        clearTimeout(this._inactivityExpiryTimeout);
    }
    this._startInactivityExpiryTimeout();
};

Session.prototype._inactivityExpiryTimeoutFired = function(message) {
    this.emit('expire');
    logger.trace('Session expired', {sessionToken: this.token});
};

Session.prototype._addScope = function(scope) {
    this._scopes.push(scope);
};

Session.prototype._removeScope = function(scope) {
    this._scopes = _.without(this._scopes, scope);
};

Session.prototype._getScopeIndex = function(scope) {
    return this._scopes.indexOf(scope);
};

Session.prototype._onScopeChanges = function(scope, scopeIndex, syncFragments, context) {
    if (context && context.client === this.client) {
        // Don't bother sending sync fragments to originating clients
        return;
    }

    this.client.sendScopeSyncMessage(scope, scopeIndex, syncFragments);
};
