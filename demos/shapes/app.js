var jetstream = require('../../');

// Verbose log output
jetstream.logger.setLevel('debug');

var Shape = jetstream.model('Shape', function() {
    this.has('x', Number);
    this.has('y', Number);
});

Shape.model('Square', function() {
    this.has('length', Number);
});

Shape.model('Circle', function() {
    this.has('radius', Number);
});

var ShapesDemo = jetstream.model('ShapesDemo', function() {
    this.has('shapes', Shape);
});

// Example of connecting multiple clients to a shared scope
var scope = new jetstream.Scope({name: 'ShapesDemo'});
var shapesDemo = new ShapesDemo();
shapesDemo.setScopeAndMakeRootModel(scope);

// Start server with default transports
var server = jetstream();
server.on('session', function(session) {
    session.on('fetch', function(fetch) {
        if (fetch.name === 'ShapesDemo') {
            fetch.accept(scope);
        } else {
            fetch.deny('no such scope');
        }
    });
});
