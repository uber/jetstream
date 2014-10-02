var _ = require('underscore');
var debug = require('debug');

// Import limited set of winston for browserify support
var winston = {};
winston.config = {npm: require('winston/lib/winston/config/npm-config')};
winston.Logger = require('winston/lib/winston/logger').Logger;
winston.transports = {Console: require('winston/lib/winston/transports/console').Console};

var config = _.extend(winston.config.npm, {});
config.levels.silent = _.max(_.values(winston.config.npm.levels)) + 1;

var logger = new winston.Logger({
    levels: config.levels,
    transports: [
        new winston.transports.Console({level: 'silent'})
    ]
});

logger.setLevel = function(level) {
    logger.transports.console.level = level;
};

logger.debug = function (componentName, message, params) {
    if (typeof componentName !== 'string') {
        throw new Error('Expected first arg to be component name');
    }
    if (arguments.length < 2) {
        throw new Error('Expected at least two args, componentName and message');
    }
    if (params && typeof params !== 'object') {
        throw new Error('Expected params to be object');
    }

    if (!params) {
        debug('jetstream:' + componentName)(message);
    } else {
        debug('jetstream:' + componentName)(message + ' %o', params);
    }
    if (!params) {
        logger.log('debug', '[' + componentName + '] ' + message);
    } else {
        logger.log('debug', '[' + componentName + '] ' + message, params);
    }
};

var _log = logger.log;
logger.log = function() {
    var args = Array.prototype.slice.call(arguments, 0);
    if (args.length >= 3) {
        var params = args[2];
        if (params && params instanceof Error) {
            Object.defineProperty(params, 'message', {enumerable: true});
        } else if (params && params.error instanceof Error) {
            Object.defineProperty(params.error, 'message', {enumerable: true});
        }
    }
    _log.apply(logger, args);
};

module.exports = logger;
