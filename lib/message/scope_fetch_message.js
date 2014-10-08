var AbstractMessage = require('./abstract_message');

var ScopeFetchMessage = AbstractMessage.extend({
    type: 'ScopeFetch',

    parseAsJSON: function(json, callback) {
        if (!json || json.type !== this.type) {
            return callback(new Error('Message type was not \'' + this.type + '\''));
        }

        var message;

        try {
            message = new ScopeFetchMessage(json);
        } catch (err) {
            return callback(err);
        }
        
        callback(null, message);
    }
}, {
    init: function(options) {
        options = options || {};
        this._super(options);

        if (typeof options.name !== 'string') {
            throw new Error('Invalid name');
        }

        if (typeof this.index !== 'number') {
            throw new Error('ScopeFetchMessage requires to be reliably sent with an index');
        }

        this.name = options.name;
        this.params = options.params || {};
    },

    toJSON: function() {
        var json = this._super();
        json.name = this.name;
        json.params = this.params;
        return json;
    }
});

module.exports = ScopeFetchMessage;
