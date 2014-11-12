var AbstractNetworkMessage = require('../../lib/message/abstract_network_message');
var createTestContext = require('../test/test_context');
var test = require('cached-tape');
var util = require('util');

var context = createTestContext('AbstractNetworkMessage');
var describe = context.describe;
var method = context.method;
var property = context.property;

function TestMessage() {
    AbstractNetworkMessage.apply(this, arguments);
}
util.inherits(TestMessage, AbstractNetworkMessage);
TestMessage.type = 'Test';

describe(property('type'), function(thing) {

    test(thing('should match its message type'), function t(assert) {
        assert.equal(AbstractNetworkMessage.type, 'Abstract');
        assert.end();
    });

});

describe(method('constructor'), function(thing) {

    test(thing('should throw if given invalid index'), function t(assert) {
        var message;
        assert.throws(function() {
            message = new AbstractNetworkMessage({index: 'str'});    
        }, /requires to be reliably sent/);

        assert.end();
    });

    test(thing('should be able to set a replyCallback'), function t(assert) {
        var replyCallback = function(){};
        var message = new AbstractNetworkMessage({
            index: 0, 
            replyCallback: replyCallback
        });

        assert.equal(message.replyCallback, replyCallback);
        assert.end();
    });

});

describe(method('toJSON'), function(thing) {

    test(thing('should throw when called for an AbstractNetworkMessage'), function t(assert) {
        var message = new AbstractNetworkMessage({index: 0});

        assert.throws(function() { 
            message.toJSON(); 
        }, /Cannot call/);

        assert.end();
    });

    test(thing('should include index of message if set'), function t(assert) {
        var message = new TestMessage({index: 1});
        assert.equal(message.toJSON().index, 1);

        assert.end();
    });

});
