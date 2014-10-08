var _ = require('underscore');
var ModelObject = require('./model_object');
var Server = require('./server');

// Framework server constructor helper
module.exports = function(options) {
    var server = new Server(options);
    server.start();
    return server;
};

module.exports = _.extend(module.exports, {
    // Framework methods
    model: function(name, definition) {
        return ModelObject.model(name, definition);
    },

    // Classes
    middleware: {
        persist: {
            Memory: require('./middleware/persist/memory_persist_middleware')
        }
    },

    transport: {
        WebsocketTransport: require('./transport/websocket_transport'),
        SyntheticTransport: require('./transport/synthetic_transport'),
        SyntheticConnection: require('./transport/synthetic_connection')
    },

    Scope: require('./scope'),

    // Shared instances
    logger: require('./logger')
});
