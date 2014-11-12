var createModel = require('../../').model;
var createScope = require('../../').scope;
var createServer = require('../../');
var createWebsocketTransport = require('../../').transport.WebsocketTransport.configure;
var jetstreamLogger = require('../../').logger;

// Turn on logging and set to "trace", by default it is set to "silent"
jetstreamLogger.setLevel('trace');

var Shape = createModel('Shape', function() {
    this.has('x', Number);
    this.has('y', Number);
    this.has('width', Number);
    this.has('height', Number);
    this.has('color', Number);
});

var Canvas = createModel('Canvas', function() { 
    this.has('name', String);
    this.has('shapes', [Shape]);
});

// Example of connecting multiple clients to a shared scope
var canvas = new Canvas();
canvas.name = 'Shapes Demo';

var scope = createScope({name: 'Canvas'});
scope.setRoot(canvas);

// Start server with default transports
var server = createServer({
    transports: [createWebsocketTransport({port: 3000})]
});
server.on('session', function(session, connection, params, callback) {
    // Accept the session, no authentication or authorization in this example
    callback();

    session.on('fetch', function(name, params, callback) {
        // Verify fetching the scope 
        if (name !== scope.name) {
            return callback(new Error('No such scope'));
        }
        callback(null, scope);
    });
});
