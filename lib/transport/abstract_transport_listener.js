var Class = require('uberclass-clouseau');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

util.inherits(Class, EventEmitter);

var AbstractTransportListener = Class.extend({ }, { });

module.exports = AbstractTransportListener;
