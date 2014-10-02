var Class = require('uberclass-clouseau');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

util.inherits(Class, EventEmitter);

var AbstractConnection = Class.extend({
    init: function(options) {
        options = options || {};

        this.options = options;
        this.params = options.params || {};
        this.accepted = true;
        delete this.options.params;
    },

    accept: function() {
        this.emit('accept');
    },

    deny: function(error) {
        this.accepted = false;
        if (typeof error === 'string') {
            error = new Error(error);
        }
        this.emit('deny', error);
        return error;
    },

    startSession: function(session, client, response) {
        this.session = session;
        this.emit('session', this, session, client, response);
    },

    denySession: function(session, client, response) {
        this.emit('sessionDenied', this, session, client, response);
    }
});

module.exports = AbstractConnection;
