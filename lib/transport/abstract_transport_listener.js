module.exports = AbstractTransportListener;

var EventEmitter = require('events').EventEmitter;
var util = require('util');

function AbstractTransportListener() {

}

util.inherits(AbstractTransportListener, EventEmitter);
