var createTestContext = require('../test/test_context');
var MessageParser = require('../../lib/message/message_parser');
var ReplyMessage = require('../../lib/message/reply_message');
var SessionCreateMessage = require('../../lib/message/session_create_message');
var test = require('cached-tape');
var underscore = require('underscore');

var context = createTestContext('MessageParser');
var describe = context.describe;
var method = context.method;

describe(method('parseAsRaw'), 'when reading input', function(thing) {

    test(thing('should callback with error if reading fails'), function t(assert) {
        var input = 'bah-humbug';
        MessageParser.parseAsRaw(input, function(err, message) {
            assert.ok(err);
            assert.notOk(message);
            assert.end();
        });
    });

    test(thing('should parse a ReplyMessage as string'), function t(assert) {
        var input = '{"type": "Reply", "replyTo": 1, "index": 1}';
        MessageParser.parseAsRaw(input, function(err, message) {
            assert.ifError(err);
            assert.equal(message instanceof ReplyMessage, true);
            assert.end();
        });
    });

});

describe(method('parseAsJSON'), 'when reading JSON', function(thing) {

    test(thing('should parse a Reply message'), function t(assert) {
        var json = {type: 'Reply', replyTo: 0, index: 0};
        MessageParser.parseAsJSON(json, function(err, message) {
            assert.ifError(err);
            assert.equal(message instanceof ReplyMessage, true);
            assert.end();
        });
    });

    test(thing('should parse a SessionCreate message'), function t(assert) {
        var json = {
            type: 'SessionCreate',
            params: {},
            version: '1.0.0',
            index: 0
        };
        MessageParser.parseAsJSON(json, function(err, message) {
            assert.ifError(err);
            assert.equal(message instanceof SessionCreateMessage, true);
            assert.end();
        });
    });

    test(thing('should parse arrays of messages'), function t(assert) {
        var json = [
            {type: 'Reply', replyTo: 0, index: 0},
            {type: 'Reply', replyTo: 1, index: 1}
        ];
        MessageParser.parseAsJSON(json, function(err, messages) {
            assert.ifError(err);
            assert.equal(messages instanceof Array, true);
            assert.equal(messages.length, 2);
            messages.forEach(function(message) {
                assert.equal(message instanceof ReplyMessage, true);
            });        
            assert.end();
        });
    });

    test(thing('should callback with error for no input'), function t(assert) {
        MessageParser.parseAsJSON(null, function(err, message) {
            assert.ok(err);
            assert.notOk(message);
            assert.end();
        });
    });

    test(thing('should callback with error for invalid JSON'), function t(assert) {
        MessageParser.parseAsJSON('bah-humbug', function(err, message) {
            assert.ok(err);
            assert.notOk(message);
            assert.end();
        });
    });

    test(thing('should callback with error for unrecognized message'), function t(assert) {
        var json = {
            type: 'SomethingUnknown',
            someKey: 'someValue'
        };
        MessageParser.parseAsJSON(json, function(err, message) {
            assert.ok(err);
            assert.notOk(message);
            assert.end();
        });
    });

    test(thing('should callback with error for JSON array with non-objects'), function t(assert) {
        MessageParser.parseAsJSON(['bah-humbug'], function(err, message) {
            assert.ok(err);
            assert.notOk(message);
            assert.end();
        });
    });

    test(thing('should callback with error for JSON array with non-messages'), function t(assert) {
        MessageParser.parseAsJSON([{}], function(err, message) {
            assert.ok(err);
            assert.notOk(message);
            assert.end();
        });
    });

});

describe(method('composeAsJSON'), 'when creating JSON', function(thing) {

    test(thing('should be able to compose a Reply message'), function t(assert) {
        var message = new ReplyMessage({replyTo: 0, index: 0});
        MessageParser.composeAsJSON(message, function(err, json) {
            assert.ifError(err);
            assert.ok(json);
            assert.equal(json instanceof ReplyMessage, false);

            var predicate = underscore.matches(message.toJSON());
            assert.equal(predicate(json), true);

            assert.end();
        });
    });

    test(thing('should be able to compose arrays of messages'), function t(assert) {
        var messages = [
            new ReplyMessage({replyTo: 0, index: 0}),
            new ReplyMessage({replyTo: 1, index: 1})
        ];
        MessageParser.composeAsJSON(messages, function(err, json) {
            assert.ifError(err);
            assert.ok(json);
            assert.equal(json instanceof Array, true);

            messages.forEach(function (message, i) {
                assert.equal(message instanceof ReplyMessage, true);

                var predicate = underscore.matches(message.toJSON());
                assert.equal(predicate(json[i]), true);
            });

            assert.end();
        });
    });

    test(thing('should callback with error for no input'), function t(assert) {
        MessageParser.composeAsJSON(null, function(err, json) {
            assert.ok(err);
            assert.notOk(json);
            assert.end();
        });
    });

    test(thing('should callback with error for bad input'), function t(assert) {
        MessageParser.composeAsJSON('bah-humbug', function(err, json) {
            assert.ok(err);
            assert.notOk(json);
            assert.end();
        });
    });

    test(thing('should callback with error for array of bad input'), function t(assert) {
        MessageParser.composeAsJSON(['bah-humbug'], function(err, json) {
            assert.ok(err);
            assert.notOk(json);
            assert.end();
        });
    });

    test(thing('should callback with error when failing to JSONify message'), function t(assert) {
        var message = new ReplyMessage({replyTo: 0, index: 0});
        message.toJSON = function() {
            throw new Error('Mock error');
        };
        MessageParser.composeAsJSON(message, function(err, json) {
            assert.ok(err);
            assert.notOk(json);
            assert.end();
        });
    });

});
