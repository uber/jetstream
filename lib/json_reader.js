var Class = require('uberclass-clouseau');

var JSONReader = Class.extend({
    // Takes callback - possibly in future may support decompression
    read: function(input, callback) {        
        // Convert to string to try and parse first if only using raw input parser
        if (input instanceof Buffer) {
            input = input.toString();
        }

        if (!input) {
            return callback(new Error('Could not parse message input, missing input'));
        }

        // If using text parser will be string, otherwise it  
        // might already be JSON using a JSON input parser
        if (typeof input === 'string') {
            // Text, parse as json
            var json;
            try {
                json = JSON.parse(input);
            } catch (err) {
                return callback(new Error('Could not parse message input, input was not JSON'));
            }
            return callback(null, json);
        } else if (typeof input === 'object') {
            // Already JSON
            return callback(null, input);
        } else {
            return callback(new Error('Could not parse message input, unrecognized input'));
        }
    }
}, { });

module.exports = JSONReader;
