

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
