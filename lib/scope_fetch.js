var Class = require('uberclass-clouseau');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

util.inherits(Class, EventEmitter);

var ScopeFetch = Class.extend({
    init: function(options) {
        options = options || {};

        if (typeof options.name !== 'string') {
            throw new Error('Invalid name');
        }

        this.options = options;
        this.name = options.name;
        this.params = options.params || {};
        this.accepted = false;
        this.explictlyDenied = false;
        delete this.options.name;
        delete this.options.params;
    },

    accept: function(scope) {
        this.accepted = true;
        this.emit('accept', scope);
    },

    deny: function(error) {
        this.accepted = false;
        this.explictlyDenied = true;
        if (typeof error === 'string') {
            error = new Error(error);
        }
        this.emit('deny', error);
        return error;
    }
});

module.exports = ScopeFetch;
