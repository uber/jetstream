var AbstractMessage = require('../../lib/message/abstract_message');
var createContext = require('../lib/context');
var test = require('cached-tape');

var context = createContext('AbstractMessage');
var describe = context.describe;
var method = context.method;
var property = context.property;

var TestMessage = AbstractMessage.extend({
    type: 'Test'
}, { });

describe(property('type'), function(thing) {

    test(thing('should match its message type'), function t(assert) {
        assert.equal(AbstractMessage.type, 'Abstract');
        assert.end();
    });

});

describe(method('constructor'), function(thing) {

    test(thing('should only set index if index passed as int'), function t(assert) {
        var message;
        message = new AbstractMessage({index: 'a'});
        assert.equal(message.index, undefined);

        message = new AbstractMessage({index: null});
        assert.equal(message.index, undefined);

        message = new AbstractMessage({index: 1});
        assert.equal(message.index, 1);

        assert.end();
    });

});

describe(method('toJSON'), function(thing) {

    test(thing('should throw when called for an AbstractMessage'), function t(assert) {
        var message = new AbstractMessage();

        assert.throws(function() { message.toJSON(); }, /Cannot call/);

        assert.end();
    });

    test(thing('should include index of message if set'), function t(assert) {
        var message = new TestMessage({index: 1});
        assert.equal(message.toJSON().index, 1);

        assert.end();
    });

    test(thing('should not include index of message if not set'), function t(assert) {
        var message = new TestMessage();
        assert.equal(message.toJSON().index, undefined);

        assert.end();
    });

});
