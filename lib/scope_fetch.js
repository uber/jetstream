module.exports = ScopeFetch;

var EventEmitter = require('events').EventEmitter;
var util = require('util');

function ScopeFetch(options) {
    options = options || {};

    if (typeof options.name !== 'string') {
        throw new Error('Invalid name');
    }

    this.name = options.name;
    this.params = options.params || {};
    this.accepted = false;
    this.explictlyDenied = false;
}

util.inherits(ScopeFetch, EventEmitter);

ScopeFetch.prototype.accept = function(scope) {
    this.accepted = true;
    this.emit('accept', scope);
};

ScopeFetch.prototype.deny = function(error) {
    this.accepted = false;
    this.explictlyDenied = true;
    if (typeof error === 'string') {
        error = new Error(error);
    }
    this.emit('deny', error);
    return error;
};
