Jetstream for Node is a server that brokers syncing Jetstream models over the Jetstream Sync protocol. Out of the box it has a single Websocket transport adapter with the ability to add custom transport adapters.

## Features

- [x] Synchronize a shared set of models between many clients
- [x] Client and server message acknowledgement and resend capabilities
- [ ] Transactional application of changesets
- [ ] Synchronize and validate changesets with downstream services
- [ ] Access control capabilities
- [x] Modular architecture
- [x] Comprehensive Unit Test Coverage
- [x] Complete Documentation

## Communication

- If you **found a bug**, fix it and submit a pull request, or open an issue.
- If you **have a feature request**, implement it and submit a pull request or open an issue.
- If you **want to contribute**, submit a pull request.

## Installation

`npm install jetstream`

## Run demo

`npm start`

## Tests

`npm test`

# Usage

### Creating models

Jetstream works with two basic concepts: All your model objects extend from the superclass `ModelObject` and one of your ModelObject instances will be the root for your model tree encapsulated by a `Scope`.

Let's model a canvas of shapes:

```js
var jetstream = require('jetstream');

var Shape = jetstream.model('Shape', function() {
    this.has('x', Number);
    this.has('y', Number);
    this.has('width', Number);
    this.has('height', Number);
    this.has('type', Number);
});

var Canvas = jetstream.model('Canvas', function() {
    this.has('name', String);
    this.has('shapes', [Shape]);
});
```

Supported types are `String`, `Number`, `Boolean`, `Date`, `ModelObject` and `[ModelObject]`

### Creating a server

```js
// Example of connecting multiple clients to a shared scope
var scope = new jetstream.Scope({name: 'ShapesDemo'});
var canvas = new Canvas();
canvas.name = 'Shapes Demo';
canvas.setScopeAndMakeRootModel(scope);

// Start server with just Websocket transport on port 3000
var server = jetstream({
    transports: [
        jetstream.transport.WebsocketTransport.configure({port: 3000})
    ]
});
server.on('session', function(session) {
    session.on('fetch', function(fetch) {
        if (fetch.name === scope.name) {
            fetch.accept(scope);
        } else {
            fetch.deny('no such scope');
        }
    });
});
```

# Protocol

## Messages

The following message types and comprise the sync protocol language:
- SessionCreate: Create a session with a set of arguments
- SessionCreateResponse: Accept or deny a client session
- ScopeFetch: Fetch an a ModelObject graph with a given scope
- ScopeState: The full state of a fetched scope 
- ScopeSync: A set of updates for objects in a scope
- Reply: A reply to a message issued by a party with a response

## SyncFragment

ScopeState and ScopeSync messages contain SyncFragments. A SyncFragment describes an add, change, or removal of an object.

A SyncFragment has the following fields:
- Type: one of “add”, “change”, “remove”, “movechange”
- UUID: universal ID that identifies the ModelObject
- Class name: the class name of the ModelObject
- Properties: a key-value dictionary of property values for use with “add”, “change” and “movechange”

# License

Jetstream is released under the MIT license. See LICENSE for details.

