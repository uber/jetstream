module.exports = ParentRelationship;

var ModelObject = require('./model_object');

function ParentRelationship(options) {
    options = options || {};

    if (!(options.parent instanceof ModelObject)) {
        throw new Error('Requires parent');
    }

    if (typeof options.keyPath !== 'string') {
        throw new Error('Requires keyPath');
    }

    this.parent = options.parent;
    this.keyPath = options.keyPath;
}
