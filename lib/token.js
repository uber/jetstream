var Class = require('uberclass-clouseau');
var crypto = require('crypto');

var Token = Class.extend({
    create: function(callback) {
        crypto.randomBytes(64, function(err, buffer) {
            if (err) {
                return callback(err);
            }

            var base64 = buffer.toString('base64');
            var stripped = base64.replace(/[^0-9a-zA-Z]/g, '');

            callback(null, stripped);
        });
    }
}, { });

module.exports = Token;
