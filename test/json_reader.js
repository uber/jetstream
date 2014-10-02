var _ = require('underscore');
var createContext = require('./lib/context');
var JSONReader = require('../lib/json_reader');
var test = require('cached-tape');

var context = createContext('JSONReader');
var describe = context.describe;
var method = context.method;

describe(method('read'), 'when reading JSON', function(thing) {

    test(thing('should read and parse JSON passed as Buffer'), function t(assert) {
        var json = {a: 1};
        var predicate = _.matches(json);
        var input = new Buffer(JSON.stringify(json));
        JSONReader.read(input, function(err, result) {
            assert.ifError(err);
            assert.equal(predicate(result), true);
            assert.end();
        });
    });

    test(thing('should read and parse JSON passed as string'), function t(assert) {
        var json = {a: 1};
        var predicate = _.matches(json);
        var input = JSON.stringify(json);
        JSONReader.read(input, function(err, result) {
            assert.ifError(err);
            assert.equal(predicate(result), true);
            assert.end();
        });
    });

    test(thing('should read and parse JSON passed as JSON'), function t(assert) {
        var json = {a: 1};
        var predicate = _.matches(json);
        JSONReader.read(json, function(err, result) {
            assert.ifError(err);
            assert.equal(predicate(result), true);
            assert.end();
        });
    });

    test(thing('should callback with error for non-JSON string'), function t(assert) {
        JSONReader.read('bah-humbug', function(err, result) {
            assert.ok(err);
            assert.notOk(result);
            assert.end();
        });
    });

    test(thing('should callback with error for no input'), function t(assert) {
        JSONReader.read(null, function(err, result) {
            assert.ok(err);
            assert.notOk(result);
            assert.end();
        });
    });

    test(thing('should callback with error for unrecognized input'), function t(assert) {
        JSONReader.read(123, function(err, result) {
            assert.ok(err);
            assert.notOk(result);
            assert.end();
        });
    });

});
