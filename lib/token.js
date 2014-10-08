module.exports = Token;

var crypto = require('crypto');

function Token() {

}

Token.create = function(callback) {
    crypto.randomBytes(64, function(err, buffer) {
        if (err) {
            return callback(err);
        }

        var base64 = buffer.toString('base64');
        var stripped = base64.replace(/[^0-9a-zA-Z]/g, '');

        callback(null, stripped);
    });
};
