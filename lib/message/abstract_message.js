var Class = require('uberclass-clouseau');
var EventEmitter = require('events').EventEmitter;
var robb = require('robb/src/robb');
var util = require('util');

util.inherits(Class, EventEmitter);

var AbstractMessage = Class.extend({
    type: 'Abstract'
}, {
    init: function(options) {
        options = options || {};

        if (robb.isInt(options.index)) {
            this.index = options.index;
        }

        if (typeof options.replyCallback === 'function') {
            if (typeof this.index !== 'number') {
                throw new Error('Cannot specify replyCallback without message index');
            }
            this.replyCallback = options.replyCallback;
        }

        this.options = options;
        delete this.options.index;
    },

    toJSON: function() {
        var type = Object.getPrototypeOf(this).constructor.type;
        if (type === AbstractMessage.type) {
            throw new Error('Cannot call toJSON on an AbstractMessage');
        }
        var json = {type: type};
        if (typeof this.index === 'number') {
            json.index = this.index;
        }
        return json;
    }
});

module.exports = AbstractMessage;
