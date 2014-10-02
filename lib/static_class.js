var _ = require('underscore');
var Class = require('uberclass-clouseau');

var StaticClass = Class.extend({
    withBaseType: function(baseTypeCallback, staticType) {
        if (typeof baseTypeCallback !== 'function') {
            throw new Error('Invalid baseTypeCallback');
        }
        if (staticType && typeof staticType !== 'object') {
            throw new Error('Invalid staticType');
        }
        staticType = staticType || {};
        return _.extend(staticType, {
            defaults: _.extend(staticType.defaults || {}, {
                baseType: baseTypeCallback
            }),

            isChildClass: function(cls) {
                if (!cls || !cls.defaults) {
                    return false;
                }
                if (typeof cls.defaults.baseType !== 'function') {
                    return false;
                }
                if (cls.defaults.baseType() !== this.defaults.baseType()) {
                    return false;
                }
                return true;
            }
        });
    }
}, {});

module.exports = StaticClass;
