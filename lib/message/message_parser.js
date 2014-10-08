var AbstractMessage = require('./abstract_message');
var async = require('async');
var Class = require('uberclass-clouseau');
var JSONReader = require('../json_reader');
var ReplyMessage = require('./reply_message');
var ScopeFetchMessage = require('./scope_fetch_message');
var ScopeStateMessage = require('./scope_state_message');
var ScopeSyncMessage = require('./scope_sync_message');
var SessionCreateMessage = require('./session_create_message');
var SessionCreateResponseMessage = require('./session_create_response_message');

var MessageParser = Class.extend({
    parseAsRaw: function(input, callback) {
        JSONReader.read(input, function (err, json) {
            if (err) {
                return callback(err);
            }
            MessageParser.parseAsJSON(json, callback);
        });
    },

    parseAsJSON: function(json, callback) {
        if (!json) {
            return callback(new Error('No message(s) to parse'));
        }
        if (json instanceof Array) {
            return async.map(json, MessageParser.parseAsJSON, function(err, results) {
                if (err) {
                    return callback(err);
                }
                callback(null, results);
            });
        }
        switch (json.type) {
            case ReplyMessage.type:
                ReplyMessage.parseAsJSON(json, callback);
                break;
            case SessionCreateMessage.type:
                SessionCreateMessage.parseAsJSON(json, callback);
                break;
            case SessionCreateResponseMessage.type:
                SessionCreateResponseMessage.parseAsJSON(json, callback);
                break;
            case ScopeFetchMessage.type:
                ScopeFetchMessage.parseAsJSON(json, callback);
                break;
            case ScopeStateMessage.type:
                ScopeStateMessage.parseAsJSON(json, callback);
                break;
            case ScopeSyncMessage.type:
                ScopeSyncMessage.parseAsJSON(json, callback);
                break;
            default:
                return callback(new Error('Unrecognized message type'));
        }
    },

    composeAsJSON: function(input, callback) {
        if (!input) {
            return callback(new Error('No message(s) to compose'));
        }
        if (input instanceof Array) {
            return async.map(input, MessageParser.composeAsJSON, function(err, results) {
                if (err) {
                    return callback(err);
                }
                callback(null, results);
            });
        }
        if (!(input instanceof AbstractMessage)) {
            return callback(new Error('Invalid input, not message(s)'));
        }
        var json;
        try {
            json = input.toJSON();
        } catch (err) {
            return callback(err);
        }
        callback(null, json);
    }
}, {});

module.exports = MessageParser;
