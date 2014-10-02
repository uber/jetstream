var Class = require('uberclass-clouseau');

var Errors = Class.extend({
    create: function(code, slug, message) {
        var error = new Error(message);
        error.code = code;
        error.slug = slug;
        error.toJSON = function() {
            var json = {};
            if (code) {
                json.code = code;
            }
            if (slug) {
                json.slug = slug;
            }
            if (message) {
                json.message = message;
            }
            return json;
        };
        return error;
    }
}, {});

Errors.REJECTED = Errors.create(
    1, 'rejected', 
    'Connection was rejected'
);

Errors.NO_VERSION_IDENTIFIER = Errors.create(
    2, 'no-version-identifier', 
    'A version identifier was not supplied'
);

Errors.CONNECTION_HANDSHAKE_UNRECOGNIZED = Errors.create(
    3, 'unrecognized-handshake',
    'Unrecognized handshake, should send SessionCreate message as first and only message'
);

Errors.CONNECTION_SESSION_TOKEN_UNRECOGNIZED = Errors.create(
    4, 'session-token-unrecognized',
    'Session token unrecognized'
);

Errors.CONNECTION_SESSION_ESTABLISH_TIMEDOUT = Errors.create(
    5, 'session-establish-timedout',
    'Session took long to establish and timed out'
);

Errors.SERVER_ERROR = Errors.create(
    6, 'server-error',
    'Internal server error'
);

Errors.SCOPE_NOT_FOUND = Errors.create(
    7, 'scope-not-found',
    'Scope not found'
);

Errors.COULD_NOT_APPLY_SYNC_MESSAGE = Errors.create(
    8, 'could-not-apply-sync-message',
    'Could not apply SyncMessage'
);

module.exports = Errors;
