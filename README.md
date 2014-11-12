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
- For further details see `CONTRIBUTION.md`

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
var createModel = require('jetstream').model;

var Shape = createModel('Shape', function() {
    this.has('x', Number);
    this.has('y', Number);
    this.has('width', Number);
    this.has('height', Number);
    this.has('type', Number);
});

var Canvas = createModel('Canvas', function() {
    this.has('name', String);
    this.has('shapes', [Shape]);
});
```

Supported types are `String`, `Number`, `Boolean`, `Date`, `ModelObject` and `[ModelObject]`

### Creating a server

```js
var createScope = require('../../').scope;
var createServer = require('jetstream');
var createWebsocketTransport = require('jetstream').transport.WebsocketTransport.configure;
var Scope = require('../../').Scope;

// Example of connecting multiple clients to a shared scope
var canvas = new Canvas();
canvas.name = 'Shapes Demo';

var scope = createScope({name: 'Canvas'});
scope.setRoot(canvas);

// Start server with default transports
var server = createServer({
    transports: [createWebsocketTransport({port: 3000})]
});
server.on('session', function(session, params, callback) {
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
- Type: one of “add” or “change”
- UUID: universal ID that identifies the ModelObject, currently using UUID v4
- Class name: the class name of the ModelObject
- Properties: a key-value dictionary of property values

# License

Jetstream is released under the MIT license. See LICENSE for details.

