// Copyright (c) 2015 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
'use strict';

var async = require('async');
var createTestChatRoom = require('../test/test_helpers').createTestChatRoom;
var createTestContext = require('../test/test_context');
var createTestMessage = require('../test/test_helpers').createTestMessage;
var createTestUser = require('../test/test_helpers').createTestUser;
var Scope = require('../../lib/scope');
var test = require('redtape')();
var uuid = require('uuid');

var context = createTestContext('PushQueryOperation');
var describe = context.describe;
var method = context.method;

describe(method('execute'), 'when executing updates', function(thing) {

    test(thing('should be able to perform simple push'), function t(assert) {
        var room = createTestChatRoom();

        var testAuthor = createTestUser();
        testAuthor.username = 'PushQueryTestUser';
        room.users = [testAuthor];

        // Set messages to contain just a single message first
        var testExistingMessage = createTestMessage();
        room.messages = [testExistingMessage];

        async.waterfall([
            function setRoot(nextCallback) {
                var scope = new Scope({name: 'ChatRoomScope'});
                scope.setRoot(room, function(err) {
                    nextCallback(err, scope);
                });
            },

            function executeUpdate(scope, nextCallback) {
                scope.update({}, {
                    $push: {
                        messages: {
                            $uuid: uuid.v4(),
                            author: testAuthor.uuid,
                            postedAt: new Date(),
                            text: 'A new message'
                        }
                    }
                }, nextCallback);
            },

            function verifyQueryResult(result, nextCallback) {
                assert.equal(room.messages.length, 2);

                assert.equal(room.messages.objectAtIndex(1).author, testAuthor);
                assert.equal(room.messages.objectAtIndex(1).postedAt instanceof Date, true);
                assert.equal(room.messages.objectAtIndex(1).text, 'A new message');

                assert.equal(result.matched.length, 1);
                assert.equal(result.matched[0].uuid, room.uuid);
                assert.equal(result.matched[0].clsName, room.typeName);

                assert.equal(result.created.length, 1);
                assert.equal(result.created[0].uuid, room.messages.objectAtIndex(1).uuid);
                assert.equal(result.created[0].clsName, 'Message');

                assert.equal(result.modified.length, 1);
                assert.equal(result.modified[0].uuid, room.uuid);
                assert.equal(result.modified[0].clsName, room.typeName);

                nextCallback();
            }

        ], function(err) {
            assert.ifError(err);
            assert.end();
        });
    });

    test(thing('should be able to push an existing ModelObject by just UUID'), function t(assert) {
        var room = createTestChatRoom();

        var testAuthor = createTestUser();
        testAuthor.username = 'PushQueryTestUser';
        room.users = [testAuthor];

        var testExistingMessage = createTestMessage();
        room.messages = [testExistingMessage];

        async.waterfall([
            function setRoot(nextCallback) {
                var scope = new Scope({name: 'ChatRoomScope'});
                scope.setRoot(room, function(err) {
                    nextCallback(err, scope);
                });
            },

            function executeUpdate(scope, nextCallback) {
                scope.update({}, {
                    $push: {
                        messages: testExistingMessage.uuid
                    }
                }, nextCallback);
            },

            function verifyQueryResult(result, nextCallback) {
                assert.equal(room.messages.length, 2);

                assert.equal(room.messages.objectAtIndex(0).uuid, testExistingMessage.uuid);
                assert.equal(room.messages.objectAtIndex(0).author, testExistingMessage.author);
                assert.equal(room.messages.objectAtIndex(0).text, testExistingMessage.text);

                assert.equal(room.messages.objectAtIndex(1).uuid, testExistingMessage.uuid);
                assert.equal(room.messages.objectAtIndex(1).author, testExistingMessage.author);
                assert.equal(room.messages.objectAtIndex(1).text, testExistingMessage.text);

                assert.equal(result.matched.length, 1);
                assert.equal(result.matched[0].uuid, room.uuid);
                assert.equal(result.matched[0].clsName, room.typeName);

                assert.equal(result.created.length, 0);

                assert.equal(result.modified.length, 1);
                assert.equal(result.modified[0].uuid, room.uuid);
                assert.equal(result.modified[0].clsName, room.typeName);

                nextCallback();
            }

        ], function(err) {
            assert.ifError(err);
            assert.end();
        });
    });

    test(thing('should be able to push an existing ModelObject and set properties'), function t(assert) {
        var room = createTestChatRoom();

        var testExistingMessage = createTestMessage();
        room.messages = [testExistingMessage];

        var testExistingMessageAuthor = testExistingMessage.author;

        async.waterfall([
            function setRoot(nextCallback) {
                var scope = new Scope({name: 'ChatRoomScope'});
                scope.setRoot(room, function(err) {
                    nextCallback(err, scope);
                });
            },

            function executeUpdate(scope, nextCallback) {
                scope.update({}, {
                    $push: {
                        messages: {
                            $uuid: testExistingMessage.uuid,
                            text: 'Overwrite message'
                        }
                    }
                }, nextCallback);
            },

            function verifyQueryResult(result, nextCallback) {
                assert.equal(room.messages.length, 2);

                assert.equal(room.messages.objectAtIndex(0).uuid, testExistingMessage.uuid);
                assert.equal(room.messages.objectAtIndex(0).author, testExistingMessageAuthor);
                assert.equal(room.messages.objectAtIndex(0).text, 'Overwrite message');

                assert.equal(room.messages.objectAtIndex(1).uuid, testExistingMessage.uuid);
                assert.equal(room.messages.objectAtIndex(1).author, testExistingMessageAuthor);
                assert.equal(room.messages.objectAtIndex(1).text, 'Overwrite message');

                assert.equal(result.matched.length, 1);
                assert.equal(result.matched[0].uuid, room.uuid);
                assert.equal(result.matched[0].clsName, room.typeName);

                assert.equal(result.created.length, 0);

                assert.equal(result.modified.length, 2);

                assert.equal(result.modified[0].uuid, room.uuid);
                assert.equal(result.modified[0].clsName, room.typeName);

                assert.equal(result.modified[1].uuid, testExistingMessage.uuid);
                assert.equal(result.modified[1].clsName, testExistingMessage.typeName);

                nextCallback();
            }

        ], function(err) {
            assert.ifError(err);
            assert.end();
        });
    });

});
