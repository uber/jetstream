
module.exports = createTestContext;

function createTestContext(componentName) {
    return {
        component: component,
        method: method,
        property: method,
        describe: describe
    };

    function component(description, noSpace) {
        return componentName + (noSpace ? '' : ' ') + description;
    }

    function method(name) {
        return component('.' + name, true) + ' ';
    }
    
    function describe(description, context, fn) {
        fn = typeof context === 'function' ? context : fn;
        fn(function(text) { 
            var hasContext = typeof context === 'string';
            var descriptionContext = hasContext ? context + ' ' : '';
            return description + descriptionContext + text; 
        });
    }
}
