var AbstractConnection = require('./abstract_connection');
var Errors = require('../errors');

var SyntheticTransportConnection = AbstractConnection.extend({
    init: function(options) {
        this._super(options);

        if (typeof options.payload !== 'string') {
            throw new Error('Invalid payload');
        }

        this.payload = options.payload;
        delete this.options.payload;
    }
});

module.exports = SyntheticTransportConnection;
