var _ = require('lodash');
var debug = require('debug');
var winston = require('winston');

var config = {};
config.levels = {
    debug: 1,
    trace: 2,
    info: 3,
    warn: 4,
    error: 5,
    silent: 6
};
var usedLevels = Object.keys(config.levels);
usedLevels.splice(usedLevels.indexOf('silent'), 1);

config.colors = {
    debug: 'blue',
    trace: 'cyan',
    info: 'green',
    warn: 'yellow',
    error: 'red'
};

var logger = new winston.Logger({
    levels: config.levels,
    transports: [
        new winston.transports.Console({level: 'silent'})
    ]
});
winston.addColors(config.colors);
var _logger = logger;
var _debug = logger.debug;
var _log = logger.log;

logger.setLevel = function(level) {
    logger.transports.console.level = level;
};

logger.replaceLogger = function(loggerInstance) {
    usedLevels.forEach(function(level) {
        if (typeof loggerInstance[level] !== 'function') {
            throw new Error('Log method \'' + level + '\' not a function');
        }
    });
    _logger = loggerInstance;
    usedLevels.forEach(function(level) {
        logger[level] = loggerInstance[level];
    });
    _debug = loggerInstance.debug;
    if (loggerInstance.log) {
        _log = loggerInstance.log;
    } else {
        _log = loggerInstance.info;
    }
};

logger.replaceLog = function(logMethod) {
    if (typeof logMethod === 'function') {
        _log = logMethod;
    } else {
        throw new Error('Log method not a function');
    }
};

var debugLogByComponent = {};
logger.debug = function (componentName, message) {
    if (typeof componentName !== 'string') {
        throw new Error('Expected first arg to be component name');
    }
    if (typeof message !== 'string') {
        throw new Error('Expected at least two args, componentName and message');
    }

    var debugLog = debugLogByComponent[componentName];
    if (!debugLog) {
        debugLog = debug('jetstream:' + componentName);
        debugLogByComponent[componentName] = debugLog;
    }

    if (arguments === 2) {
        debugLog(message);
        _debug.call(_logger, '[' + componentName + '] ' + message);
    } else {
        var args = Array.prototype.slice.call(arguments, 2);
        args.unshift(message);
        debugLog.apply(debugLog, args);

        args[0] = '[' + componentName + '] ' + args[0];
        _debug.apply(_logger, args);
    }
};

logger.log = function() {
    var args = Array.prototype.slice.call(arguments, 0);
    if (args.length >= 3) {
        var params = args[2];
        var err;
        if (params && params instanceof Error) {
            err = params;
        } else if (params && params.error instanceof Error) {
            err = params.error;
        }
        if (err) {
            Object.defineProperty(err, 'message', {enumerable: true});
            Object.defineProperty(err, 'stack', {enumerable: true});
        }
    }
    _log.apply(_logger, args);
};

module.exports = logger;
