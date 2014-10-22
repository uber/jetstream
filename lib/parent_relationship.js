module.exports = ParentRelationship;

var ModelObject = require('./model_object');

function ParentRelationship(options) {
    options = options || {};

    if (!(options.parent instanceof ModelObject)) {
        throw new Error('Requires parent');
    }

    if (typeof options.key !== 'string') {
        throw new Error('Requires key');
    }

    this.parent = options.parent;
    this.key = options.key;
}
