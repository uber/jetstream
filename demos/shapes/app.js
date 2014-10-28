var jetstream = require('../../');

// Turn on logging and set to trace
jetstream.logger.setLevel('trace');

var Shape = jetstream.model('Shape', function() {
    this.has('x', Number);
    this.has('y', Number);
    this.has('width', Number);
    this.has('height', Number);
    this.has('color', Number);
});

var Canvas = jetstream.model('Canvas', function() { 
    this.has('name', String);
    this.has('shapes', [Shape]);
});

// Example of connecting multiple clients to a shared scope
var scope = new jetstream.Scope({name: 'ShapesDemo'});
var canvas = new Canvas();
canvas.name = 'Shapes Demo';
canvas.setScopeAndMakeRootModel(scope);

// Start server with default transports
var server = jetstream();
server.on('session', function(session) {
    session.on('fetch', function(fetch) {
        if (fetch.name === scope.name) {
            fetch.accept(scope);
        } else {
            fetch.deny('no such scope');
        }
    });
});
