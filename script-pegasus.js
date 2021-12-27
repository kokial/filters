

// Sentinel
if (!this.sentinel) (function (doc, ev) {
    // define global object
    sentinel = (function () {
        var isArray = Array.isArray,
            selectorToAnimationMap = {},
            animationCallbacks = {},
            styleEl,
            styleSheet,
            cssRules;


        return {
            /**
             * Add watcher.
             * @param {array} cssSelectors - List of CSS selector strings
             * @param {Function} callback - The callback function
             */
            on: function (cssSelectors, callback) {
                if (!callback) return;

                // initialize animationstart event listener
                if (!styleEl) {
                    var doc = document,
                        head = doc.head;

                    // add animationstart event listener
                    doc.addEventListener("animationstart", function (ev, callbacks, l, i) {
                        callbacks = animationCallbacks[ev.animationName];

                        // exit if callbacks haven"t been registered
                        if (!callbacks) return;

                        // stop other callbacks from firing
                        ev.stopImmediatePropagation();

                        // iterate through callbacks
                        l = callbacks.length;
                        for (i = 0; i < l; i++) callbacks[i](ev.target);
                    }, true);

                    // add stylesheet to document
                    styleEl = doc.createElement("style");
                    head.insertBefore(styleEl, head.firstChild);
                    styleSheet = styleEl.sheet;
                    cssRules = styleSheet.cssRules;
                }

                // listify argument and add css rules/ cache callbacks
                (isArray(cssSelectors) ? cssSelectors : [cssSelectors])
                    .map(function (selector, animId, isCustomName) {
                        animId = selectorToAnimationMap[selector];

                        if (!animId) {
                            isCustomName = selector[0] == "!";

                            // define animation name and add to map
                            selectorToAnimationMap[selector] = animId =
                                isCustomName ? selector.slice(1) : "sentinel-" +
                                    Math.random().toString(16).slice(2);

                            // add keyframe rule
                            cssRules[styleSheet.insertRule(
                                "@keyframes " + animId +
                                "{from{transform:none;}to{transform:none;}}",
                                cssRules.length)]
                                ._id = selector;

                            // add selector animation rule
                            if (!isCustomName) {
                                cssRules[styleSheet.insertRule(
                                    selector + "{animation-duration:0.0001s;animation-name:" +
                                    animId + ";}",
                                    cssRules.length)]
                                    ._id = selector;
                            }

                            // add to map
                            selectorToAnimationMap[selector] = animId;
                        }

                        // add to callbacks
                        (animationCallbacks[animId] = animationCallbacks[animId] || [])
                            .push(callback);
                    });
            },
            /**
             * Remove watcher.
             * @param {array} cssSelectors - List of CSS selector strings
             * @param {Function} callback - The callback function (optional)
             */
            off: function (cssSelectors, callback) {
                // listify argument and iterate through rules
                (isArray(cssSelectors) ? cssSelectors : [cssSelectors])
                    .map(function (selector, animId, callbackList, i) {
                        // get animId
                        if (!(animId = selectorToAnimationMap[selector])) return;

                        // get callbacks
                        callbackList = animationCallbacks[animId];

                        // remove callback from list
                        if (callback) {
                            i = callbackList.length;

                            while (i--) {
                                if (callbackList[i] === callback) callbackList.splice(i, 1);
                            }
                        } else {
                            callbackList = [];
                        }

                        // exit if callbacks still exist
                        if (callbackList.length) return;

                        // clear cache and remove css rules
                        i = cssRules.length;

                        while (i--) {
                            if (cssRules[i]._id == selector) styleSheet.deleteRule(i);
                        }

                        delete selectorToAnimationMap[selector];
                        delete animationCallbacks[animId];
                    });
            },
            /**
             * Reset watchers and cache
             */
            reset: function () {
                selectorToAnimationMap = {};
                animationCallbacks = {};
                if (styleEl) styleEl.parentNode.removeChild(styleEl);
                styleEl = 0;
            }
        };

    })();

    // dispatch load event
    ev = doc.createEvent("HTMLEvents");
    if (ev.initEvent) ev.initEvent("sentinel-load", false, false);
    else ev = new Event("sentinel-load");
    doc.dispatchEvent(ev);
})(document);
//END Sentinel



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
