var Class = require('uberclass-clouseau');

var ParentRelationship = Class.extend({
    init: function(options) {
        this.options = options || {};

        if (typeof options.keyPath !== 'string') {
            throw new Error('Requires keyPath');
        }

        if (!options.parent) {
            throw new Error('Requires parent');
        }

        this.keyPath = options.keyPath;
        this.parent = options.parent;
        delete this.options.keyPath;
        delete this.options.parent;
    }
});

module.exports = ParentRelationship;
