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

var createEnum = require('../').enumeration;
var createModel = require('../').model;

var ChatRoomStatus = createEnum('ChatRoomStatus', Number, {
    'Open': 0,
    'Closed': 1
});

var User = createModel('User', function() {
    this.has('username', String);
    this.has('color', Number);
    this.has('lastActive', Date);
});

var Message = createModel('Message', function() {
    this.has('author', User);
    this.has('postedAt', Date);
    this.has('text', String);
});

var ChatRoomAttributes = createModel('ChatRoomAttributes', function() {
    this.has('status', ChatRoomStatus);
    this.has('topic', String);
    this.has('tintColor', Number);
    this.has('locale', String);
});

var ChatRoom = createModel('ChatRoom', function() {
    this.has('name', String);
    this.has('attributes', ChatRoomAttributes);
    this.has('users', [User]);
    this.has('messages', [Message]);
});

module.exports = {
    User: User,
    Message: Message,
    ChatRoom: ChatRoom,
    ChatRoomAttributes: ChatRoomAttributes,
    ChatRoomStatus: ChatRoomStatus
};
