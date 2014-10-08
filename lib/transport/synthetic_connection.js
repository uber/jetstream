module.exports = SyntheticTransportConnection;

var AbstractConnection = require('./abstract_connection');
var Errors = require('../errors');
var util = require('util');

function SyntheticTransportConnection(options) {
    AbstractConnection.call(this, options);

    if (typeof options.payload !== 'string') {
        throw new Error('Invalid payload');
    }

    this.payload = options.payload;
}

util.inherits(SyntheticTransportConnection, AbstractConnection);
