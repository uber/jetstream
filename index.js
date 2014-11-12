var _ = require('lodash');
var ModelObject = require('./lib/model_object');
var Scope = require('./lib/scope');
var Server = require('./lib/server');

// Framework server constructor helper
module.exports = function(options) {
    var server = new Server(options);
    server.start();
    return server;
}

module.exports = _.extend(module.exports, {
    // Framework methods
    model: function(name, definition) {
        return ModelObject.model(name, definition);
    },

    scope: function(options) {
        return new Scope(options);
    },

    // Classes
    middleware: {
        persist: {
            Memory: require('./lib/middleware/persist/memory_persist_middleware')
        },
        Storage: require('./lib/middleware/storage/storage_middleware')
    },

    transport: {
        WebsocketTransport: require('./lib/transport/websocket_transport'),
        SyntheticTransport: require('./lib/transport/synthetic_transport'),
        SyntheticConnection: require('./lib/transport/synthetic_connection')
    },

    ModelObject: ModelObject,
    Scope: Scope,

    // Shared instances
    logger: require('./lib/logger')
});
