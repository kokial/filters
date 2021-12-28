

(function () {
    'use strict';

    var DEFAULT_MAX_DEPTH = 6;
    var DEFAULT_ARRAY_MAX_LENGTH = 50;
    var seen; // Same variable used for all stringifications
    var iterator; // either forEachEnumerableOwnProperty, forEachEnumerableProperty or forEachProperty

    // iterates on enumerable own properties (default behavior)
    var forEachEnumerableOwnProperty = function (obj, callback) {
        for (var k in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, k)) callback(k);
        }
    };
    // iterates on enumerable properties
    var forEachEnumerableProperty = function (obj, callback) {
        for (var k in obj) callback(k);
    };
    // iterates on properties, even non enumerable and inherited ones
    // This is dangerous
    var forEachProperty = function (obj, callback, excluded) {
        if (obj == null) return;
        excluded = excluded || {};
        Object.getOwnPropertyNames(obj).forEach(function (k) {
            if (!excluded[k]) {
                callback(k);
                excluded[k] = true;
            }
        });
        forEachProperty(Object.getPrototypeOf(obj), callback, excluded);
    };

    Date.prototype.toPrunedJSON = Date.prototype.toJSON;
    String.prototype.toPrunedJSON = String.prototype.toJSON;

    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        meta = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"': '\\"',
            '\\': '\\\\'
        };

    function quote(string) {
        escapable.lastIndex = 0;
        return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string'
                ? c
                : '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
        }) + '"' : '"' + string + '"';
    }

    function str(key, holder, depthDecr, arrayMaxLength) {
        var i, k, v, length, partial, value = holder[key];
        if (value && typeof value === 'object' && typeof value.toPrunedJSON === 'function') {
            value = value.toPrunedJSON(key);
        }

        switch (typeof value) {
            case 'string':
                return quote(value);
            case 'number':
                return isFinite(value) ? String(value) : 'null';
            case 'boolean':
            case 'null':
                return String(value);
            case 'object':
                if (!value) {
                    return 'null';
                }
                if (depthDecr <= 0 || seen.indexOf(value) !== -1) {
                    return '"-pruned-"';
                }
                seen.push(value);
                partial = [];
                if (Object.prototype.toString.apply(value) === '[object Array]') {
                    length = Math.min(value.length, arrayMaxLength);
                    for (i = 0; i < length; i += 1) {
                        partial[i] = str(i, value, depthDecr - 1, arrayMaxLength) || 'null';
                    }
                    return '[' + partial.join(',') + ']';
                }
                iterator(value, function (k) {
                    try {
                        v = str(k, value, depthDecr - 1, arrayMaxLength);
                        if (v) partial.push(quote(k) + ':' + v);
                    } catch (e) {
                        // this try/catch due to forbidden accessors on some objects
                    }
                });
                return '{' + partial.join(',') + '}';
        }
    }

    JSON.prune = function (value, depthDecr, arrayMaxLength) {
        if (typeof depthDecr == "object") {
            var options = depthDecr;
            depthDecr = options.depthDecr;
            arrayMaxLength = options.arrayMaxLength;
            iterator = options.iterator || forEachEnumerableOwnProperty;
            if (options.allProperties) iterator = forEachProperty;
            else if (options.inheritedProperties) iterator = forEachEnumerableProperty
        } else {
            iterator = forEachEnumerableOwnProperty;
        }
        seen = [];
        depthDecr = depthDecr || DEFAULT_MAX_DEPTH;
        arrayMaxLength = arrayMaxLength || DEFAULT_ARRAY_MAX_LENGTH;
        return str('', { '': value }, depthDecr, arrayMaxLength);
    };

    JSON.prune.log = function () {
        console.log.apply(console, Array.prototype.slice.call(arguments).map(function (v) { return JSON.parse(JSON.prune(v)) }));
    }
    JSON.prune.forEachProperty = forEachProperty; // you might want to also assign it to Object.forEachProperty

}());



// function setConstant(source, property, value, stack) {
//     if (!property || !matchStackTrace(stack, new Error().stack)) {
//         return;
//     }

//     var emptyArr = noopArray();
//     var emptyObj = noopObject();
//     var constantValue;

//     if (value === 'undefined') {
//         constantValue = undefined;
//     } else if (value === 'false') {
//         constantValue = false;
//     } else if (value === 'true') {
//         constantValue = true;
//     } else if (value === 'null') {
//         constantValue = null;
//     } else if (value === 'emptyArr') {
//         constantValue = emptyArr;
//     } else if (value === 'emptyObj') {
//         constantValue = emptyObj;
//     } else if (value === 'noopFunc') {
//         constantValue = noopFunc;
//     } else if (value === 'trueFunc') {
//         constantValue = trueFunc;
//     } else if (value === 'falseFunc') {
//         constantValue = falseFunc;
//     } else if (/^\d+$/.test(value)) {
//         constantValue = parseFloat(value);

//         if (nativeIsNaN(constantValue)) {
//             return;
//         }

//         if (Math.abs(constantValue) > 0x7FFF) {
//             return;
//         }
//     } else if (value === '-1') {
//         constantValue = -1;
//     } else if (value === '') {
//         constantValue = '';
//     } else {
//         return;
//     }

//     var canceled = false;

//     var mustCancel = function mustCancel(value) {
//         if (canceled) {
//             return canceled;
//         }

//         canceled = value !== undefined && constantValue !== undefined && typeof value !== typeof constantValue;
//         return canceled;
//     };

//     var setChainPropAccess = function setChainPropAccess(owner, property) {
//         var chainInfo = getPropertyInChain(owner, property);
//         var base = chainInfo.base;
//         var prop = chainInfo.prop,
//             chain = chainInfo.chain; // The scriptlet might be executed before the chain property has been created.
//         // In this case we're checking whether the base element exists or not
//         // and if not, we simply exit without overriding anything

//         if (base instanceof Object === false && base === null) {
//             // log the reason only while debugging
//             if (source.verbose) {
//                 var props = property.split('.');
//                 var propIndex = props.indexOf(prop);
//                 var baseName = props[propIndex - 1];
//                 console.log("set-constant failed because the property '".concat(baseName, "' does not exist")); // eslint-disable-line no-console
//             }

//             return;
//         }

//         if (chain) {
//             var setter = function setter(a) {
//                 base = a;

//                 if (a instanceof Object) {
//                     setChainPropAccess(a, chain);
//                 }
//             };

//             Object.defineProperty(owner, prop, {
//                 get: function get() {
//                     return base;
//                 },
//                 set: setter
//             });
//             return;
//         }

//         if (mustCancel(base[prop])) {
//             return;
//         }

//         hit(source);
//         setPropertyAccess(base, prop, {
//             get: function get() {
//                 return constantValue;
//             },
//             set: function set(a) {
//                 if (mustCancel(a)) {
//                     constantValue = a;
//                 }
//             }
//         });
//     };

//     setChainPropAccess(window, property);
// }