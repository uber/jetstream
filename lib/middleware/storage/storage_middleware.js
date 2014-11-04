module.exports = StorageMiddleware;

function StorageMiddleware(options) {
    options = options || {};

    if (typeof options.fetchRootModelObjectForScope !== 'function') {
        throw new Error('Requires fetchRootModelObjectForScope method');
    }

    if (typeof options.applySyncFragmentsForScope !== 'function') {
        throw new Error('Requires applySyncFragmentsForScope method');
    }

    this.fetchRootModelObjectForScope = options.fetchRootModelObjectForScope;
    this.applySyncFragmentsForScope = options.applySyncFragmentsForScope;
}
