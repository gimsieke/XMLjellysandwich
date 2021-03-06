/*jshint bitwise: false*/
var SaxonJS = function () {
 
    // Copyright (c) Saxonica Limited 2017
    
    // The following #include directives are used by the Build.java tool to concatenate all modules
    
/**
 * This module is included in Saxon-JS when it is to be used in the browser.
 */

var BrowserPlatform = function () {
    
    "use strict";
    
    /* Most  */
    var parsererrorNS;
    try {
        var parser = new DOMParser();
        var erroneousParse = parser.parseFromString("<", "text/xml"); 
        parsererrorNS = erroneousParse.getElementsByTagName("parsererror")[0].namespaceURI;
    } catch(e) {}
    
    
    
    function isParserError(parsedDocument) {
         return parsedDocument.getElementsByTagNameNS(parsererrorNS, "parsererror").length > 0;
    }
    
    var platform = {
        inBrowser: true,
        
        
        asyncGet: function (uri, callback) {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", uri, true);
            xhr.onload = function (e) {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        callback(xhr.responseText);
                    } else {
                        throw XError(xhr.statusText + ": " + uri, "SXJS0006");
                    }
                }
            };
            xhr.onerror = function (e) {
                throw XError(xhr.statusText + ": " + uri, "SXJS0006");
            };
            xhr.send(null);
        },
        
        asyncGetXml: function (uri, callback) {
            platform.asyncGet(uri, function (content) {
                var doc = platform.parseXmlFromString(content);
                doc._saxonDocumentUri = uri;
                callback(uri, doc);
            });
        },
        
        asyncGetMultipleXml: function (arrayOfUris, callback) {
            var counter = arrayOfUris.length;
            var arrayOfDocs = {
            };
            function arrayDocFn(uri, doc) {
                arrayOfDocs[uri] = doc;
                if (-- counter <= 0) {
                    callback(arrayOfDocs);
                }
            }
            for (var i = 0; i < arrayOfUris.length; i++) {
                if (arrayOfUris[i]) {
                    platform.asyncGetXml(arrayOfUris[i], arrayDocFn);
                } else {
                    counter--;
                }
            }
        },
        
        parseXmlFromString: function (str) {
            // Normalize line endings
            str = str.replace(/\r\n|\r(?!\n)/g, "\n");
            // Check for misplaced XML/text declarations (because no-one else does it...)
            try {
                if (/^.+<\?xml/i.test(str)) {
                    throw new Error();
                }            
                var result = new DOMParser().parseFromString(str, "application/xml");
                var de = result.documentElement;
                if(isParserError(result)) {
                    throw new Error();
                }
                return result;
            }
            catch (e) {
                throw XError("Misplaced or malformed XML", "FODC0002");
            }
        },
        
        readResource: function (href) {
            var request = new XMLHttpRequest();
            var absHref = platform.resolveUri(href, platform.baseUri());
            var resource;
            //console.log("Sending request:" + absHref);
            request.open("GET", absHref, false);
            request.send(null);
            //console.log("Returned with status = " + request.status);
            if (request.status == 200) {
                resource = request.responseText;
            } else {
                console.log("Failed to read resource at " + href); // XError ?
            }
            if (resource.charAt(0) == "\ufeff") {
                throw XError(resource.substring(1), "FODC0002");
            }
            return resource;
        },
        
        readFile: function (uri, enc) {
            // TODO encoding???
            var request = new XMLHttpRequest();
            var resource;
            try {
                request.open("GET", uri, false);
                //console.log("Sending request");
                request.send(null);
            }
            catch (e) {
                throw XError("Get failure " + uri, "FODC0002");
            }
            //console.log("Returned with status = " + request.status);
            if (request.status == 200) {
                resource = request.responseText;
            } else {
                throw XError("Failed to read file at " + uri, "FODC0002");
            }
            if (resource.charAt(0) == "\ufeff") {
                throw XError(resource.substring(1), "FODC0002");
            }
            if (resource.indexOf("\u0000") >= 0) {
                throw XError("External file contains non-XML characters", "FOUT1190");
            }
            return resource;
        },
        
        resolveUri: function (href, base) {
            try { // IE/Edge throw an exception if the URI is illegal
                // http://stackoverflow.com/questions/470832/getting-an-absolute-url-from-a-relative-one-ie6-issue
                var doc = document,
                old_base = doc.getElementsByTagName('base')[0],
                old_href = old_base && old_base.href,
                doc_head = doc.head || doc.getElementsByTagName('head')[0],
                our_base = old_base || doc_head.appendChild(doc.createElement('base')),
                resolver = doc.createElement('a'),
                resolved_url;
                our_base.href = base || '';
                resolver.href = href;
                resolved_url = resolver.href;
                // browser magic at work here
                
                /* TODO There are issues with this percent encoding the result, which shouldn't happen as 
                resolve-uri() is merely a string operation  -  see fn-resolve-uri-32 
                In addition, the method can add trailing '/' - see fn-resolve-uri-5  et al 
                and forces the href to lower case - see fn-resolve-uri-9 et al */
                
                if (old_base) old_base.href = old_href; else doc_head.removeChild(our_base);
                return resolved_url;
            }
            catch (e) {
                throw XError("Illegal URI: href=" + href + " base=" + base, "FODC0005");
            }
        },
        
        baseUri: function () {
            // http://stackoverflow.com/questions/2976651/javascript-how-do-i-get-the-url-of-script-being-called
            var scripts = document.getElementsByTagName('script');
            /*  We look through the scripts for the first script loading SaxonJS in either of its forms */
            for(var i = 0; i < scripts.length; i++) {
                if(/SaxonJS(\.min)?.js/.test(scripts[i].getAttribute("src"))) {
                    return scripts[i].src;
                }
            }
            /*  Otherwise assume the last script */
            var index = scripts.length - 1;
            var myScript = scripts[index];
            return myScript.src;
        },
        
        initialize: function () {
            init();
            Atomic._init();
            window.print = function (str) {
                console.log(str);
            };
        },
        
        deliverMessage: function (options) {
            if (typeof options.deliverMessage !== "function") {
                options.deliverMessage = function (msg) {
                    console.log("xsl:message: " + msg);
                };
            }
        }
    };
    
    
    function init() {
        // Some polyfills of JS6 functions
        Math.trunc = Math.trunc || function (x) {
            return x < 0 ? Math.ceil(x): Math.floor(x);
        };

        if (! Array.prototype.findIndex) {
            Object.defineProperty(Array.prototype, 'findIndex', {
                value: function (predicate) {
                    'use strict';
                    if (this == null) {
                        throw new TypeError('Array.prototype.findIndex called on null or undefined');
                    }
                    if (typeof predicate !== 'function') {
                        throw new TypeError('predicate must be a function');
                    }
                    var list = Object(this);
                    var length = list.length >>> 0;
                    var thisArg = arguments[1];
                    var value;
                    
                    for (var i = 0; i < length; i++) {
                        value = list[i];
                        if (predicate.call(thisArg, value, i, list)) {
                            return i;
                        }
                    }
                    return -1;
                },
                enumerable: false,
                configurable: false,
                writable: false
            });
        }
        if (! String.prototype.includes) {
            String.prototype.includes = function (search, start) {
                'use strict';
                if (typeof start !== 'number') {
                    start = 0;
                }
                
                if (start + search.length > this.length) {
                    return false;
                } else {
                    return this.indexOf(search, start) !== -1;
                }
            };
        }
    }
    
    
    return {
        platform: platform
    };
}
();
function showValue(val) {
    
    "use strict";
    
    if (val === null) {
        return "#null";
    }
    if (typeof val == "undefined") {
        return "#undefined";
    }
    var result;
    if (val instanceof Expr.XdmArray) {
        result = "[";
        var k;
        for (k = 0; k < val.value.length && k < 3; k++) {
            if (k !== 0) {
                result += ",";
            }
            result += showValue(val.value[k]);
        }
        if (val.value.length >= 4) {
            result += ",...(" + val.value.length + ")";
        }
        result += "]";
        return result;
    }
    if (val instanceof HashTrie) {
        result = "{";
        val.forAllPairs(function(pair) {
            result += showValue(pair.k);
            result += ": ";
            result += showValue(pair.v);
            result += ", ";
        });
        result += "}";
        return result;
    }
    if (DomUtils.isNode(val) && !(DomUtils.isAttr(val) || DomUtils.isNSNode(val))) {
        result = {
            "1": "element <" + val.tagName + ">",
            "2": "attribute @" + val.name,
            "3": "text",
            "7": "pi",
            "8": "comment",
            "9": "document " + (val._saxonDocumentNumber ? "#" + val._saxonDocumentNumber : "(No nr / #0)"),
            "11": "docFrag"
        }[val.nodeType];
        if (val.nodeType == "9") {
            var nn;
            for (nn = 0; nn < val.childNodes.length; nn++) {
                result += "~>" + showValue(val.childNodes[nn]);
            }
        }
        return result;
    } else if (DomUtils.isAttr(val)) {
        return "attribute @" + val.name;
    } else if (DomUtils.isNSNode(val)) {
        return "ns:" + val.prefix + "=" + val.uri;
    } else if (val.type) {
        if (val.type === "string") {
            return '"' + val.toString() + '"';
        } else if (val.type === "integer" || val.type === "boolean") {
            return val.toString();
        } else {
            return "xs:" + val.type + "(" + val.toString() + ")";
        }
    } else if (typeof val == "object" && "length" in val) {
        result = "(";
        var i;
        for (i = 0; i < val.length && i < 3; i++) {
            if (i !== 0) {
                result += ",";
            }
            result += showValue(val[i]);
        }
        if (val.length >= 4) {
            result += ",...(" + val.length + ")";
        }
        result += ")";
        return result;
    } else {
        return "??? " + val;
    }

}
/*jshint bitwise: false*/
var Atomic = (function () {

    "use strict";

    // We populate hierarchy with names of the form "A<B" implying that A is a subtype of B, for example
    // the presence of the name "integer<decimal" indicates that integer is a subtype of decimal. Because
    // the size of the type hierarchy is modest, we hold the full transitive closure.

    // Initially we include only the primitive and pseudo-primitive types; later we will add the restricted
    // integer and string types programmatically.

    var hierarchy = {
        "integer<decimal": 1,
        "decimal<numeric": 1,
        "double<numeric": 1,
        "float<numeric": 1,
        "integer<numeric": 1,
        "dateTimeStamp<dateTime": 1
    };

    function isSubtype(a, b) {
        //print("isSubType " + a + ", " + b + " = " + (a == b || hierarchy[a + "<" + b] == 1));
        return a == b || hierarchy[a + "<" + b] == 1;
    }

    function disallowedCast(item, type) {
        throw new XError("Casting from xs:" + item.type + " to xs:" + type + " is not allowed", "XPTY0004");
    }

    function invalidValue(str, name) {
        throw new XError("Supplied value \"" + str + "\" is not a valid xs:" + name, "FORG0001");
    }

    function notComparable(a, b) {
        throw new XError("Cannot compare xs:" + a + " with xs:" + b, "XPTY0004");
    }

    /**
     * Convert the supplied string to a Javascript number, according to the XPath rules for
     * string-to-double conversion.
     * @param str the supplied string
     * @param failIfInvalid if true, the function throws FORG0001 if the string is not convertible
     * to a number. If false, the function instead returns NaN in this situation.
     * @returns {Number}
     */

    function stringToNumber(str, failIfInvalid) {
        //print("string to number: " + str);
        str = Regex.trim(str);
        // XPath allows trailing ".", Javascript does not
        if (/\.$/.test(str)) {
            str = str + "0";
        }
        if (/^(\-|\+)?([0-9]+(\.[0-9]*)?|\.[0-9]+)([Ee](\-|\+)?[0-9]+)?$/.test(str)) {
            // regex from XPath spec (\+|-)?([0-9]+(\.[0-9]*)?|\.[0-9]+)([Ee](\+|-)?[0-9]+)? |(\+|-)?INF|NaN
            //print("stringToNumber regex match: " + str)
            return parseFloat(str);
        } else if (/^(\-|\+)?NaN$/.test(str)) {
            return NaN;
        } else if (/^\-INF$/.test(str)) {
            return -Infinity;
        } else if (/^(\+)?INF$/.test(str)) {
            //print("matched +INF");
            return Infinity;
        }
        if (failIfInvalid) {
            throw new XError("Cannot convert string '" + str + "' to a number", "FORG0001");
        } else {
            return NaN;
        }
    }

    function hashOfNumber(num) {
        return num.toString(36);
    }

    var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

    function base64_encode(data) {
        //  from: http://phpjs.org/functions/base64_encode/ as at 2016-03-28
        //  Adapted to do no URL encoding. The input data is represented as a string
        //  containing octets/codepoints in the range 0-255.

        var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
            ac = 0,
            tmp_arr = [];

        //print("b64_encode in=" + data);
        if (!data) {
            return data;
        }

        do {
            // pack three octets into four hexets
            o1 = data.charCodeAt(i++);
            o2 = data.charCodeAt(i++);
            o3 = data.charCodeAt(i++);

            bits = o1 << 16 | o2 << 8 | o3;

            h1 = bits >> 18 & 0x3f;
            h2 = bits >> 12 & 0x3f;
            h3 = bits >> 6 & 0x3f;
            h4 = bits & 0x3f;

            // use hexets to index into b64, and append result to encoded string
            tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
        }
        while (i < data.length);

        var enc = tmp_arr.join('');
        var r = data.length % 3;
        return (r ? enc.slice(0, r - 3) : enc) + '==='.slice(r || 3);
    }

    function base64_decode(data) {
        //  from: http://phpjs.org/functions/base64_decode/ as at 2016-03-28
        //  Adapted to do no URL decoding, and to do validation. The output data is represented as a string
        //  containing octets/codepoints in the range 0-255.

        data = data.replace(/\s/g, '');
        if (!/^((([A-Za-z0-9+/]){4})*(([A-Za-z0-9+/]){3}[A-Za-z0-9+/]|([A-Za-z0-9+/]){2}[AEIMQUYcgkosw048]=|[A-Za-z0-9+/][AQgw]==))?$/.test(data)) {
            invalidValue(data, "base64Binary");
        }

        var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
            ac = 0,
            tmp_arr = [];

        if (data.length === 0) {
            return data;
        }

        data += '';

        do {
            // unpack four hexets into three octets using index points in b64
            h1 = b64.indexOf(data.charAt(i++));
            h2 = b64.indexOf(data.charAt(i++));
            h3 = b64.indexOf(data.charAt(i++));
            h4 = b64.indexOf(data.charAt(i++));

            bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;

            o1 = bits >> 16 & 0xff;
            o2 = bits >> 8 & 0xff;
            o3 = bits & 0xff;

            if (h3 == 64) {
                tmp_arr[ac++] = String.fromCharCode(o1);
            } else if (h4 == 64) {
                tmp_arr[ac++] = String.fromCharCode(o1, o2);
            } else {
                tmp_arr[ac++] = String.fromCharCode(o1, o2, o3);
            }
        }
        while (i < data.length);

        return tmp_arr.join('');
    }

    function hex_encode(str) {
        //print("hex_encode " + str);
        var out = "";
        Expr.stringToCodepoints(str).forEach(function (cp) {
            out += (cp + 256).toString(16).substring(1).toUpperCase();
        });
        return out;
    }

    function hex_decode(str) {
        //print("hex decode: " + str);
        str = Regex.trim(str);
        if (!/^([a-fA-F0-9][a-fA-F0-9])*$/.test(str)) {
            invalidValue(str, "hexBinary");
        }
        var i, out = [];
        for (i = 0; i < str.length; i += 2) {
            out.push(String.fromCharCode(parseInt(str.substring(i, i + 2), 16)));
        }
        //print("hex out: " + out.join(''));
        return out.join('');
    }

    /**
     * The XdmString type is used to hold instances of xs:string (including subtypes of xs:string),
     * and also xs:untypedAtomic and xs:anyURI.
     * @param value the string value (as a primitive string)
     * @param type the type of the value - defaults to "string"
     * @constructor
     */

    function XdmString(value, type) {
        this.value = value;
        this.type = type || "string";
        if (typeof value != "string") {
            Expr.internalError("bad input to string constructor " + showValue(value));
        }
    }

    XdmString.prototype = {
        value: null,
        type: "string",
        _hash: 0,
        toString: function () {
            return this.value;
        },
        toDouble: function () {
            return stringToNumber(this.value, true);
        },
        compareTo: function (other) {
            if (other instanceof XdmString) {
                //print("UA.compare " + this.value + " to " + other.value + " =? " + (this.value == other.value));
                if (Expr.isAstral(this.value) || Expr.isAstral(other.value)) {
                    var comp = Compare.codePointComparison(this.value, other.value);
                    return comp < 0 ? -1 : comp === 0 ? 0 : +1;
                } else {
                    return (this.value < other.value ? -1 : this.value == other.value ? 0 : +1);
                }
            } else if (this.type == "untypedAtomic") {
                return Atomic[other.type].cast(this).compareTo(other);
            } else {
                notComparable(this.type, other.type);
            }
        },
        equals: function (other) {
            return this.compareTo(other) === 0;
        },
        hashCode: function () {
            if (this.value.length <= 4) {
                return this.value;
            }
            // copied from Java String.hashCode
            var h = this._hash;
            var len = this.value.length;
            if (h === 0 && len > 0) {
                var i;
                for (i = 0; i < len; i++) {
                    h = 31 * h + this.value.charAt(i++);
                }
                this._hash = h;
            }
            return hashOfNumber(h);
        }
    };

    /**
     * The XdmBinary type is used to hold instances of xs:hexBinary or xs:base64Binary
     * The internal representation is as a string in which each character (codepoint range 0-255)
     * represents one octet.
     * @param value the internal string representation
     * @param type the type of the value - must be "hexBinary" or "base64Binary"
     * @constructor
     */

    function XdmBinary(value, type) {
        this.value = value;
        this.type = type;
        //print("new XdmBinary value=" + value + " type=" + type);
    }

    XdmBinary.prototype = {
        value: null,
        type: "hexBinary",
        toString: function () {
            return this.type == "hexBinary" ? hex_encode(this.value) : base64_encode(this.value);
        },
        compareTo: function (other) {
            if (other instanceof XdmBinary && this.type == other.type) {
                //print("UA.compare " + this.value + " to " + other.value + " =? " + (this.value == other.value));
                if (Expr.isAstral(this.value) || Expr.isAstral(other.value)) {
                    var comp = Compare.codePointComparison(this.value, other.value);
                    return comp < 0 ? -1 : comp === 0 ? 0 : +1;
                } else {
                    return (this.value < other.value ? -1 : this.value == other.value ? 0 : +1);
                }
            } else {
                notComparable(this.type, other.type);
            }
        },
        equals: function (other) {
            return this.compareTo(other) === 0;
        },
        hashCode: function () {
            return new XdmString(this.value).hashCode();
        }
    };


    /**
     * The XdmDouble class is used for both xs:double and xs:float values
     * @param value the value as a Javascript number
     * @param type the type, "double" or "float" - default is "double"
     * @constructor
     */

    function XdmDouble(value, type) {
        if (typeof value != "number") {
            Expr.internalError("type of value supplied to XdmDouble is not number: " + (typeof value));
        }
        this.value = value;
        this.type = type || "double";
    }

    XdmDouble.prototype = {
        value: 0,
        type: "double",
        _hash: 0,
        toString: function () {
            if (this.value === 0) {
                return (1 / this.value < 0 ? "-0" : "0");
            }
            if (this.value == Number.POSITIVE_INFINITY) {
                return "INF";
            }
            if (this.value == Number.NEGATIVE_INFINITY) {
                return "-INF";
            }
            var num = this.value;
            var abs = Math.abs(num);
            if (abs >= 1e6 || abs < 1e-6) {
                var str = num.toExponential();
                var e = str.indexOf("e");
                var mantissa = str.substring(0, e);
                if (!mantissa.includes(".")) {
                    mantissa += ".0";
                }
                var exponent = str.substring(e + 1);
                return mantissa + "E" + exponent.replace("+", "");
            } else {
                return num.toString();
            }
        },
        equals: function (other) {
            return this.compareTo(other) === 0;
        },
        compareTo: function (other) {
            if ("toNumber" in other) {
                return this.value < other.toNumber() ? -1 : this.value == other.toNumber() ? 0 : +1;
            } else {
                notComparable(this.type, other.type);
            }
        },
        hashCode: function () {
            return hashOfNumber(this.value);
        },
        toNumber: function () {
            return this.value;
        },
        toDouble: function () {
            return this;
        },
        abs: function () {
            return new XdmDouble(Math.abs(this.value), this.type);
        },
        negate: function () {
            return new XdmDouble(-this.value, this.type);
        },
        ceiling: function () {
            return new XdmDouble(Math.ceil(this.value), this.type);
        },
        floor: function () {
            return new XdmDouble(Math.floor(this.value), this.type);
        },
        round: function (precision) {
            var result;
            if (precision === 0) {
                result = Math.round(this.value);
            } else {
                var scale = Math.pow(10, -precision);
                result = Math.round(this.value / scale) * scale;
            }
            return new XdmDouble(result, this.type);
        },
        "roundHalfToEven": function (precision) {
            if (isNaN(this.value) || !isFinite(this.value)) {
                // special cases: NaN, +|- zero, +|- infinity
                return this;
            } else {
                return Atomic[this.type].cast(new XdmDecimal(Big(this.value)).roundHalfToEven(precision));
            }
        }
    };

    /**
     * The class XdmInteger is used for all xs:integer
     * values (including subtypes) that are in range for the Javascript Number type
     * @param value a JS number
     * @param subtype string, the name of the subtype to which the value conforms
     * @constructor
     */

    function XdmInteger(value, subtype) {
        if (typeof value != "number") {
            Expr.internalError("type of value supplied to XdmInteger is not number: " + (typeof value));
        }
        this.value = value;
        this.type = subtype || "integer";
    }

    XdmInteger.prototype = {
        value: 0,
        type: "integer",
        _hash: 0,
        toString: function () {
            return this.value.toString();
        },
        equals: function (other) {
            return this.compareTo(other) === 0;
        },
        compareTo: function (other) {
            if ("toNumber" in other) {
                return this.value - other.toNumber();
            } else {
                notComparable(this.type, other.type);
            }
        },
        hashCode: function () {
            return hashOfNumber(this.value);
        },
        toDouble: function () {
            return new XdmDouble(this.value);
        },
        toNumber: function () {
            return this.value;
        },
        toBig: function () {
            return new Big(this.value);
        },
        abs: function () {
            return new XdmInteger(Math.abs(this.value));
        },
        negate: function () {
            return new XdmInteger(-this.value);
        },
        ceiling: function () {
            return this;
        },
        floor: function () {
            return this;
        },
        round: function (precision) {
            if (precision < 0) {
                var scale = Math.pow(10, -precision);
                return new XdmInteger(Math.round(this.value / scale) * scale);
            } else {
                return this;
            }
        },
        roundHalfToEven: function (precision) {
            if (precision < 0) {
                var scale = Math.pow(10, -precision);
                return new XdmInteger(parseInt(Big(this.value).div(scale).round(0, 2).times(scale), 10));
            } else {
                return this;
            }
        }
    };

    /**
     * The class XdmDecimal is used for all non-integer xs:decimal values, and also for xs:integer
     * values (including subtypes) that are out of range for the Javascript Number type
     * @param value may be any value accepted by the Big type (including a Big)
     * @param subtype string, the name of the subtype to which the value conforms
     * @constructor
     */

    function XdmDecimal(value, subtype) {
        this.value = new Big(value);
        this.type = subtype || "decimal";
    }

    XdmDecimal.prototype = {
        value: null, // Object of type Big
        type: "decimal",
        _hash: 0,
        toString: function () {
            return this.value.toFixed();
        },
        equals: function (other) {
            return this.compareTo(other) === 0;
        },
        compareTo: function (other) {
            if (other instanceof XdmDecimal) {
                return this.value.cmp(other.value);
            }
            if ("toDouble" in other) {
                return this.value - other.toDouble().value;
            } else {
                notComparable(this.type, other.type);
            }
        },
        hashCode: function () {
            return hashOfNumber(this.toNumber());
        },
        toBig: function () {
            return this.value;
        },
        toDouble: function () {
            return new XdmDouble(parseFloat(this.value));
        },
        toNumber: function () {
            return parseFloat(this.value);
        },
        abs: function () {
            return new XdmDecimal(this.value.abs(), this.type);
        },
        negate: function () {
            var b = Big(this.value);
            b.s = -b.s;
            return new XdmDecimal(b, this.type == "decimal" ? "decimal" : "integer");
        },
        ceiling: function () {
            return new XdmDecimal(this.value.round(0, this.value.s < 0 ? 0 : 3), this.type);
        },
        floor: function () {
            return new XdmDecimal(this.value.round(0, this.value.s < 0 ? 3 : 0), this.type);
        },
        round: function (precision) {
            function scale(big, places) {
                // multiply by 10^places
                var b = new Big(big);
                b.e += places;
                return b;
            }

            var big = this.value;
            var shift = 0;
            if (precision < 0) {
                shift = precision;
                precision = 0;
                big = scale(big, shift);
            }
            var addend = big.s > 0 ? Big(0) : this.floor().abs();
            big = big.plus(addend).round(precision, 1).minus(addend);
            if (scale !== 0) {
                big = scale(big, -shift);
            }
            return new XdmDecimal(big, this.type == "decimal" ? "decimal" : "integer");
        },
        roundHalfToEven: function (precision) {
            var result;
            if (precision < 0) {
                var scale = Big(10).pow(-precision);
                result = this.value.div(scale).round(0, 2).times(scale);
                //TODO deal with minus zero
            } else {
                result = this.value.round(precision, 2);
            }
            return new XdmDecimal(result, this.type == "decimal" ? "decimal" : "integer");
        }
    };

    /**
     * The class XdmBoolean is used to represent xs:boolean values
     * @param value a JS boolean
     * @constructor
     */


    function XdmBoolean(value) {
        this.value = value;
        if (typeof value != "boolean") {
            Expr.internalError("type of value supplied to XdmBoolean is not boolean: " + (typeof value));
        }
    }

    XdmBoolean.prototype = {
        value: null,
        type: "boolean",
        _hash: 0,

        toString: function () {
            return this.value.toString();
        },
        toBoolean: function () {
            return this.value;
        },
        compareTo: function (other) {
            if (other instanceof XdmBoolean) {
                // false < true
                return (this.value ? 1 : 0) - (other.value ? 1 : 0);
            } else {
                notComparable(this.type, other.type);
            }
        },
        equals: function (other) {
            return this.compareTo(other) === 0;
        },
        hashCode: function () {
            return this.value.toString();
        }
    };

    /**
     * The class XdmQName is used to represent xs:QName values
     * @param prefix string, the namespace prefix ("" for the default namespace)
     * @param uri string, the namespace URI ("" for no namespace)
     * @param local string, the local part of the name (which is assumed to be valid)
     * @constructor
     */

    function XdmQName(prefix, uri, local) {
        this.prefix = prefix ? prefix : "";
        this.uri = uri ? uri : "";
        this.local = local;
        if (prefix !== "" && !Regex.isNCName(prefix)) {
            throw new XError("Invalid prefix: '" + prefix + "'", "FORG0001");
        } else if (!Regex.isNCName(local)) {
            throw new XError("Invalid local name: '" + local + "'", "FORG0001");
        }
    }

    XdmQName.prototype = {
        prefix: null,
        uri: null,
        local: null,
        type: "QName",
        toEQName: function () {
            return "Q{" + this.uri + "}" + this.local;
        },
        toString: function () {
            return (this.prefix.length > 0 ? (this.prefix + ":") : "") + this.local;
        },
        equals: function (other) {
            return other instanceof XdmQName && this.local == other.local && this.uri == other.uri;
        },
        compareTo: function () {
            throw new XError("QNames are not ordered", "FORG0006");
        },
        hashCode: function () {
            return this.uri.substring(this.uri.length - 3) + ":" + this.local.substring(0, 3);
        }
    };

    /**
     * The class XdmDateTime is used for xs:date, xs:time, xs:dateTime, xs:gYear, xs:gMonth, etc
     * @param UTCdate
     * @param timezoneOffset offset in minutes (number) or null meaning no timezone
     * @param type, for example "date" or "time"
     * @constructor
     */

    function XdmDateTime(UTCdate, timezoneOffset, type) {
        this.UTCdate = UTCdate;
        // a Date object
        this.timezoneOffset = timezoneOffset;
        // store as number of minutes, or null if none is specified
        this.type = type || "dateTime";
        // string dateTime|date|time
        if (!(UTCdate instanceof Date)) {
            Expr.internalError("type of UTCdate supplied to XdmDateTime is not Date");
        }
        if (timezoneOffset && typeof timezoneOffset != "number") {
            Expr.internalError("type of value for timezone offset supplied to XdmDateTime is not number: " + (typeof value));
        }
    }

    XdmDateTime.prototype = {
        type: "dateTime",
        _hash: 0,
        UTCdate: null,
        timezoneOffset: null,
        proxy: function () {
            // returns a date adjusted by the timezone offset, so that the UTC string *without*
            // the timezone provides the 'right' date and time components
            //TODO timezone offset issue!!!
            var dummy = new Date();
            // replaced this.UTCdate.getTimezoneOffset() by dummy.getTimezoneOffset()
            var offset = this.timezoneOffset !== null ? this.timezoneOffset : -dummy.getTimezoneOffset();
            //print("proxy offset " + offset);
            //print("dummy.getTimezoneOffset() " + dummy.getTimezoneOffset());
            return new Date(this.UTCdate.getTime() + offset * 60 * 1000);
        },
        _ISOEdit: function (str) {
            // remove Z
            str = str.substr(0, str.length - 1);
            // Remove trailing zeros in fractional seconds part
            if (this.UTCdate.getUTCMilliseconds() === 0) {
                str = str.replace(".000", "");
            } else {
                while (str.charAt(str.length - 1) == "0") {
                    str = str.substr(0, str.length - 1);
                }
            }
            str = str.replace(/^-0?0?/, "-");
            return str;
        },
        toString: function () {
            var str = this._ISOEdit(this.proxy().toISOString());
            var off = str.charAt(0) == "-" ? 1 : 0;

            function base(type) {
                switch (type) {
                    case "dateTime":
                    case "dateTimeStamp":
                        return str;
                    case "date":
                        return str.substring(0, 10 + off);
                    case "time":
                        return str.substring(11 + off);
                    case "gYearMonth":
                        return str.substring(0, 7 + off);
                    case "gYear":
                        return str.substring(0, 4 + off);
                    case "gMonthDay":
                        return "-" + str.substring(4 + off, 10 + off);
                    case "gMonth":
                        return "-" + str.substring(4 + off, 7 + off);
                    case "gDay":
                        return "--" + str.substring(7 + off, 10 + off);
                    default:
                        throw "type not recognised " + type;
                }
            }

            return base(this.type) + this.tzOffsetToString();
        },
        compareTo: function (other) {
            //"Values representing the same instant but having different time zone offsets are equal but not identical."
            // TODO this subtype of other, or other subtype of this
            if (other instanceof XdmDateTime && this.type == other.type) {
                //print("Compare dateTimes " + this.UTCdate.getTime() + ", " + other.UTCdate.getTime());
                return +this.UTCdate.getTime() - other.UTCdate.getTime();
            } else {
                //print("Not implemented comparing " + this.type + " " + this.toString() + ", " + other.type + " " + other.toString());
                notComparable(this.type, other.type);
            }
        },
        equals: function (other) {
            // TODO should this use compareTo method?
            return other instanceof XdmDateTime && this.type == other.type && this.UTCdate.getTime() == other.UTCdate.getTime();
        },
        hashCode: function () {
            return hashOfNumber(this.UTCdate.getTime() - 1454346732296);
            // chosen so hash keys will usually be short
        },
        adjustByMinutes: function (mins) {
            // used for adjust to timezone functions
            // ok that this always returns a dateTime, we only ever use the UTCdate it contains to then construct the right type
            return Atomic.dateTime.fromDate(new Date(this.UTCdate.getTime() + mins * 60 * 1000), this.timezoneOffset);
        },
        addMonths: function (num) {
            // used for arithmetic operators on durations, dates and times
            // Get year, month, and day from dateTime
            var dateStr = this.toString(),
                year = parseInt(dateStr.substring(0, 4), 10),
                month = parseInt(dateStr.substring(5, 7), 10),
                day = parseInt(dateStr.substring(8, 10), 10),
                newYear = year + Math.floor((month + num - 1) / 12),
                bce = newYear < 0;
            //print("year " + year + ", month " + month + ", day " + day);
            if (bce) {
                // throw new XError("Dates with negative year not supported", "FODT0001");
            }
            var newMonth = ((month + num - 1) % 12) + 1;
            if (newMonth <= 0) {
                newMonth += 12;
            }
            //print("newYear " + newYear + ", newMonth " + newMonth);
            while (!isValidDate([newYear, newMonth, day, 0, 0, 0])) {
                day -= 1;
            }
            return Atomic[this.type].fromString((bce ? ("-" + as4Digits(-newYear)) : as4Digits(newYear)) +
                "-" + as2Digits(newMonth) + "-" + as2Digits(day) + dateStr.substring(10));
        },
        tzOffsetToString: function () {
            // Converts timezoneOffset in minutes into the string form for xs:dateTime output
            var tzOffset = this.timezoneOffset;
            if (tzOffset === null) {
                return "";
            } else if (tzOffset === 0) {
                return "Z";
            }
            var num = Math.abs(tzOffset);
            return (tzOffset < 0 ? "-" : "+") + as2Digits(Math.floor(num / 60)) + ":" + as2Digits(num % 60);
        }
    };

    function as2Digits(number) {
        return (100 + number).toString().substring(1);
    }

    function as4Digits(number) {
        return (10000 + number).toString().substring(1);
    }

    /**
     * The class XdmDuration is used for xs:duration and its subtypes
     * @param months the number of months in the duration
     * @param milliseconds the number of milliseconds in the duration
     * @param type, for example "dayTimeDuration". Optional, default is "duration"
     * @constructor
     */

    function XdmDuration(months, milliseconds, type) {
        //print("new XdmDuration " + months + ", " + milliseconds);
        this.months = months;
        this.milliseconds = milliseconds;
        if (typeof months != "number" || typeof milliseconds != "number") {
            Expr.internalError("type of value supplied to XdmDuration is not number: " + (typeof months) + ", " + (typeof milliseconds));
        }
        if (months > 0 && milliseconds < 0 || months < 0 && milliseconds > 0) {
            throw new XError("Months/seconds must both be negative or both positive", "FORG0001");
        }
        this.type = type || "duration";
    }

    XdmDuration.prototype = {
        type: "duration",
        _hash: 0,
        months: 0,
        milliseconds: 0,
        // The components of a duration as an array of 6 non-negative numbers, [yr, mon, day, hr, min, sec]
        parts: function () {
            var result = [];
            function normalize (num, factors) {
                factors.forEach(function (factor) {
                    if (factor != 1000) {
                        result.push(Math.floor(num / factor));
                        num = num % factor;
                    } else {
                        result.push(num / factor);
                    }
                });
            }
            normalize(Math.abs(this.months), [12, 1]);
            normalize(Math.abs(this.milliseconds), [1000 * 60 * 60 * 24, 1000 * 60 * 60, 1000 * 60, 1000]);
            return result;
        },
        // -1, 0, or +1 according to the sign of the duration
        signum: function () {
            var temp = this.months + this.milliseconds;
            return temp < 0 ? -1 : temp > 0 ? +1 : 0;
        },
        toString: function () {
            var str,
                s = this.signum();
            if (s === 0) {
                str = this.type == "yearMonthDuration" ? "P0M" : "PT0S";
            } else {
                str = s < 0 ? '-P' : 'P';
                this.parts().forEach(function (part, pos) {
                    if (pos == 3) {
                        str += 'T';
                    }
                    if (part !== 0) {
                        if (pos == 6) {
                            str += part / 1000 + 'S';
                        } else str += part + ['Y', 'M', 'D', 'H', 'M', 'S'][pos];
                    }
                });
                str = str.replace(/T$/, "");
            }
            return str;
        },
        compareTo: function (other) {
            if (Atomic.yearMonthDuration.matches(this) && Atomic.yearMonthDuration.matches(other)) {
                return this.months - other.months;
            } else if (Atomic.dayTimeDuration.matches(this) && Atomic.dayTimeDuration.matches(other)) {
                return this.milliseconds - other.milliseconds;
            } else {
                throw new XError("Cannot compare durations that mix months and seconds", "XPTY0004");
            }
        },
        equals: function (other) {
            // TODO is this right? what about subtypes? 0 duration
            // could use isSubtype(other.type, "duration") in place of other instanceof XdmDuration
            return other instanceof XdmDuration && this.months == other.months && this.milliseconds == other.milliseconds;
        },
        hashCode: function () {
            return this.months.toString() + ":" + this.milliseconds.toString();
        }
    };


    var typeInfo = {
        hierarchy: hierarchy,
        isSubtype: isSubtype,
        anyAtomicType: {
            name: "anyAtomicType",
            matches: function (item) {
                return item instanceof XdmString ||
                    item instanceof XdmDecimal || item instanceof XdmInteger || item instanceof XdmDouble ||
                    item instanceof XdmBinary || item instanceof XdmBoolean ||
                    item instanceof XdmDuration || item instanceof XdmDateTime ||
                    item instanceof XdmQName;
            }
        },
        untypedAtomic: {
            name: "untypedAtomic",
            fromString: function (str) {
                return new XdmString(str, "untypedAtomic");
            },
            matches: function (item) {
                return item.type == "untypedAtomic";
            },
            cast: function (item) {
                return new XdmString(item.toString(), "untypedAtomic");
            }
        },
        string: {
            name: "string",
            fromString: function (str) {
                return new XdmString(str, "string");
            },
            matches: function (item) {
                return isSubtype(item.type, "string");
            },
            cast: function (item) {
                return new XdmString(item.toString(), "string");
            }
        },
        anyURI: {
            name: "anyURI",
            fromString: function (str) {
                return new XdmString(str.replace(/[ \r\t\n]+/g, ' ').replace(/^[ ]|[ ]$/g, ''), "anyURI");
            },
            /*fromURI: function (uri) { // TODO is this even used?
             var str;
             if (uri instanceof URI) {
             str = uri.toString();
             } else {
             print("URI expected!!!");
             str = uri.toString();
             }
             return new XdmString(str, "anyURI");
             },*/
            matches: function (item) {
                return item.type == "anyURI";
            },
            cast: function (item) {
                if (item instanceof XdmString) {
                    return Atomic.anyURI.fromString(item.toString());
                } else {
                    disallowedCast(item, "anyURI");
                }
            }
        },
        "double": {
            name: "double",
            fromString: function (str) {
                return new XdmDouble(stringToNumber(str, true));
            },
            fromStringUnfailing: function (str) {
                return new XdmDouble(stringToNumber(str, false));
            },
            fromNumber: function (num) {
                return new XdmDouble(num);
            },
            matches: function (item) {
                return item.type == "double";
            },
            cast: function (item) {
                if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                    return Atomic.double.fromString(item.toString());
                } else if (Atomic.numeric.matches(item)) {
                    return Atomic.double.fromNumber(item.toNumber());
                } else if (Atomic.boolean.matches(item)) {
                    return Atomic.double.fromNumber(item.toBoolean() ? 1 : 0);
                } else if (typeof item === "number") {
                    return Atomic.double.fromNumber(item);
                } else {
                    disallowedCast(item, "double");
                }
            }
        },
        decimal: {
            name: "decimal",
            fromString: function (str) {
                str = Regex.trim(str);
                if (/^(\+|-)?([0-9]+(\.[0-9]*)?|\.[0-9]+)$/.test(str)) {
                    return new XdmDecimal(new Big(str));
                } else {
                    invalidValue(str, "decimal");
                }
            },
            fromBig: function (big) {
                return new XdmDecimal(big);
            },
            fromNumber: function (num) {
                if (isNaN(num) || !isFinite(num)) {
                    throw new XError("Cannot convert NaN or INF to a decimal", "FOCA0002");
                }
                return new XdmDecimal(new Big(num));
            },
            matches: function (item) {
                //print("decimal matches? " + showValue(item));
                return item instanceof XdmDecimal || item instanceof XdmInteger;
            },
            cast: function (item) {
                if (Atomic.decimal.matches(item)) {
                    return new XdmDecimal(item.value, "decimal");
                } else if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                    return Atomic.decimal.fromString(item.toString());
                } else if (Atomic.numeric.matches(item)) {
                    return Atomic.decimal.fromNumber(item.toNumber());
                } else if (Atomic.boolean.matches(item)) {
                    return Atomic.decimal.fromString(item.toBoolean() ? "1" : "0");
                } else {
                    disallowedCast(item, "decimal");
                }
            }
        },
        float: {
            name: "float",
            fromString: function (str) {
                return new XdmDouble(stringToNumber(str, true), "float");
            },
            fromNumber: function (num) {
                if (Math.fround) {
                    num = Math.fround(num);
                    // reduce to single precision if possible
                }
                return new XdmDouble(num, "float");
            },
            matches: function (item) {
                return item.type == "float";
            },
            cast: function (item) {
                return Atomic.float.fromNumber(Atomic.double.cast(item).toNumber());
            }
        },
        boolean: {
            name: "boolean",
            fromString: function (str) {
                switch (Regex.trim(str)) {
                    case "true":
                    case "1":
                        return new XdmBoolean(true);
                    case "false":
                    case "0":
                        return new XdmBoolean(false);
                    default:
                        invalidValue(str, "boolean");
                }
            },
            fromBoolean: function (bool) {
                return new XdmBoolean(bool);
            },
            matches: function (item) {
                return item instanceof XdmBoolean;
            },
            cast: function (item) {
                if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                    return Atomic.boolean.fromString(item.toString());
                } else if (Atomic.numeric.matches(item)) {
                    return Atomic.boolean.fromBoolean(item.toNumber() !== 0 && !isNaN(item.toNumber()));
                } else if (Atomic.boolean.matches(item)) {
                    return item;
                } else if (typeof item === "boolean") {
                    return Atomic.boolean.fromBoolean(item);
                } else {
                    disallowedCast(item, "boolean");
                }
            }
        },
        integer: {
            name: "integer",
            base: "decimal",
            matches: function (item) {
                return isSubtype(item.type, "integer");
            },
            fromString: function (str) {
                //print("integer.fromString(" + str + ")");
                if (/^\s*(\-|\+)?[0-9]+\s*$/.test(str)) {
                    if (str.length > 9) {
                        return new XdmDecimal(str, "integer");
                    } else {
                        return new XdmInteger(parseInt(str, 10));
                    }
                } else {
                    invalidValue(str, "integer");
                }
            },
            fromNumber: function (num) {
                if (isNaN(num) || num == Number.NEGATIVE_INFINITY || num == Number.POSITIVE_INFINITY) {
                    throw new XError("Cannot convert NaN or INF to an integer", "FOCA0002");
                }
                return new XdmInteger(Math.trunc(num));
            },
            fromBig: function (big) {
                return new XdmDecimal(big, "integer");
            },
            valid: function (item) {
                return item.value.mod(1) === 0;
            },
            cast: function (item) {
                if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                    return Atomic.integer.fromString(item.toString());
                } else if (Atomic.numeric.matches(item)) {
                    return Atomic.integer.fromNumber(item.toNumber());
                } else if (Atomic.boolean.matches(item)) {
                    return Atomic.integer.fromNumber(item.toBoolean() ? 1 : 0);
                } else {
                    disallowedCast(item, "integer");
                }
            },
            convertFromJS: function (value) {
                if (typeof value == "number") {
                    return Atomic.integer.fromNumber(value);
                } else if (typeof value == "boolean") {
                    return Atomic.integer.fromNumber(value ? 1 : 0);
                } else if (typeof value == "string") {
                    return Atomic.integer.fromString(value);
                } else {
                    return Atomic.integer.fromString(value.toString());
                }
            }
        },
        numeric: {
            name: "numeric",
            members: ["double", "decimal", "float"],
            matches: function (item) {
                return item instanceof XdmDouble ||
                    item instanceof XdmInteger || item instanceof XdmDecimal;
            },
            cast: function (item) {
                if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                    return Atomic.double.fromString(item.toString());
                } else if (Atomic.numeric.matches(item)) {
                    return Atomic.double.fromNumber(item.toNumber());
                } else if (Atomic.boolean.matches(item)) {
                    return Atomic.double.fromNumber(item.toBoolean() ? 1 : 0);
                } else {
                    disallowedCast(item, "numeric");
                }
            }
        },
        QName: {
            name: "QName",
            matches: function (item) {
                return item instanceof XdmQName;
            },
            fromParts: function (prefix, uri, local) { 
                return new XdmQName(prefix, uri, local);
            },
            fromString: function (lexical, resolver) {
                lexical = Regex.trim(lexical);
                if (lexical.substring(0, 2) == "Q{") {
                    return Atomic.QName.fromEQName(lexical);
                }
                if (!Regex.isQName(lexical)) {
                    invalidValue(lexical, "QName");
                }
                var parts = lexical.split(":");
                if (parts.length == 1) {
                    return Atomic.QName.fromParts("", resolver(""), parts[0]);
                } else {
                    var uri = resolver(parts[0]);
                    if (uri === null) {
                        throw XError("Undeclared prefix: " + parts[0], "FONS0004");
                    } 
                    return Atomic.QName.fromParts(parts[0], uri, parts[1]);
                }
            },
            fromEQName: function (eqName) {
                var lc = eqName.indexOf("{"), 
                    rc = eqName.indexOf("}");
                var uri = Expr.wsCollapse(eqName.substring(lc + 1, rc));
                if (uri == "http://www.w3.org/2000/xmlns/") {
                    throw XError("Use of reserved namespace: " + uri, "XQST0070");
                }
                return new XdmQName("", uri , eqName.substring(rc + 1));
            },
            cast: function (item, resolver) {
                if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                    if (!resolver) {
                        throw XError("Casting to QName requires a namespace resolver", "FORG0001");
                    } else {
                        return Atomic.QName.fromString(item.toString(), resolver);
                    }
                } else if (Atomic.QName.matches(item)) {
                    return item;
                } else {
                    disallowedCast(item, "QName");
                }
            }
        },
        dateTime: {
            name: "dateTime",
            matches: function (item) {
                return item instanceof XdmDateTime && (item.type == "dateTime" || item.type == "dateTimeStamp");
            },
            fromString: function (str) {
                return dateTimeFromString(str, "dateTime");
            },
            fromDate: function (date, tzOffset) {
                return new XdmDateTime(date, tzOffset, "dateTime");
            },
            cast: function (item) {
                if (Atomic.dateTime.matches(item)) {
                    return item; // TODO what about cast between dateTime and dateTimeStamp
                } else if (Atomic.date.matches(item)) {
                    return Atomic.dateTime.fromDate(item.UTCdate, item.timezoneOffset);
                } else if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                    return Atomic.dateTime.fromString(item.toString());
                } else {
                    disallowedCast(item, "dateTime");
                }
            }
        },
        date: {
            name: "date",
            matches: function (item) {
                return item instanceof XdmDateTime && item.type == "date";
            },
            fromString: function (str) {
                // As starting instant
                return dateTimeFromString(str, "date");
            },
            fromDate: function (date, tzOffset) {
                // As starting instant
                // construct date
                var d = new XdmDateTime(date, tzOffset, "date");
                // convert the date to its starting instant as a dateTime
                var da = d.toString(),
                    len = da.charAt(0) == "-" ? 11 : 10,
                    startDT = Atomic.dateTime.fromString(da.substring(0, len) + "T00:00:00" + da.substring(len));
                // convert the dateTime to a date
                return new XdmDateTime(startDT.UTCdate, tzOffset, "date");
            },
            cast: function (item) {
                if (Atomic.date.matches(item)) {
                    return item;
                } else if (Atomic.dateTime.matches(item)) {
                    return Atomic.date.fromDate(item.UTCdate, item.timezoneOffset);
                } else if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                    return Atomic.date.fromString(item.toString());
                } else {
                    disallowedCast(item, "date");
                }
            }
        },
        time: {
            name: "time",
            matches: function (item) {
                return item instanceof XdmDateTime && item.type == "time";
            },
            fromString: function (str) {
                // As starting instant
                return dateTimeFromString(str, "time");
            },
            fromDate: function (date, tzOffset) {
                // As starting instant
                // construct time
                var t = new XdmDateTime(date, tzOffset, "time");
                // convert the time to its starting instant as a dateTime
                var startDT = Atomic.dateTime.fromString("1972-01-01T" + t.toString());
                // convert the dateTime to a time
                return new XdmDateTime(startDT.UTCdate, tzOffset, "time");
            },
            cast: function (item) {
                if (Atomic.time.matches(item)) {
                    return item;
                } else if (Atomic.dateTime.matches(item)) {
                    return Atomic.time.fromDate(item.UTCdate, item.timezoneOffset);
                } else if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                    return Atomic.time.fromString(item.toString());
                } else {
                    disallowedCast(item, "time");
                }
            }
        },
        dateTimeStamp: {
            //TODO derived type - use subtype definition?
            name: "dateTimeStamp",
            matches: function (item) {
                return item instanceof XdmDateTime && item.type == "dateTimeStamp";
            },
            fromString: function (str) {
                return dateTimeFromString(str, "dateTimeStamp");
            },
            fromDate: function (date, tzOffset) {
                return new XdmDateTime(date, tzOffset, "dateTimeStamp");
            },
            cast: function (item) {
                if (Atomic.time.matches(item)) {
                    return item;
                } else if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                    return Atomic.dateTimeStamp.fromString(item.toString());
                } else {
                    disallowedCast(item, "dateTimeStamp");
                }
            }
        },
        duration: {
            name: "duration",
            matches: function (item) {
                //return item instanceof XdmDuration;
                return isSubtype(item.type, "duration");
            },
            fromString: function (str) {
                return durationFromString(str, "duration");
            },
            fromMonthsMilliseconds: function (months, milliseconds) {
                return new XdmDuration(months, milliseconds, "duration");
            },
            cast: function (item) {
                if (Atomic.duration.matches(item)) {
                    return item;
                } else if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                    return Atomic.duration.fromString(item.toString());
                } else {
                    disallowedCast(item, "duration");
                }
            }
        },

        hexBinary: {
            name: "hexBinary",
            matches: function (item) {
                return item.type === "hexBinary";
            },
            fromString: function (str) {
                return new XdmBinary(hex_decode(str), "hexBinary");
            },
            cast: function (item) {
                if (item instanceof XdmBinary) {
                    return new XdmBinary(item.value, "hexBinary");
                } else if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                    return new XdmBinary(hex_decode(item.toString()), "hexBinary");
                }
                disallowedCast(item, "hexBinary");
            }
        },

        base64Binary: {
            name: "base64Binary",
            matches: function (item) {
                return item.type === "base64Binary";
            },
            fromString: function (str) {
                return new XdmBinary(base64_decode(str), "base64Binary");
            },
            encodeFromString: function (str) {
                return new XdmBinary(str, "base64Binary");
            },
            cast: function (item) {
                if (item instanceof XdmBinary) {
                    return new XdmBinary(item.value, "base64Binary");
                } else if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                    return new XdmBinary(base64_decode(item.toString()), "base64Binary");
                }
                disallowedCast(item, "base64Binary");
            }
        }
    };

    function addDateTimeType(name) {
        var t = typeInfo[name] = {};
        t.name = name;
        t.matches = function (item) {
            return item instanceof XdmDateTime && item.type == name;
        };
        t.fromString = function (str) {
            return dateTimeFromString(str, name);
        };
        t.fromDate = function (date, tzOffset) {
            return new XdmDateTime(date, tzOffset, name);
        };
        t.cast = function (item) {
            //print("cast " + item.type + " " + showValue(item) + " to " + name);
            if (typeInfo[name].matches(item)) {
                return item;
            } else if (Atomic.dateTime.matches(item) || Atomic.date.matches(item)) {
                // Convoluted, but this gets rid of the unwanted date components which is needed for equality to work
                var typ = typeInfo[name];
                return typ.fromString(typ.fromDate(item.UTCdate, item.timezoneOffset).toString());
            } else if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                return typeInfo[name].fromString(item.toString());
            } else {
                disallowedCast(item, name);
            }
        };
    }

    addDateTimeType("gYearMonth");
    addDateTimeType("gYear");
    addDateTimeType("gMonthDay");
    addDateTimeType("gMonth");
    addDateTimeType("gDay");

    var dateTimeRegex = {
        "dateTime": /^\s*(-?[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?)(Z|(\+|-)[0-9]{2}:[0-9]{2})?\s*$/,
        "date": /^\s*(-?[0-9]{4}-[0-9]{2}-[0-9]{2})(Z|(\+|-)[0-9]{2}:[0-9]{2})?\s*$/,
        "time": /^\s*([0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?)(Z|(\+|-)[0-9]{2}:[0-9]{2})?\s*$/,
        "dateTimeStamp": /^\s*(-?[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?)(Z|(\+|-)[0-9]{2}:[0-9]{2})\s*$/,
        "gYearMonth": /^\s*(-?[0-9]{4}-[0-9]{2})(Z|(\+|-)[0-9]{2}:[0-9]{2})?\s*$/,
        "gYear": /^\s*(-?[0-9]{4})(Z|(\+|-)[0-9]{2}:[0-9]{2})?\s*$/,
        "gMonthDay": /^\s*--([0-9]{2}-[0-9]{2})(Z|(\+|-)[0-9]{2}:[0-9]{2})?\s*$/,
        "gMonth": /^\s*--([0-9]{2})(Z|(\+|-)[0-9]{2}:[0-9]{2})?\s*$/,
        "gDay": /^\s*---([0-9]{2})(Z|(\+|-)[0-9]{2}:[0-9]{2})?\s*$/,
        "duration": /^\s*\-?P(?:([0-9]+)Y)?(?:([0-9]+)M)?(?:([0-9]+)D)?(?:T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+(?:\.[0-9]*)?)S)?)?\s*$/,
        "dayTimeDuration": /^\s*\-?P(?:([0-9]+)D)?(?:T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+(?:\.[0-9]*)?)S)?)?\s*$/,
        "yearMonthDuration": /^\s*\-?P(?:([0-9]+)Y)?(?:([0-9]+)M)?\s*$/
    };

    var dateConstructor = {
        "dateTime": function (v) {
            return padFracSec(v);
        },
        "date": function (v) {
            return v + "T00:00:00";
        },
        "time": function (v) {
            return "1972-01-01T" + padFracSec(v);
        },
        "dateTimeStamp": function (v) {
            return padFracSec(v);
        },
        "gYearMonth": function (v) {
            return v + "-01T00:00:00";
        },
        "gYear": function (v) {
            return v + "-01-01T00:00:00";
        },
        "gMonthDay": function (v) {
            return "1972-" + v + "T00:00:00";
        },
        "gMonth": function (v) {
            return "1972-" + v + "-01T00:00:00";
        },
        "gDay": function (v) {
            return "1972-01-" + v + "T00:00:00";
        }
    };

    // Add padding zeros to fractional seconds part of time to get around Nashorn milliseconds issue
    function padFracSec(str) {
        if (str.indexOf('.', str.length - 4) != -1) {
            var parts = str.split('.');
            var ms = parts[1];
            while (ms.length < 3) {
                ms += "0";
            }
            str = parts[0] + '.' + ms;
        }
        return str;
    }

    /**
     * Checks that a date is valid
     * @param parts the date as an array [YYYY, MM, DD, hh, mm, ss]
     * @returns boolean true if the date is valid
     */
    
    function isValidDate(parts) {
        var y = parts[0],
            m = parts[1],
            d = parts[2],
            h = parts[3],
            mm = parts[4],
            s = parts[5],
            leap = (y % 4 === 0) && !(y % 100 === 0 && !(y % 400 === 0));
        return !(m < 1 || m > 12 || d < 1 || d > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ||
        h >= 24 || mm >= 60 || s >= 60);
    }

    /**
     * Checks that a date is valid. The JS date class is too liberal, for example it treats 2015-02-29 as 2015-03-01.
     * @param str the date as a string of form YYYY-MM-DDThh:mm:ss.sss
     * @param orig the original date string for error messages
     * @throws an error if the date is not valid
     */
    
    function checkDate(str, orig) {
        //print("checkDate " + str);
        var parts = str.split(/[\-T:]/).map(function (s) {
            return parseFloat(s);
        });
        //print("parts " + parts);
        if (!isValidDate(parts)) {
            throw new XError("Invalid date " + orig, "FORG0001");
        } 
    }

    /**
     * Converts a date supplied as a string, to a XdmDateTime object.
     * @param str the date as a string of form YYYY-MM-DDThh:mm:ss.sss(Z|(+|-)hh:mm)
     * @param type the required type, subtype, or derived type of dateTime
     * @throws an error if the date is not valid
     * @returns XdmDateTime
     */
    
    function dateTimeFromString(str, type) {
        var result = str.match(dateTimeRegex[type]);
        //print("dateTimeFromString: " + str);
        if (result === null) {
            invalidValue(str, type);
        }
        var tzComponent = result[2] ? result[2] : "";
        //print("tzComponent: " + tzComponent);
        var expanded = dateConstructor[type](result[1]) + tzComponent;
        //print("expanded: " + expanded);
        if (/24:00:00(\.0+)?([Z\+\-]|$)/.test(expanded)) {
            // if type = "time", then 24:00 today becomes 00:00 today ("today" was constructed artificially anyway)
            // otherwise 24:00 today becomes 00:00 tomorrow
            if (type == "time") {
                expanded = expanded.substring(0, 10) + "T00:00:00";
            } else {
                expanded = Calculate["t+u"](dateTimeFromString(expanded.substring(0, 10), "date"),
                        durationFromString("P1D", "dayTimeDuration")).toString() + "T00:00:00";
            }
        }
        var bce = expanded.charAt(0) == "-";
        var date, parts;
        if (bce) {
            checkDate(expanded.substring(1, 20), str);
            parts = expanded.substr(1).split(/[\-T:]/).map(function (s) {
                return parseFloat(s);
            });
            date = new Date(Date.UTC(-parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]));
        } else {
            checkDate(expanded.substring(0, 19), str);
            var bits = expanded.split(/[\-T:]/);
            parts = expanded.split(/[\-T:]/).map(function (s) {
                return parseFloat(s);
            });
            var secs = parts[5],
                milli = secs - Math.floor(secs);
            //var milli = bits[5].match(/\.([0-9]{1,3})/);
            date = new Date(Date.UTC(bits[0], parts[1] - 1, parts[2], parts[3], parts[4], secs, Math.round(milli * 1000)));
            date.setUTCFullYear(bits[0]);
            /* if(milli == 0) {
             date = new Date(Date.UTC(parts[0],parts[1]-1,parts[2],parts[3],parts[4],secs));
             } else {
             date = new Date(Date.UTC(parts[0],parts[1]-1,parts[2],parts[3],parts[4],secs,milli*1000));
             }*/
            //date = new Date(expanded);
        }
        //print("dateTimeFromString(): date before adjustment " + date.toISOString());
        /* Note that a Date constructed from a string without any timezone part is assumed to be in UTC.
         But xs:dateTime with timezone component the empty sequence is assumed to be local.
         So make an adjustment.*/
        if (tzComponent === "") {
            var dummy = new Date();
            date = new Date(date.getTime() + dummy.getTimezoneOffset() * 60 * 1000);
            // replaced date by dummy
        } else { // if (tzComponent !== null)
            date = new Date(date.getTime() - tzStrToOffset(tzComponent) * 60 * 1000);
        }
        //print("dateTimeFromString(): date after adjustment " + date.toISOString());
        return new XdmDateTime(date, tzStrToOffset(result[2] ? result[2] : ""), type);
    }

    /**
     * Converts the timezone component string (from an xs:dateTime, etc) into a timezone offset as number of minutes,
     * or null if the timezone component is the empty string.
     * @param str the timezone component as a string//, or undefined if there was none
     * @throws an error if the timezone is not valid
     * @returns number of minutes, or null if str is empty //or undefined
     */

    function tzStrToOffset(str) {
        if (str === "") {
            return null;
        } else if (str == "Z") {
            return 0;
        } else {
            var tzParts = str.split(":"),
                hOffset = parseInt(tzParts[0], 10),
                neg = /^\-.*/.test(tzParts[0]),
                absH = Math.abs(hOffset),
                m = parseInt(tzParts[1], 10);
            //print("tzParts[0]: " + tzParts[0]);
            //print("hOffset: " + hOffset);
            if (absH > 14 || m > 59) {
                throw XError("Invalid timezone " + str, "FORG0001");
            }
            return (neg ? -1 : 1) * (absH * 60 + m);
        }
    }

    var p = function (str, multiplier) {
        return multiplier * (str === undefined ? 0 : parseInt(str, 10));
    };
    var pf = function (str, multiplier) {
        return multiplier * (str === undefined ? 0 : Math.round(parseFloat(str) * 1000));
    };
    var negate = function (num, condition) {
        return condition ? -num : num;
    };
    var durationConstructor = [
        function (result, str) {
            // duration minutes, yearMonthDuration minutes
            return negate(p(result[1], 12) + p(result[2], 1), str.match(/^\s*\-.*/));
        },
        function (result, str) {
            // duration milliseconds
            return negate(p(result[3], 24 * 60 * 60 * 1000) + p(result[4], 60 * 60 * 1000) + p(result[5], 60 * 1000) + pf(result[6], 1),
                str.match(/^\s*\-.*/));
        },
        function (result, str) {
            // dayTimeDuration milliseconds
            return negate(p(result[1], 24 * 60 * 60 * 1000) + p(result[2], 60 * 60 * 1000) + p(result[3], 60 * 1000) + pf(result[4], 1),
                str.match(/^\s*\-.*/));
        },
        function () {
            // dayTimeDuration minutes, yearMonthDuration milliseconds
            return 0;
        }];
    var durationIndex = {
        "duration": [0, 1],
        "dayTimeDuration": [3, 2],
        "yearMonthDuration": [0, 3]
    };

    function durationFromString(str, type) {
        var result = str.match(dateTimeRegex[type]);
        if (result === null || !/\d/.test(str) || /T$/.test(str)) {
            invalidValue(str, type);
        }
        return new XdmDuration(durationConstructor[durationIndex[type][0]](result, str),
            durationConstructor[durationIndex[type][1]](result, str), type);
    }

    function _init() {

        Atomic.double.NaN = Atomic.double.fromNumber(NaN);

        function populateHierarchy(name) {
            var t = typeInfo[name];
            while (t.base) {
                hierarchy[name + "<" + (t.base.name !== undefined ? t.base.name : t.base)] = 1;
                //print(name + "<" + t.base.name + " =1");
                t = t.base;
            }
            if (t == "decimal" || t == "double" || t == "float") {
                hierarchy[name + "<" + "numeric"] = 1;
            }
        }

        function addSubtype(name, baseName, predicate) {
            var t = typeInfo[name] = {};
            var base = typeInfo[baseName];
            t.name = name;
            t.base = base;
            t.matches = function (item) {
                return isSubtype(item.type, name);
            };
            t.downCast = function (item) {
                if (!predicate(item)) {
                    invalidValue(item.toString(), name);
                }
                item.type = name;
                return item;
            };

            t.fromString = function (str) {
                return t.downCast(base.fromString(str));
            };
            t.cast = function (item) {
                return t.downCast(base.cast(item));
            };

            populateHierarchy(name);
        }

        function addIntegerSubtype(name, baseName, predicate) {
            addSubtype(name, baseName, predicate);
            var t = typeInfo[name];
            var base = typeInfo[baseName];

            function downCast(item) {
                if (!predicate(item)) {
                    invalidValue(item.toString(), name);
                }
                item.type = name;
                return item;
            }

            t.fromNumber = function (num) {
                return downCast(base.fromNumber(num));
            };
        }

        function addStringSubtype(name, baseName, predicate, ws) {
            addSubtype(name, baseName, predicate);
            var t = typeInfo[name];
            var base = typeInfo[baseName];

            t.downCast = function (item) {
                var str = ws(item.toString());
                if (!predicate(str)) {
                    invalidValue(str, name);
                }
                return new XdmString(str, name);
            };

            t.fromString = function (str) {
                return t.downCast(base.fromString(ws(str)));
            };
        }

        function addDurationSubtype(name, baseName, predicate) {
            addSubtype(name, baseName, predicate);
            var t = typeInfo[name];
            var base = typeInfo[baseName];

            t.downCast = function (item) {
                if (item instanceof XdmDuration) {
                    return new XdmDuration(
                        name == "yearMonthDuration" ? item.months : 0,
                        name == "dayTimeDuration" ? item.milliseconds : 0,
                        name);
                }
                if (!predicate(item)) {
                    invalidValue(item.toString(), name);
                }
                item.type = name;
                return item;
            };

            t.fromMonthsMilliseconds = function (months, milliseconds) {
                return t.downCast(base.fromMonthsMilliseconds(months, milliseconds));
            };
            t.cast = function (item) {
                if (base.matches(item) /*&& !t.matches(item) */) {
                    return t.downCast(item);
                    //return t.fromMonthsMilliseconds(
                    //    name == "yearMonthDuration" ? base.months : 0,
                    //    name == "dayTimeDuration" ? base.milliseconds : 0);
                }
                if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                    return durationFromString(item.toString(), name);
                }
                return t.downCast(base.cast(item));
            };
        }

        addIntegerSubtype("nonPositiveInteger", "integer", function (item) {
            return item.toNumber() <= 0;
        });
        addIntegerSubtype("negativeInteger", "nonPositiveInteger", function (item) {
            return item.toNumber() < 0;
        });
        addIntegerSubtype("long", "integer", function (item) {
            var big = item.toBig();
            return big.cmp(Big("-9223372036854775808")) >= 0 && big.cmp(Big("9223372036854775807")) <= 0;
        });
        addIntegerSubtype("int", "long", function (item) {
            return item.toNumber() >= -2147483648 && item.toNumber() <= 2147483647;
        });
        addIntegerSubtype("short", "int", function (item) {
            return item.toNumber() >= -32768 && item.toNumber() <= 32767;
        });
        addIntegerSubtype("byte", "short", function (item) {
            return item.toNumber() >= -128 && item.toNumber() <= 127;
        });
        addIntegerSubtype("nonNegativeInteger", "integer", function (item) {
            return item.toNumber() >= 0;
        });
        addIntegerSubtype("positiveInteger", "nonNegativeInteger", function (item) {
            return item.toNumber() > 0;
        });
        addIntegerSubtype("unsignedLong", "nonNegativeInteger", function (item) {
            return item.toNumber() >= 0 && item.toBig().cmp(Big("18446744073709551615")) <= 0;
        });
        addIntegerSubtype("unsignedInt", "unsignedLong", function (item) {
            return item.toNumber() >= 0 && item.toBig().cmp(Big("4294967295")) <= 0;
        });
        addIntegerSubtype("unsignedShort", "unsignedInt", function (item) {
            return item.toNumber() >= 0 && item.toNumber() <= 65535;
        });
        addIntegerSubtype("unsignedByte", "unsignedShort", function (item) {
            return item.toNumber() >= 0 && item.toNumber() <= 255;
        });

        var wsReplace = function (str) {
            return str.replace(/[ \r\t\n]/g, ' ');
        };
        var ok = function () {
            return true;
        };
        addStringSubtype("normalizedString", "string", ok, wsReplace);
        addStringSubtype("token", "normalizedString", ok, Expr.wsCollapse);
        addStringSubtype("language", "token", function (v) {
                return /^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$/.test(v);
            },
            Expr.wsCollapse);
        addStringSubtype("NMTOKEN", "token", Regex.isNMTOKEN, Expr.wsCollapse);
        addStringSubtype("Name", "token", Regex.isName, Expr.wsCollapse);
        addStringSubtype("NCName", "Name", Regex.isNCName, Expr.wsCollapse);
        addStringSubtype("ID", "NCName", Regex.isNCName, Expr.wsCollapse);
        addStringSubtype("IDREF", "NCName", Regex.isNCName, Expr.wsCollapse);
        addStringSubtype("ENTITY", "NCName", Regex.isNCName, Expr.wsCollapse);


        addDurationSubtype("yearMonthDuration", "duration", function (item) {
            return item.milliseconds === 0;
        });
        addDurationSubtype("dayTimeDuration", "duration", function (item) {
            return item.months === 0;
        });

        typeInfo.dayTimeDuration.fromNumberOfMinutes = function (num) {
            return new XdmDuration(0, num * 60 * 1000, "dayTimeDuration");
        };

        typeInfo.showValue = showValue;
        typeInfo._init = function () {
        };
        // Do nothing on subsequent calls
    }

    typeInfo._init = _init;

    return typeInfo;
})
();
var Compare = function () {

    "use strict";

    function equalsWithNull(a, b) {
        //print("compare " + showValue(a) + " with " + showValue(b));
        if (a === null) {
            return b === null;
        } else if (b === null) {
            return false;
        } else {
            return a.equals(b);
        }
    }

    function gc(lhsIter, rhsArray, op, comparer) {
        var isNumeric = Atomic.numeric.matches;
        var isUA = Atomic.untypedAtomic.matches;
        var a;
        while ((a = lhsIter.next()) !== null) {
            var rhsIter = Iter.ForArray(rhsArray);
            var b;
            while ((b = rhsIter.next()) !== null) {
                //print("Comparing " + showValue(a) + " with " + showValue(b));
                var a2 = isUA(a) ? isUA(b) ? Atomic.string.cast(a) : isNumeric(b) ? Atomic.double.cast(a) : Atomic[b.type].cast(a) : a;
                var b2 = isUA(b) ? isUA(a) ? Atomic.string.cast(b) : isNumeric(a) ? Atomic.double.cast(b) : Atomic[a.type].cast(b) : b;
                 /* NaN comparisons are treated specially */
                 if ((isNumeric(a2) && isNaN(a2.value)) ||
                    (isNumeric(b2) && isNaN(b2.value))) {
                       continue;
                }
                if (testComparison(op, comparer.compare(a2, b2))) {
                    return Iter.oneBoolean(true);
                }
            }
        }
        return Iter.oneBoolean(false);
    }

    function generalComparison(expr, context, op) { //TODO does the export have more info really?
        var E = Expr;
        var lhsIter = E.evalChild1(expr, context);
        var rhsArray = E.evalChild2(expr, context).expand();
        var comparer = allocateCodedComparer(expr.getAttribute("comp"));
        if (!op) {
            op = expr.getAttribute("op");
        }
        return gc(lhsIter, rhsArray, op, comparer);
    }

    /**
     * Compare two values that implement the "compareTo" method
     */

    function comparableComparer(a, b) {
        //print("ComparableComparer " + showValue(a) + "~" + showValue(b));
        return a.compareTo(b);
    }

    /**
     * Handle null values. If either supplied value is null, return a result; if both
     * are non-null, delegate to the supplied comparer.
     * @param comparer the comparer that handles non-null values
     * @returns function - a comparer that can handle null values. Null compares equal to null, and collates
     * before any other value.
     */

    function nullable(comparer) {
        return function (a, b) {
            //print("nullable Comparer " + showValue(a) + "~" + showValue(b));
            if (a === null || b === null) {
                return a === null ? (b === null ? 0 : -1) : +1;
            } else {
                return comparer(a, b);
            }
        };
    }

    /**
     * Handle NaN values. If either supplied value is NaN, return a result; if both
     * are non-NaN, delegate to the supplied comparer.
     * @param comparer the comparer that handles non-NaN values
     * @returns function - a comparer that can handle null values. NaN compares equal to NaN, and collates
     * before any other value.
     */

    function NaNable(comparer) {
        return function (a, b) {
            if (itemIsNaN(a) || itemIsNaN(b)) {
                return itemIsNaN(a) ? (itemIsNaN(b) ? 0 : -1) : +1;
            } else {
                return comparer(a, b);
            }
        };
    }

    /**
     * Create a comparer that compares using the item's compareTo method for all types except
     * strings; in the case of strings, delegate the comparison to the supplied collator
     * @param collator a comparer that compares strings
     * @returns function - a general-purpose comparer
     */

    function general(collator) {
        var au = Atomic.untypedAtomic, as = Atomic.string;
        return function (a, b) {
            if (as.matches(a) || au.matches(b)) {
                return collator(a, b);
            } else {
                return comparableComparer(a, b);
            }
        };
    }

    /**
     * Comparer implementing codepoint collation
     * @param s1 an xs:string value
     * @param s2 another xs:string value
     * @returns number - the result of the comparison
     */

    function codePointComparison(s1, s2) {
        //print("codepoint compare " + s1 + " to " + s2);
        var E = Expr;
        var a1 = E.stringToCodepoints(s1.toString()), a2 = E.stringToCodepoints(s2.toString());
        var i = 0;
        while (true) {
            //print("i " + i + " c1 " + a1[i] + " c2 " + a2[i]);
            if (i == a1.length) {
                return (i == a2.length ? 0 : -1);
            } else if (i == a2.length) {
                return +1;
            } else {
                if (a1[i] != a2[i]) {
                    return a1[i] - a2[i];
                }
            }
            i++;
        }
    }


    /**
     * Sort a sequence
     * @param expr the <sort> expression in the stylesheet tree
     * @param context the evaluation context
     * @returns an iterator over the sorted items
     */

    function sortSequence(expr, context) {
        var DU = DomUtils;
        var base = Iter.Tracker(Expr.evalChild1(expr, context));
        var array = [];
        var sortKeys = DU.getChildElements(expr, "sortKey");
        var comparers = sortKeys.map(function (s) {
            return allocateComparer(s, context);
        });
        var c2 = context.newContext(false);
        c2.tempOutputState = "sort key";
        c2.focus = base;
        var converters = sortKeys.map(function (sk) {
            var dtExpr = Expr.argRole(sk, "dataType");
            var dataType = dtExpr === null ? null : Expr.evaluate(dtExpr, context).next();
            if (dataType == "number") {
                return function (item) {
                    return item === null ? null : Atomic.double.fromStringUnfailing(item.toString());
                };
            } else if (dataType == "text") {
                return function (item) {
                    return item === null ? null : Atomic.string.cast(item);
                };
            } else {
                return function (item) {
                    return item;
                };
            }
        });
        base.forEachItem(function (item) {
            var keys = sortKeys.map(function (s, pos) {
                return converters[pos](Expr.evalChild1(s, c2).next());
            });
            array.push({item: item, keys: keys});
        });
        array.sort(function (a, b) {
            var c;
            for (c = 0; c < comparers.length; c++) {
                var rel = comparers[c](a.keys[c], b.keys[c]);
                if (rel !== 0) {
                    return rel;
                }
            }
            return 0;
        });
        return Iter.ForArray(array).mapOneToOne(function (entry) {
            return entry.item;
        });
    }

    function convertToNumber(item, failIfInvalid) {
        if (item === null) {
            return Atomic.double.NaN;
        } else if (Atomic.numeric.matches(item)) {
            return item.toNumber();
        } else if (failIfInvalid) {
            return Atomic.double.fromString(item.toString()).toNumber();
        } else {
            return Atomic.double.fromStringUnfailing(item.toString()).toNumber();
        }
    }

    function compareNumericFailing(a, b) {
        var an = convertToNumber(a, true), bn = convertToNumber(b, true);
        if (itemIsNaN(an)) {
            return itemIsNaN(bn) ? 0 : -1;
        } else if (itemIsNaN(bn)) {
            return +1;
        } else {
            return an - bn;
        }
    }

    function compareNumeric(a, b) {
        var an = convertToNumber(a, false), bn = convertToNumber(b, false);
        if (itemIsNaN(an)) {
            return itemIsNaN(bn) ? 0 : -1;
        } else if (itemIsNaN(bn)) {
            return +1;
        } else {
            return an - bn;
        }
    }

    function caseBiasedCompare(comparer, lowerFirst) {
        return function (a1, a2) {
            var s1 = a1.toString(), s2 = a2.toString();
            var t1 = s1.toLowerCase(), t2 = s2.toLowerCase();
            var comp = comparer(t1, t2);
            if (comp === 0) {
                for (var i = 0; i < s1.length; i++) {
                    if (s1.charAt(i) != s2.charAt(i)) {
                        return (lowerFirst == (s1.charAt(i) == s1.charAt(i).toLowerCase())) ? -1 : 1;
                    }
                }
                return 0;
            } else {
                return comp;
            }
        };
    }

    // returns an object with compare and equals methods
    function allocateCodedComparer(code) {
        //print("code in allocateCodedComparer " + code);
        var tokens = code.split("|");
        if (tokens[0] == "DESC") {
            var asc = allocateCodedComparer(code.slice(5));
            return {
                equals: asc.equals,
                compare: function (a, b) {
                    return asc.compare(b, a);
                }
            };
        }


        var codedComparer = {};
        switch (tokens[0]) {
            case "NC":
                // convert to number, then compare numerically
                codedComparer.compare = compareNumeric;
                codedComparer.equals = function (a, b) {
                    var an = convertToNumber(a, false), bn = convertToNumber(b, false);
                    if (isNaN(an)) {
                        return isNaN(bn);
                    } else if (isNaN(bn)) {
                        return false;
                    } else {
                        return an - bn === 0;
                    }
                };
                return codedComparer;
            case "QUNC":
                // convert to number (throw error if not convertible), then compare numerically
                codedComparer.compare = compareNumericFailing;
                codedComparer.equals = function (a, b) {
                    var an = convertToNumber(a, true), bn = convertToNumber(b, true);
                    if (isNaN(an)) {
                        return isNaN(bn);
                    } else if (isNaN(bn)) {
                        return false;
                    } else {
                        return an - bn === 0;
                    }
                };
                return codedComparer;
            case "DblSC":
                // numeric comparison
                codedComparer.compare = NaNable(function (a, b) {
                    return a.toNumber() - b.toNumber();
                });
                codedComparer.equals = function (a, b) {
                    var an = a.toNumber(), bn = b.toNumber();
                    if (isNaN(an)) {
                        return isNaN(bn);
                    } else if (isNaN(bn)) {
                        return false;
                    } else {
                        return an - bn === 0;
                    }
                };
                return codedComparer;
            case "CCC":
            // codepoint-collation comparison
            case "TEXT":
                // ignore collation for now
                codedComparer.compare = nullable(function (a, b) {
                    if (a.value.toString() < b.value.toString()) {
                        return -1;
                    } else if (a.value.toString() == b.value.toString()) {
                        return 0;
                    } else {
                        return +1;
                    }
                });
                codedComparer.equals = function (a, b) {
                    if (a === null) {
                        return b === null;
                    } else if (b === null) {
                        return false;
                    } else {
                        return a.value.toString() == b.value.toString();
                    }
                };
                return codedComparer;
            case "CAVC":
            case "DecSC":
            case "GAC":
            case "AtSC":
            case "CalVC":
                return {
                    compare: nullable(NaNable(comparableComparer)),
                    equals: equalsWithNull
                };


            case "EQC":
                codedComparer.equals = equalsWithNull;
                codedComparer.compare = function (a, b) {
                    return codedComparer.equals(a, b) ? 0 : 1;
                };
                return codedComparer;

            default:
                throw new XError("Unknown comparer " + code, "SXJS0003");
        }
    }

    function allocateComparer(sortKey, context) {
        var E = Expr;

        var comp = null;
        if (sortKey.hasAttribute("comp")) {
            comp = sortKey.getAttribute("comp");
            comp = comp.replace(/^DESC\|/, "");
        }
        //    var order = E.evaluate(E.argRole(sortKey, "order"), context).next().toString();
        //    if (order == "descending" && !/^DESC/.test(code)) {
        //        code = "DESC|" + code;
        //    }
        //    if (!/^CAC\|http:\/\/saxon.sf.net\/collation\?/.test(code)) {
        //        return allocateCodedComparer(code).compare;
        //    }
        //    // Drop through comp=CAC with a Saxon collation, since this is just derived from the
        //    // xsl:sort attributes which are still available in their own right. (See test avt-1001)
        //}
        var order = E.evaluateIfPresent(E.argRole(sortKey, "order"), context).next();
        var lang = E.evaluateIfPresent(E.argRole(sortKey, "lang"), context).next();
        var caseOrder = E.evaluateIfPresent(E.argRole(sortKey, "caseOrder"), context).next();
        var dataType = E.evaluateIfPresent(E.argRole(sortKey, "dataType"), context).next();

        order = order === null ? "ascending" : order.toString();
        try {
            lang = (lang === null || lang.toString() === "") ? null : Atomic.language.fromString(lang.toString());
        } catch (e) {
            throw XError("xsl:sort/@lang: " + e.message, "XTDE0030");
        }
        caseOrder = caseOrder === null ? "#default" : caseOrder.toString();
        dataType = dataType === null ? null : dataType.toString();
        //print("order: " + order);
        //print("lang: " + lang);
        //print("caseOrder: " + caseOrder);
        //print("dataType: " + dataType);


        var stringComparer = codePointComparison;
        if (caseOrder != "#default") {
            stringComparer = caseBiasedCompare(stringComparer, caseOrder == "lower-first");
        }

        /**
         * Invert a supplied comparer if order="descending"
         * @param comparer the supplied comparer
         * @returns function - the supplied comparer if order=ascending, or the inverse comparer otherwise
         */

        function directed(comparer) {
            if (order == "descending") {
                return function (a, b) {
                    return comparer(b, a);
                };
            } else {
                return comparer;
            }
        }

        if (dataType == "number") {
            return directed(compareNumeric);
        } else if (dataType == "text") {
            var textComparer = function (a, b) {
                //print("tc " + showValue(a) + ":" + showValue(b) + "=" + stringComparer(Atomic.string.cast(a), Atomic.string.cast(b)));
                return stringComparer(Atomic.string.cast(a), Atomic.string.cast(b));
            };
            return directed(nullable(textComparer));
        } else {
            if (comp) {
                if (comp == "DblSC") {
                    return directed(nullable(NaNable(comparableComparer)));
                } else if (comp == "CalVC" || comp == "DecSC") {
                    return directed(nullable(comparableComparer));
                } else if (comp == "CCC") {
                    return directed(nullable(stringComparer));
                }
            }
            return directed(general(stringComparer));
        }


        // Support in browsers is inconsistent, and in Nashorn non-existent...
        //if (!(typeof Intl === "undefined")) {
        //    return directed(Intl.Collator(lang, {caseFirst: replace(caseOrder, "-first", "")}).compare);
        //} else {
        //    return directed(function (a, b) {
        //        return a.toString().localeCompare(b.toString(), lang, {caseFirst: caseOrder});
        //    })
        //}

    }

    // Test the result of a comparison operation: e.g. if relation is +1, and op is ">", result is true.
    function testComparison(op, relation) {
        switch (op) {
            case "=":
            case "eq":
                return relation === 0;
            case "<":
            case "lt":
                return relation < 0;
            case ">":
            case "gt":
                return relation > 0;
            case ">=":
            case "ge":
                return relation >= 0;
            case "<=":
            case "le":
                return relation <= 0;
            case "!=":
            case "ne":
                return relation !== 0;
            default:
                throw new XError("Unknown operator " + op, "SXJS0003");
        }
    }

    // Test the result of a comparison operation: e.g. if relation is true, and op is "=", result is true.
    function testEquality(op, relation) {
        switch (op) {
            case "=":
            case "eq":
                return relation;
            case "!=":
            case "ne":
                return !relation;
            case "<":
            case "lt":
            case ">":
            case "gt":
            case ">=":
            case "ge":
            case "<=":
            case "le":
                throw new XError("Operator " + op + " not allowed for unordered types", "SXJS0003");
            default:
                throw new XError("Unknown operator " + op, "SXJS0003");
        }
    }

    // a, b - XDM types: Strings, Booleans, numeric types (is it also supposed to work for primitive types? Number, String etc)
    var comparisonFunction = {
        "=": function (a, b) {
            return a.equals(b);
        },
        "!=": function (a, b) {
            return !a.equals(b);
        },
        "<": function (a, b) {
            return a < b;
        },
        ">": function (a, b) {
            return a > b;
        },
        "<=": function (a, b) {
            return a <= b;
        },
        ">=": function (a, b) {
            return a >= b;
        }
    };

    comparisonFunction.eq = comparisonFunction["="];
    comparisonFunction.ne = comparisonFunction["!="];
    comparisonFunction.le = comparisonFunction["<="];
    comparisonFunction.ge = comparisonFunction[">="];
    comparisonFunction.lt = comparisonFunction["<"];
    comparisonFunction.gt = comparisonFunction[">"];


    function itemIsNaN(item) {
        return (Atomic.double.matches(item) || Atomic.float.matches(item)) && isNaN(item.toNumber());
    }

    function bothItemsAreNaN(a, b) {
        return itemIsNaN(a) && itemIsNaN(b);
    }

    /**
     * Test if two sequences are deep-equal
     * @param iter1 iterator over the first sequence
     * @param iter2 iterator over the second sequence
     * @param collationEq equals function determined by a collation (default codepoint)
     * @returns boolean: true if the two sequences are deep-equal
     */

    function deepEqualSequences(iter1, iter2, collationEq) {

        var e1 = iter1.expand();
        var e2 = iter2.expand();
        //print("Deep-eq lengths " + e1.length + "," + e2.length);
        //print("e1: " + showValue(e1));
        //print("e2: " + showValue(e2));
        iter1 = Iter.ForArray(e1);
        iter2 = Iter.ForArray(e2);
        var item1;
        var item2;
        while (true) {
            item1 = iter1.next();
            item2 = iter2.next();
            if (item1 === null) {
                return item2 === null;
            }
            if (item2 === null) {
                return false;
            }
            //print("Deep-eq compare 1: " + showValue(item1));
            //print("Deep-eq compare 2: " + showValue(item2));
            if (!deepEqualItems(item1, item2, collationEq)) {
                //print("Not equal");
                return false;
            }
        }
    }

    function isSameNodeType(type1, type2) {
        var DU = DomUtils;
        return type1 == type2 || (type1 == DU.DOCUMENT_NODE && type2 == DU.DOCUMENT_FRAGMENT_NODE) ||
            (type2 == DU.DOCUMENT_NODE && type1 == DU.DOCUMENT_FRAGMENT_NODE);
    }

    /**
     * Test if two items are deep-equal
     * @param item1 the first item
     * @param item2 the second item
     * @param collationEq equals function determined by a collation (default codepoint), used for comparing JS strings (not names)
     * @returns boolean - true if the two items are deep-equal
     */

    function deepEqualItems(item1, item2, collationEq) {
        //print("Deep equal items " + showValue(item1) + " == " + showValue(item2));
        var DU = DomUtils;
        if (item1 === item2) {
            return true;
        } else if (DU.isNode(item1)) {
            if (!(DU.isNode(item2) && isSameNodeType(item1.nodeType, item2.nodeType))) {
                return false;
            }
            switch (item1.nodeType) {
                case DU.DOCUMENT_NODE:
                case DU.DOCUMENT_FRAGMENT_NODE:
                    return deepEqualSequences(Axis.child(item1), Axis.child(item2));
                case DU.ELEMENT_NODE:
                    //print("compare " + item1 + " with " + item2);
                    if (!DU.nameOfNode(item1).equals(DU.nameOfNode(item2))) {
                        return false;
                    }
                    // Compare the attributes
                    var atts1 = Axis.attribute(item1).expand();
                    if (atts1.length != Axis.attribute(item2).count()) {
                        return false;
                    }
                    var a;
                    for (a = 0; a < atts1.length; a++) {
                        var att = atts1[a];
                        var attName = DU.nameOfNode(att);
                        var uri = attName.uri ? attName.uri : "";
                        //print("Checking existence of @Q{" + attName.uri + "}" + attName.local);
                        if (!item2.hasAttributeNS(uri, attName.local)) {
                            //print("Not present in second tree");
                            return false;
                        }
                        if (item2.getAttributeNS(uri, attName.local) != att.value) {
                            //print("Not equal att: " + item2.getAttributeNS(uri, attName.local) + " != " + att.value);
                            return false;
                        }
                    }
                    return deepEqualSequences(Axis.child(item1), Axis.child(item2));
                case DU.ATTRIBUTE_NODE:
                    return DU.nameOfNode(item1).equals(DU.nameOfNode(item2)) && item1.value == item2.value;
                case DU.NAMESPACE_NODE:
                    return item1.prefix == item2.prefix && item1.uri == item2.uri;
                case DU.PROCESSING_INSTRUCTION_NODE:
                    if (collationEq) {
                        return item1.target == item2.target && collationEq(item1.textContent, item2.textContent);
                    } else {
                        return item1.target == item2.target && item1.textContent == item2.textContent;
                    }
                case DU.TEXT_NODE:
                case DU.COMMENT_NODE:
                    if (collationEq) {
                        return collationEq(item1.textContent, item2.textContent);
                    } else {
                        return item1.textContent == item2.textContent;
                    }
                default:
                    throw new XError("Unknown node type " + item1.nodeType, "SXJS0003");
            }
        } else if (Expr.isArray(item1)) {
            if (!(Expr.isArray(item2) && item2.value.length == item1.value.length)) {
                return false;
            }
            for (var k = 0; k < item1.value.length; k++) {
                //print("deepEq array item " + k);
                if (!deepEqualSequences(Iter.ForArray(item1.value[k]), Iter.ForArray(item2.value[k], collationEq))) {
                    //print("deepEq array item " + k + " differs: " + showValue(item1.value[k]) + " vs " + showValue(item2.value[k]));
                    return false;
                }
            }
            //print("deepEq: arrays are equal");
            return true;
        } else if (Expr.isMap(item1)) {
            if (!(Expr.isMap(item2))) {
                return false;
            }
            var keys1 = item1.keys();
            var keys2 = item2.keys();
            if (keys1.length != keys2.length) {
                //print("Number of keys differs " + keys1.length + "!=" + keys2.length);
                return false;
            }
            //print("k1 " + showValue(keys1));
            //print("k2 " + showValue(keys2));
            return Iter.ForArray(keys1).every(function(k) {
                return item2.containsKey(k) && deepEqualSequences(Iter.ForArray(item1.get(k)), Iter.ForArray(item2.get(k)));
                    //var present = item2.containsKey(k);
                    //if (!present) {
                    //    print("Key " + showValue(k) + " is in first map but not second");
                    //    return false;
                    //}
                    //if (!deepEqualSequences(Iter.ForArray(item1.get(k)), Iter.ForArray(item2.get(k)))) {
                    //    print("Key " + showValue(k) + " has different associated values");
                    //    return false;
                    //}
                    //print("key " + showValue(k) + " ok");
                    //return true;
                });
        } else if (itemIsNaN(item1) && itemIsNaN(item2)) {
            return true;
        } else if (collationEq && Atomic.string.matches(item1) && Atomic.string.matches(item2)) {
            return collationEq(item1.value, item2.value);
        } else {
            try {
                return item1.equals(item2);
            } catch (e) {
                return false;
            }
        }
    }

    /**
     * Compare two sequences of atomic values as described in the rules for array:sort
     * @param a iterator over a sequence of atomic values
     * @param b iterator over a sequence of atomic values
     * @param collationObj a collation object, or undefined
     * @return number, one of (-1, 0, +1) based on the result of the comparison
     */

    function lexicographicCompare(a, b, collationObj) {
        var a0 = a.next(), b0 = b.next();
        while (true) {
            //print("compare items " + showValue(a0) + " to " + showValue(b0));
            if (a0 === null) {
                return b0 === null ? 0 : -1;
            }
            if (b0 === null) {
                return 1;
            }
            if (collationObj) {
                if (deepEqualItems(a0, b0, collationObj.equals)) {
                    a0 = a.next();
                    b0 = b.next();
                } else if (itemIsNaN(a0)) {
                    return -1;
                } else {
                    if (Atomic.string.matches(a0) && Atomic.string.matches(b0)) {
                        return collationObj.compare(a0.value, b0.value);
                    } else {
                        return a0.compareTo(b0);
                    }
                }
            } else {
                if (deepEqualItems(a0, b0)) {
                    a0 = a.next();
                    b0 = b.next();
                } else if (itemIsNaN(a0)) {
                    return -1;
                } else {
                    return a0.compareTo(b0);
                }
            }
        }
    }


    /**
     * Perform grouping (xsl:for-each-group)
     */

    function grouping(expr, context) {
        var pop = Iter.Tracker(Expr.evaluate(Expr.argRole(expr, "select"), context));
        var popContext = context.newContext(false);
        popContext.focus = pop;

        /**
         * Construct the groups, as an array. This consumes the "pop" (population) iterator
         * @param process callback to process each item; it is called with (a) the current array
         * of groups, and (b) the next item to be processed. It typically adds the item to one
         * or more of the groups.
         * @returns Array - An array of groups. Each group is an object with a "group" property
         * holding the contents of the group, and (where relevant) a "key" property
         * holding the grouping key.
         */
        function makeGroups(process) {
            var groups = [];
            pop.forEachItem(function (item) {
                process(groups, item);
            });
            return groups;
        }

        var algorithms = {

            starting: function () {
                var pattern = makePattern(Expr.argRole(expr, "match"));
                return makeGroups(function (groups, item) {
                    if (pop.position == 1 || pattern(item, popContext)) {
                        groups.push({group: [item]});
                    } else {
                        groups[groups.length - 1].group.push(item);
                    }
                });
            },

            ending: function () {
                var pattern = makePattern(Expr.argRole(expr, "match"));
                var startNew = false;
                return makeGroups(function (groups, item) {
                    if (pop.position == 1 || startNew) {
                        groups.push({group: [item]});
                    } else {
                        groups[groups.length - 1].group.push(item);
                    }
                    //print("testing " + item + " = " + pattern(item, popContext));
                    startNew = pattern(item, popContext);
                });
            },

            adjacent: function () {
                var keyDef = Expr.argRole(expr, "key");
                var currentKey = null;
                return makeGroups(function (groups, item) {
                    var key = Expr.evaluate(keyDef, popContext).expand();
                    //print("key " + showValue(key));
                    if (pop.position == 1 || !deepEqualSequences(Iter.ForArray(key), Iter.ForArray(currentKey))) {
                        groups.push({group: [item], key: key});
                        currentKey = key;
                    } else {
                        groups[groups.length - 1].group.push(item);
                    }
                });
            },

            by: function () {
                var keyDef = Expr.argRole(expr, "key");
                var index = new HashTrie();
                return makeGroups(function (groups, item) {
                    var groupId, added = [];
                    Expr.evaluate(keyDef, popContext).forEachItem(function (key) {
                        //print("Grouping key " + key.toString());
                        if (index.containsKey(key)) {
                            groupId = index.get(key);
                            //print("add to existing group " + groupId);
                            if (added.findIndex(function (ix) {
                                    return ix == groupId;
                                }) < 0) {
                                groups[groupId].group.push(item);
                                added.push(groupId);
                            } else {
                                //print("already present in group")
                            }
                        } else {
                            //print("create new group");
                            groupId = groups.length;
                            groups.push({group: [item], key: [key]});
                            index.inSituPut(key, groupId);
                            added.push(groupId);
                        }
                    });
                });
            },

            by_c: function () {
                // Composite keys
                var keyDef = Expr.argRole(expr, "key");
                var index = new HashTrie();
                index.options = {
                    sameKey: function (a, b) {
                        return deepEqualSequences(Iter.ForArray(a), Iter.ForArray(b));
                    },
                    hash: function (a) {
                        return a.map(function (item) {
                            return item.hashCode();
                        }).join();
                    }
                };
                return makeGroups(function (groups, item) {
                    var groupId, key = Expr.evaluate(keyDef, popContext).expand();
                    if (index.containsKey(key)) {
                        groupId = index.get(key);
                        //print("add to existing group " + groupId);
                        groups[groupId].group.push(item);
                    } else {
                        //print("create new group");
                        groupId = groups.length;
                        groups.push({group: [item], key: key});
                        index.inSituPut(key, groupId);
                    }
                });
            }

        };

        algorithms.adjacent_c = algorithms.adjacent;
        var algo = expr.getAttribute("algorithm") + (Expr.hasFlag(expr, "c") ? "_c" : "");
        var groups = algorithms[algo]();

        //print("No of groups: " + groups.length);

        // Next stage is to sort the groups (if requested).

        var sortKeys = DomUtils.getChildElements(expr, "sortKey");
        if (sortKeys.length > 0) {
            var unsortedGroupIter = Iter.Tracker(Iter.ForArray(groups));
            var unsortedGroupContext = context.newContext(false);

            unsortedGroupContext.focus = unsortedGroupIter;

            var comparers = sortKeys.map(function(sk) {
                return allocateComparer(sk, context);
            });

            unsortedGroupIter.forEachItem(function (groupInfo, pos) {
                groupInfo.sortKeys =
                    sortKeys.map(function (s) {
                        var f = unsortedGroupContext.focus;
                        f.current = groupInfo.group[0];
                        f.position = pos + 1;
                        f.currentGroup = groupInfo.group;
                        f.currentGroupingKey = groupInfo.key;
                        return Expr.evalChild1(s, unsortedGroupContext).next();
                    });
            });

            groups.sort(function (a, b) {
                //print("compare group " + a.key + " sk=" + a.sortKeys[0] + " with " + b.key + " sk=" + b.sortKeys[0]);
                for (var c = 0; c < comparers.length; c++) {
                    var rel = comparers[c](a.sortKeys[c], b.sortKeys[c]);
                    //print("compare " + a.sortKeys[c] + " to " + b.sortKeys[c] + " : " + rel);
                    if (rel < 0) {
                        return -1;
                    } else if (rel > 0) {
                        return +1;
                    }
                }
                return 0;
            });

        }

        var sortedGroupContext = context.newContext(false);
        sortedGroupContext.focus = Iter.Tracker(Iter.ForArray(groups));

        /* Create an iterator for the entire group sequence, evaluated eagerly
        This overcomes issues of buried lazy evaluations sharing common,
        group-sensitive variables  between separate groups
        (Bug #2945)
        */ 
        var action = Expr.argRole(expr, "content");
        var result = [];
        var gp;
        var gpIndex = 0;
        while ((gp = sortedGroupContext.focus.next()) !== null) {
            var groupInfo = groups[gpIndex++];
            var f = sortedGroupContext.focus;
            f.current = groupInfo.group[0];
            f.position = gpIndex;
            sortedGroupContext.currentGroup = groupInfo.group;
            sortedGroupContext.currentGroupingKey = groupInfo.key;
            Array.prototype.push.apply(result,(Expr.evaluate(action, sortedGroupContext).expand()));
        }

        // Return an iterator over the entire sequence.
        return Iter.ForArray(result);

    }

    /* Checks for a supplied collation. Returns true if one is supplied, false otherwise.
     * The collation may be specified on an attribute of expr, if it is known at compile time,
     * or otherwise a child arg (so if not here, arg is undefined). */

    function hasCollation(expr, arg) {
        return (expr.hasAttribute("collation") || arg) ? true : false;
    }

    /* Returns a collation object. The default is codepoint collation.
     * The collation may be specified on an attribute of expr, if it is known at compile time, 
     * or otherwise a child arg (so if not here, arg is undefined). */

    function getCollation(expr, arg) {
        var collation = expr.hasAttribute("collation") ? expr.getAttribute("collation") : null;
        if (!collation && arg) {
            collation = arg.next().toString();
        }
        // TODO resolve relative collations (against static base uri)
        if (collation == "http://www.w3.org/2005/xpath-functions/collation/html-ascii-case-insensitive" ||
            collation == "http://www.w3.org/2010/09/qt-fots-catalog/collation/caseblind" ) {
            return caseblindCollation();
        } else if (!collation || collation == "http://www.w3.org/2005/xpath-functions/collation/codepoint" ||
            codepointCollation().startsWith(collation, "http://www.w3.org/2013/collation/UCA")) {
            // if codepoint, or default, including fallback for UCA collations
            return codepointCollation();
        } else {
            throw XError("Unrecognized collation", "FOCH0002");
        }
    }

    function codepointCollation() {
        function compareStrings(a, b) {
            if (Expr.isAstral(a) || Expr.isAstral(b)) {
                var comp = Compare.codePointComparison(a, b);
                return comp < 0 ? -1 : comp === 0 ? 0 : +1;
            } else {
                return a < b ? -1 : a == b ? 0 : +1;
            }
        }
        return {
            equals: function (a, b) {
                return compareStrings(a, b) === 0;
            },
            compare: function (a, b) {
                return compareStrings(a, b);
            },
            containsToken: function (a, b) {
                return a.split(/[ \n\r\t]+/).findIndex(function (s) {
                        return s == b;
                    }) >= 0;
            },
            contains: function (a, b) {
                return a.indexOf(b) != -1;
            },
            startsWith: function (a, b) {
                return a.substring(0, b.length) == b;
            },
            endsWith: function (a, b) {
                return a.substring(a.length - b.length) == b;
            },
            indexOf: function (a, b) {
                return a.indexOf(b);
            },
            collationKey: function(a) {
                return a;
            },
            deepEqual: Compare.deepEqualSequences, // iterators
            deepEqualItems: Compare.deepEqualItems // iterators
        };
    }

    function caseblindCollation() { 
        // normalize and then use codepoint
        function normalize(str) {
            // does not work with non ASCII
            // TODO is string ever undefined or null?
            //return str ? (str + '').toUpperCase() : '';
            return str.toUpperCase();
        }
        function equals(str1, str2) {
            return normalize(str1) === normalize(str2);
        }
        return {
            equals: equals,
            compare: function (a, b) {
                return codepointCollation().compare(normalize(a), normalize(b));
            },
            containsToken: function (a, b) {
                return a.split(/[ \n\r\t]+/).findIndex(function (s) {
                        return normalize(s) == normalize(b);
                    }) >= 0;
            },
            contains: function (a, b) {
                return codepointCollation().contains(normalize(a), normalize(b));
            },
            startsWith: function (a, b) {
                return codepointCollation().startsWith(normalize(a), normalize(b));
            },
            endsWith: function (a, b) {
                return codepointCollation().endsWith(normalize(a), normalize(b));
            },
            indexOf: function (a, b) {
                return codepointCollation().indexOf(normalize(a), normalize(b));
            },
            collationKey: function(a) {
                return normalize(a);
            },
            deepEqual: function (a, b) { // iterators
                return Compare.deepEqualSequences(a, b, equals);
            },
            deepEqualItems: function (a, b) { // iterators
                return Compare.deepEqualItems(a, b, equals);
            }
        };
    }

    return {
        allocateCodedComparer: allocateCodedComparer,
        codePointComparison: codePointComparison,
        deepEqualItems: deepEqualItems,
        deepEqualSequences: deepEqualSequences,
        gc: gc,
        generalComparison: generalComparison,
        grouping: grouping,
        itemIsNaN: itemIsNaN,
        lexicographicCompare: lexicographicCompare,
        bothItemsAreNaN: bothItemsAreNaN,
        sortSequence: sortSequence,
        testComparison: testComparison,
        testEquality: testEquality,
        getCollation: getCollation,
        hasCollation: hasCollation,
        codepointCollation: codepointCollation,
        caseblindCollation: caseblindCollation
    };


}();

var NAMESPACE_NODE = 13;

function NamespaceNode(prefix, uri, parent) {
    this.prefix = prefix === null ? "" : prefix;
    this.uri = uri === null ? "" : uri;
    if (parent) {
        this.parentNode = parent;
    }
}

NamespaceNode.prototype = {
    prefix: null,
    uri: null,
    parentNode: null,
    nodeType: NAMESPACE_NODE
};

var ATTRIBUTE_NODE = 2;

function AttributeNode(qname, value, parent) {
    this.qname = qname;
    this.value = value;
    this.parent = parent;
    this.name = this.qname.toString();
    this.namespaceURI = this.qname.uri;
    this.localName = this.qname.local;
    this.prefix = this.qname.prefix;

}

AttributeNode.prototype = {
    qname: null,
    value: null,
    parent: null,
    nodeType: ATTRIBUTE_NODE
};
var DomUtils = function () {

    "use strict";

    var nextDocumentNumber = 1;

    return {

        ELEMENT_NODE: 1,
        ATTRIBUTE_NODE: 2,
        TEXT_NODE: 3,
        CDATA_SECTION: 4,
        PROCESSING_INSTRUCTION_NODE: 7,
        COMMENT_NODE: 8,
        DOCUMENT_NODE: 9,
        DOCUMENT_TYPE_NODE: 10,
        DOCUMENT_FRAGMENT_NODE: 11,
        NAMESPACE_NODE: 13,

        shallowCopy: function (item, context, flags, makeContent) {
            //print("shallowCopy "+ item);
            if (DomUtils.isNode(item)) {
                var newNode, nodeName;
                switch (item.nodeType) {
                    case DomUtils.DOCUMENT_NODE:
                    case DomUtils.DOCUMENT_FRAGMENT_NODE:
                        newNode = context.resultDocument.createDocumentFragment();
                        var c2 = context.newContext(false);
                        //print("calling makeContent " + c2);
                        Expr.makeComplexContent(newNode, makeContent(c2), context);
                        break;
                    case DomUtils.ELEMENT_NODE:
                        nodeName = DomUtils.nameOfNode(item);
                        newNode = context.createElement(nodeName.uri, nodeName.toString());
                        // Note: In browser, all namespaces get dropped for an HTMLElement
                        if (flags && flags.indexOf('c') >= 0 && !(SaxonJS.getPlatform().inBrowser && newNode instanceof HTMLElement)) {
                            DomUtils.inScopeNamespaces(item).forEach(function (pair) {
                                DomUtils.declareNS(newNode, pair.prefix, pair.uri);
                            });
                        }
                        newNode._saxonBaseUri = DomUtils.baseURI(item);
                        // Note: In browser, all namespaces get dropped for an HTMLElement
                        //print("calling makeContent " + context);
                        Expr.makeComplexContent(Expr.markLocal(newNode, flags), makeContent(context), context);
                        break;
                    case DomUtils.ATTRIBUTE_NODE:
                        newNode = new AttributeNode(DomUtils.nameOfNode(item), item.value, null);
                        break;
                    case DomUtils.TEXT_NODE:
                        newNode = context.resultDocument.createTextNode(item.textContent);
                        break;
                    case DomUtils.COMMENT_NODE:
                        newNode = context.resultDocument.createComment(item.textContent);
                        break;
                    case DomUtils.PROCESSING_INSTRUCTION_NODE:
                        newNode = context.resultDocument.createProcessingInstruction(item.target, item.textContent);
                        break;
                    case DomUtils.NAMESPACE_NODE:
                        newNode = new NamespaceNode(item.prefix, item.uri);
                        break;
                    default:
                        throw XError("Unknown node type " + item.nodeType, "SXJS0003");
                }
                return Iter.Singleton(Expr.markLocal(newNode, flags));
            } else {
                return Iter.Singleton(item);
            }
        },

        copyItem: function (item, context, flags) {
            //print("copyItem " + item);
            if (DomUtils.isNode(item)) {
                //print("copying node of type " + item.nodeType);
                var docNode, newNode, nodeName;
                switch (item.nodeType) {
                    case DomUtils.DOCUMENT_NODE:
                    case DomUtils.DOCUMENT_FRAGMENT_NODE:
                        var doc = context.resultDocument.createDocumentFragment();
                        docNode = DomUtils.obtainDocumentNumber(doc);
                        docNode._saxonBaseUri = item._saxonBaseUri;
                        Expr.makeComplexContent(docNode, Axis.child(item).mapOneToOne(function (n) {
                            return DomUtils.copyItem(n, context, flags);
                        }), context);
                        return Expr.markLocal(docNode, flags);
                    case DomUtils.NAMESPACE_NODE:
                        return new NamespaceNode(item.prefix, item.uri);
                    case DomUtils.ELEMENT_NODE:
                        nodeName = DomUtils.nameOfNode(item);
                        newNode = context.createElement(nodeName.uri, nodeName.toString());
                        // Note: In browser, all namespaces get dropped for an HTMLElement
                        if (flags && flags.indexOf('c') >= 0 && !(SaxonJS.getPlatform().inBrowser && newNode instanceof HTMLElement)) {
                            DomUtils.inScopeNamespaces(item).forEach(function (pair) {
                                DomUtils.declareNS(newNode, pair.prefix, pair.uri);
                            });
                        }
                        Axis.attribute(item).forEachItem(function (att) {
                            newNode.setAttributeNS(att.namespaceURI, att.name, att.value);
                        });
                        Axis.child(item).forEachItem(function (child) {
                            newNode.appendChild(DomUtils.copyItem(child, context, flags));
                        });
                        newNode._saxonBaseUri = DomUtils.baseURI(item);
                        return Expr.markLocal(newNode, flags);
                    case DomUtils.DOCUMENT_TYPE_NODE:
                        return null;
                    case DomUtils.ATTRIBUTE_NODE:
                        return new AttributeNode(DomUtils.nameOfNode(item), item.value, null);
                    default:
                        // default for TEXT_NODE, PROCESSING_INSTRUCTION_NODE, COMMENT_NODE, (CDATA_SECTION)
                        //print("copyItem default item: " + item);
                        newNode = SaxonJS.getPlatform().inBrowser ? window.document.importNode(item, true) : cloneNode(context.resultDocument, item, true);
                        return Expr.markLocal(newNode, flags);
                }
            } else {
                return item;
            }
        },

        ownerDocument: function (node) {
            //print("owner doc of " + node.nodeType);
            return Axis.ancestorOrSelf(node).expand().pop();
        },

        obtainDocumentNumber: function (node) {
            if (!("_saxonDocumentNumber" in node)) {
                node._saxonDocumentNumber = nextDocumentNumber++;
            }
            return node;
        },

        documentNumber: function (node) {
            return DomUtils.obtainDocumentNumber(node)._saxonDocumentNumber;
        },

        nameOfNode: function (node) {
            if (!node || !node.nodeType) {
                return null;
            }
            switch (node.nodeType) {
                case DomUtils.ELEMENT_NODE:
                    if (SaxonJS.getPlatform().inBrowser && node instanceof HTMLElement && node.namespaceURI == "http://www.w3.org/1999/xhtml") {
                        return Atomic.QName.fromParts("", "", node.localName);
                    } else {
                        return Atomic.QName.fromParts(node.prefix, node.namespaceURI, node.localName);
                    }
                    break;
                case DomUtils.ATTRIBUTE_NODE:
                    // patch things up because xmldom doesn't handle "xml" prefix correctly
                    if (node.prefix == "xml") {
                        return Atomic.QName.fromParts(node.prefix, "http://www.w3.org/XML/1998/namespace", node.localName);
                    } else {
                        return node.qname;
                    }
                    break;
                case DomUtils.PROCESSING_INSTRUCTION_NODE:
                    return Atomic.QName.fromParts("", "", node.target);
                case DomUtils.NAMESPACE_NODE:
                    return node.prefix ? Atomic.QName.fromParts("", "", node.prefix) : null;
                default:
                    return null;
            }
        },

        hasLocalName: function (node, name) {
            if (typeof HTMLElement != "undefined") {
                // Do case-blind matching for the names of HTML elements and attributes
                if (node instanceof HTMLElement || (node.nodeType == DomUtils.ATTRIBUTE_NODE && node.parent instanceof HTMLElement)) {
                    return node.localName.toUpperCase() === name.toUpperCase();
                }
            }
            return node.localName === name; // works for AttributeNode as well as Node
        },

        hasNamespace: function (node, uri) {
            return uri == (DomUtils.isAttr(node) ? node.namespaceURI : (node.namespaceURI || "")); //TODO check change
        },

        /**
         * Get the child elements of a given element
         * @param expr the parent element
         * @param name (optional) the tagName of the required children. If absent, all children are returned
         * @returns {Array} an array containing the requested child elements
         */
        getChildElements: function (expr, name) {
            var result = [];
            var child = expr.firstChild;
            while (child !== null) {
                if (child.nodeType == DomUtils.ELEMENT_NODE && (!name || name == child.tagName)) {
                    result.push(child);
                }
                child = child.nextSibling;
            }
            //print("Children of " + expr.tagName + ": " + result.length);
            return result;
        },


        /**
         * Sort nodes into document order, and remove duplicates
         * @param iter iterator over the nodes to be sorted
         * @returns iterator over the same nodes, in document order and with duplicates eliminated
         */

        inDocumentOrder: function (iter) {
            var array = iter.expand();
            array.sort(DomUtils.compareDocumentOrder);
            //array.forEach(function(node) { print(showValue(node) + " in " + showValue(DomUtils.ownerDocument(node)))});
            // Eliminate duplicate nodes from the sorted array
            return Iter.ForArray(array).mapOneToOne(
                function (item, index) {
                    //print("dup? " + (index > 0 && item === array[index - 1]));
                     return (index > 0 && DomUtils.isSameNode(item, array[index - 1])) ? null : item;
                });
        },

        /**
         * Assess the relative document order of two nodes
         * @param a one node
         * @param b another node
         * @returns number -1 if a precedes b in document order; 0 if they are the same node; +1 if b precedes a
         */

        compareDocumentOrder: function (a, b) {
            //print("compare order " + DomUtils.nameOfNode(a) + " " + DomUtils.nameOfNode(b));
            function depth(node) {
                return Axis.ancestor(node).count();
            }

            if (DomUtils.isSameNode(a, b)) {
                return 0;
            }
            var pa = DomUtils.xdmParentNode(a);
            var pb = DomUtils.xdmParentNode(b);
            if (pa === null) {
                if (pb === null) {
                    var patch = DomUtils.obtainDocumentNumber;
                    return (patch(a)._saxonDocumentNumber < patch(b)._saxonDocumentNumber ? -1 : +1);
                } else if (a === pb) {
                    return -1;
                } else {
                    return DomUtils.compareDocumentOrder(a, pb);
                }
            }
            if (pb === null) {
                if (b === pa) {
                    return +1;
                }
                return DomUtils.compareDocumentOrder(pa, b);
            }
            if (pa === pb) {
                var ta = a.nodeType;
                var tb = b.nodeType;
                if (ta == DomUtils.ATTRIBUTE_NODE) {
                    if (tb == DomUtils.ATTRIBUTE_NODE) {
                        // Ordering needs to be consistent with what @* delivers
                        //print("ordering @" + a.localName + " and @" + b.localName);
                        var attMap = pa.attributes;
                        var i;
                        for (i = 0; i < attMap.length; i++) {
                            var att = new AttributeNode(Atomic.QName.fromParts(attMap[i].prefix, attMap[i].namespaceURI,
                                attMap[i].localName), attMap[i].value, null);
                            var name = att.name;
                            //print("checking " + name);
                            // TODO: check namespaces
                            if (name.indexOf(":") < 0) {
                                if (name == a.localName) {
                                    return -1;
                                } else if (name == b.localName) {
                                    return +1;
                                }
                            } else {
                                name = DomUtils.nameOfNode(att);
                                if (name.equals(DomUtils.nameOfNode(a))) {
                                    return -1;
                                } else if (name.equals(DomUtils.nameOfNode(b))) {
                                    return +1;
                                }
                            }
                        }
                        throw XError("Att not found in parent", "SXJS0004");
                    } else if (tb == DomUtils.NAMESPACE_NODE) {
                        return +1;
                    } else {
                        return -1;
                    }
                }
                if (ta == DomUtils.NAMESPACE_NODE) {
                    if (tb == DomUtils.NAMESPACE_NODE) {
                        return a.prefix < b.prefix ? -1 : +1;
                    } else {
                        return -1;
                    }
                }
                if (tb == DomUtils.ATTRIBUTE_NODE || tb == DomUtils.NAMESPACE_NODE) {
                    return +1;
                }
                var sa = a;
                var sb = b;
                while (true) {
                    sa = sa.previousSibling;
                    if (sa === null) {
                        return -1;
                    }
                    if (sa === b) {
                        return +1;
                    }
                    sb = sb.previousSibling;
                    if (sb === null) {
                        return +1;
                    }
                    if (sb === a) {
                        return -1;
                    }
                }
            } else {
                if (a === pb) {
                    return -1;
                }
                if (b === pa) {
                    return +1;
                }
                // see which node is deeper, and go up the requisite number of levels
                var da = depth(pa), db = depth(pb);
                if (da == db) {
                    return DomUtils.compareDocumentOrder(pa, pb);
                } else if (da > db) {
                    return DomUtils.compareDocumentOrder(pa, b);
                } else {
                    return DomUtils.compareDocumentOrder(a, pb);
                }
            }
        },

        xdmParentNode: function (node) {
            return DomUtils.isAttr(node) ? node.parent : node.parentNode;
        },

        declareNS: function (elemNode, prefix, uri) {
            //print("declareNS " + elemNode.tagName + "... " + prefix + "=" + uri);
            elemNode.setAttributeNS("http://www.w3.org/2000/xmlns/",
                prefix === "" ? "xmlns" : "xmlns:" + prefix, uri);
        },

        /**
         * Get the in-scope namespaces of an element as an array of {prefix:, uri:} objects
         */
        inScopeNamespaces: function (element) {
            var result = [{
                prefix: "xml", uri: "http://www.w3.org/XML/1998/namespace"
            }];
            var found = {
                xml: true
            };
            var anc;
            var ancestors = Axis.ancestorOrSelf(element);
            //print("Visiting ancestors");
            while ((anc = ancestors.next()) !== null) {
                if (anc.nodeType == DomUtils.ELEMENT_NODE) {
                    //print("anc " + showValue(anc));
                    var attMap = anc.attributes; // these do not get converted to AttributeNodes because we are looking for namespaces
                    var i;
                    for (i = 0; i < attMap.length; i++) {
                        var name = attMap[i].name;
                        if (name.substring(0, 5) == "xmlns") {
                            if (name.length == 5 && !found[""]) {
                                found[""] = true;
                                if (attMap[i].value !== "") {
                                    result.push({
                                        prefix: "", uri: attMap[i].value
                                    });
                                }
                            } else if (name.charAt(5) == ":") {
                                var prefix = name.substring(6);
                                if (!found[prefix]) {
                                    found[prefix] = true;
                                    result.push({
                                        prefix: prefix, uri: attMap[i].value
                                    });
                                }
                            }
                        }
                    }
                } else {
                    break;
                }
            }
            return result;
        },


        getInheritedAttribute: function (expr, attName) {
            var n = expr;
            while (n && n.nodeType == DomUtils.ELEMENT_NODE) {
                //print("seek INH " + n.tagName + "? " + attName);
                if (n.hasAttribute(attName)) {
                    return n.getAttribute(attName);
                }
                n = n.parentNode;
            }
            return null;
        },

        /**
         * Get an attribute of an element, returning null or a specified default value
         * if the attribute does not exist
         * (The Node.getAttribute() method is inconsistent in this respect)
         */
        getAttribute: function (element, name, defaultVal) {
            if (element.hasAttribute(name)) {
                return element.getAttribute(name);
            } else {
                return arguments.length > 2 ? defaultVal : null;
            }
        },

        getAttributeAsEQName: function (element, name, useDefault) {
            var qn = DomUtils.getAttributeAsQName(element, name, useDefault);
            return qn === null ? null : ("Q{" + qn.uri + "}" + qn.local);
        },

        getAttributeAsQName: function (element, name, useDefault) {
            if (!element.hasAttribute(name)) {
                return null;
            }
            return DomUtils.resolveLexicalQName(element, element.getAttribute(name), useDefault);
        },

        /**
         * Resolve a lexical QName against the in-scope namespaces for an element
         * @param element an element in the compiled stylesheet
         * @param value an EQName: either a lexical QName or Q{uri}local
         * @param useDefault: namespace to be used if an NCName is supplied; if true, use the default namespace
         * for the element; otherwise use no namespace ("")
         * @returns an Atomic.QName, or if the prefix is not resolved, null
         * @throws FOCA0002 if the QName is invalid, for example if it is lexically invalid
         * or if the namesspace is not declared
         */

        resolveLexicalQName: function (element, value, useDefault) {
            //print("Resolving " + value + " useDefault=" + useDefault);
            var Q = Atomic.QName;
            if (/^Q\{/.test(value)) {
                return Q.fromEQName(value);
            } else if (!(/:/).test(value)) {
                var uri = useDefault ? element.lookupNamespaceURI(null) || "" : "";
                //print("uri: " + uri);
                //print("uri2: " + element.lookupNamespaceURI(null));
                return Q.fromParts("", uri, value);
            } else {
                var resolver = function (prefix) {
                    return prefix == "xml" ? "http://www.w3.org/XML/1998/namespace" : element.lookupNamespaceURI(prefix);
                };
                return Q.fromString(value, resolver);
            }
        },

        isAttr: function (item) {
            return item instanceof AttributeNode;
        },

        isNSNode: function (item) {
            return item instanceof NamespaceNode;
        },

        isNode: function (item) {
            return (item instanceof Node && !(item.nodeType == DomUtils.PROCESSING_INSTRUCTION_NODE && item.target == "xml")) ||
                DomUtils.isAttr(item) || DomUtils.isNSNode(item);
        },

        isSameNode: function (n1, n2) {
            //print("isSameNode " + showValue(n1) + ", " + showValue(n2));
            return (n1 === n2) ||
                (DomUtils.isNSNode(n1) && DomUtils.isNSNode(n2) &&
                n1.parentNode && n2.parentNode && n1.parentNode == n2.parentNode && n1.prefix == n2.prefix) || 
                (DomUtils.isAttr(n1) && DomUtils.isAttr(n2) &&
                n1.parent && n2.parent && n1.parent == n2.parent && DomUtils.nameOfNode(n1).equals(DomUtils.nameOfNode(n2)));
        },

        isAbsoluteURI: function (uri) {
            return /^(?:[a-z]+:)?\/\//i.test(uri);
        },

        baseURI: function (node) {
            function rawBase(node) {
                //print("rawBase of " + showValue(node));
                var p = DomUtils.xdmParentNode(node);
                return p ? DomUtils.baseURI(p) : node._saxonBaseUri ? node._saxonBaseUri : null;
            }

            if (node === null || DomUtils.isNSNode(node)) {
                return null;
            }
            if (node.nodeType == DomUtils.ELEMENT_NODE && node.hasAttribute("xml:base")) {
                var xmlBase = node.getAttribute("xml:base");
                return DomUtils.isAbsoluteURI(xmlBase) ? xmlBase :
                    SaxonJS.getPlatform().resolveUri(xmlBase.toString(), rawBase(node)).toString();
            } else {
                return rawBase(node);
            }
        },

        xmlToString: function (item, params, prefixesIn, namespaceIn) {
            var params2 = typeof params !== 'undefined' ? params: {
                headerLength: 80, indent: "  "
            };

            function xmlToStringInner(item, indent, prefixesIn, namespaceIn) {
                var prefixes = [];
                if (typeof prefixesIn !== 'undefined') {
                    prefixesIn.forEach(function (val) {
                        prefixes[val] = true;
                    });
                }
                var namespace = typeof namespaceIn !== 'undefined' ? namespaceIn: "";
                var nodeName;
                var result = "";
                var children, child, i;
                var isText = false, previousText = false, noIndent = false;
                switch (item.nodeType) {
                    case DomUtils.DOCUMENT_NODE:
                    child = item.documentElement;
                    if (child !== null) {
                        result = xmlToStringInner(child,"");
                    }
                    break;
                    case DomUtils.DOCUMENT_FRAGMENT_NODE:
                    children = item.childNodes;
                    for (i = 0; i < children.length;++ i) {
                        child = children[i];
                        result += "\n" + xmlToStringInner(child,"");
                    }
                    break;
                    case DomUtils.ELEMENT_NODE:
                    nodeName = DomUtils.nameOfNode(item);
                    result += ((indent == "none") ? "": indent) + "<" + nodeName;
                    var attString = "";
                    var nsURI = item.namespaceURI;
                    if (nsURI != namespace) {
                        if (nsURI !== null && nsURI !== "") {
                            attString += " xmlns=\"" + nsURI + "\"";
                        }
                        namespace = nsURI;
                    }
                    var atts = item.attributes;
                    for (i = 0; i < atts.length;++ i) {
                        var att = new AttributeNode(Atomic.QName.fromParts(atts[i].prefix, atts[i].namespaceURI,
                        atts[i].localName), atts[i].value, null);
                        var attName = DomUtils.nameOfNode(att).toString();
                        if (attName.match(/^xmlns:xml/)) {
                            continue;
                        }
                        if (attName.match(/^xmlns/)) {
                            if (! prefixes[attName]) {
                                prefixes[attName] = true;
                                if (!(attName == "xmlns" && (namespace === null || namespace === "" || namespace == att.value))) {
                                    attString += " " + DomUtils.xmlToString(att, 0);
                                }
                            }
                        } else {
                            attString += " " + DomUtils.xmlToString(att, 0);
                        }
                        if (attString.length > params2.headerLength && i < atts.length - 1) {
                            result += attString;
                            attString = "\n" + (indent == "none" ? "": indent) + "   ";
                        }
                    }
                    result += attString;
                    children = item.childNodes;
                    if (children.length === 0) {
                        result += "/>";
                    } else {
                        result += ">";
                        for (i = 0; i < children.length;++ i) {
                            child = children[i];
                            isText = (child.nodeType == DomUtils.TEXT_NODE) && child.nodeValue !== "";
                            noIndent = (indent == "none") || isText || previousText;
                            result += noIndent ? "": "\n";
                            result += xmlToStringInner(child, noIndent ? "none": (indent + params2.indent), prefixes, namespace);
                            previousText = isText;
                        }
                        if (! noIndent) {
                            result += "\n" + indent;
                        }
                        result += "</" + nodeName + ">";
                    }
                    break;
                    case DomUtils.ATTRIBUTE_NODE:
                    nodeName = DomUtils.nameOfNode(item).toString();
                    result += nodeName + "=\"" + item.value.replace(/"/g,"\"\"") + "\"";
                    break;
                    case DomUtils.TEXT_NODE:
                    result = item.nodeValue.replace(/&/g,"&amp;");
                    break;
                    case DomUtils.COMMENT_NODE:
                    result += "<!--" + item.nodeValue + "-->";
                    break;
                    case DomUtils.PROCESSING_INSTRUCTION_NODE:
                    result += "<?" + item.target + " " + item.nodeValue + "?>";
                    break;
                    case DomUtils.NAMESPACE_NODE:
                    //newNode = new NamespaceNode(item.prefix, item.uri);
                    break;
                    case DomUtils.CDATA_SECTION:
                    return item.data;
                    default:
                        throw XError("Unknown node type " + item.nodeType, "SXJS0003");
                }

                return result;
            }
            return xmlToStringInner(item, "");
        }
    };
}
();
/**
 * A HashTrie intended for use as a general-purpose map implementation. It can function as either a mutable
 * or immutable map; it is immutable unless the method inSituPut() is used (the idea is that this method should
 * be used only during initialization of a map).
 *
 * The map can be customized by setting callback functions for the "sameKey" and "hash" properties. By
 * default the hash method calls hashCode() on the supplied key, and the sameKey method calls equals on the
 * supplied keys. The key can be anything that supports the required comparison methods.
 *
 * The hashCode is a string, and each successive character of the string is used to create a level in the tree
 * structure; at each level there is a JS object whose keys are the next character of the hashcode, and whose
 * associated values are subtrees at the next level. At the leaf level the node contains a list of (key, value)
 * pairs corresponding to the given hash code: these key-value pairs are represented as an array of JS objects
 * in the form [{k:k1, v:v1}, {k:k2, v:v2}, ...].
 *
 * The HashTrie is used both to represent an XDM map object, and for other internal uses (for example, to support
 * XSLT grouping). When it represents an XDM map, the key will always be an XDM atomic value (represented by an
 * instance of XdmInteger, XdmString, etc), and the value will always be an XDM sequence (represented by a
 * Javascript array).
 */

var HashTrie = (function () {

    "use strict";

    var nextId = 0,
        stdOptions = {
            // The hash function can be overridden for a particular HashTrie
            hash: function (key) {
                return key.hashCode();
            },

            // The sameKey function can be overridden for a particular HashTrie
            sameKey: function (k1, k2) {
                function hasTZ(n) {
                    return ("timezoneOffset" in n) && n.timezoneOffset !== null;
                }

                try {
                    return (k1.equals(k2) || (Compare.itemIsNaN(k1) && Compare.itemIsNaN(k2))) && hasTZ(k1) == hasTZ(k2);
                } catch (e) {
                    print(e);
                    return false;
                }
            }
        };

    // Get the list of key-value pairs for a given hash code

    function _getKVPlist(trie, hash) {
        if (hash === "") {
            return trie.leafKVPs;
        } else {
            var h = hash.charAt(0);
            if (trie.subTries.hasOwnProperty(h)) {
                return _getKVPlist(trie.subTries[h], hash.substring(1));
            }
            return [];
        }
    }

    // Get the key-value pair for a given key if present, or null otherwise

    function _getKVP(trie, key) {
        var list = _getKVPlist(trie, trie.options.hash(key));
        for (var i = 0; i < list.length; i++) {
            if (trie.options.sameKey(list[i].k, key)) {
                return list[i];
            }
        }
        return null;
    }

    // Insert an entry for a given key and value, replacing any previous entry for the same key

    function _inSituPut(trie, key, value, hashCode) {
        if (hashCode === "") {
            for (var i = 0; i < trie.leafKVPs.length; i++) {
                if (trie.options.sameKey(trie.leafKVPs[i].k, key)) {
                    trie.leafKVPs[i] = {k: key, v: value};
                    return;
                }
            }
            trie.leafKVPs.push({k: key, v: value});
        } else {
            var h = hashCode.charAt(0);
            var subTrie;
            if (trie.subTries.hasOwnProperty(h)) {
                subTrie = trie.subTries[h];
            } else {
                subTrie = new HashTrie(trie.options);
                subTrie.id = nextId++;
                trie.subTries[h] = subTrie;
            }
            _inSituPut(subTrie, key, value, hashCode.substring(1));
        }
    }

    // Create a copy of the trie, with an additional entry for the supplied key/value pair, replacing
    // any previous entry for that key

    function _copyPut(trie, key, value, hashCode) {
        /*if (hashCode == "rt") {
         trie.display();
         }*/
        //print("_copyPut key=" + showValue(key) + " value=" + showValue(value) + " hashCode=" + hashCode);
        //print("Size before put " + trie.keys().length);
        var t2 = new HashTrie(trie.options),
            found = false;
        if (hashCode === "") {
            t2.leafKVPs = trie.leafKVPs.map(function (kvp) {
                //print("Comparing " + key + " with " + kvp.k + " = " + trie.options.sameKey(kvp.k, key));
                if (trie.options.sameKey(kvp.k, key)) {
                    found = true;
                    return {k: key, v: value};
                } else {
                    return kvp;
                }
            });
            if (!found) {
                t2.leafKVPs.push({k: key, v: value});
            }
            t2.subTries = trie.subTries;
            //print("Size after leaf put " + t2.keys().length);
            return t2;
        } else {
            var h = hashCode.charAt(0);
            for (var hc in trie.subTries) {
                if (trie.subTries.hasOwnProperty(hc)) {
                    if (hc == h) {
                        t2.subTries[hc] = _copyPut(trie.subTries[hc], key, value, hashCode.substring(1));
                        found = true;
                    } else {
                        t2.subTries[hc] = trie.subTries[hc];
                    }
                }
            }
            if (!found) {
                var s2 = new HashTrie(trie.options);
                s2 = _copyPut(s2, key, value, hashCode.substring(1));
                t2.subTries[h] = s2;
            }
            t2.leafKVPs = trie.leafKVPs;
            //print("Size after put " + hashCode + " = " + t2.keys().length);
        }
        /*if (hashCode == "rt") {
         t2.display();
         }*/
        return t2;
    }

    // Create a copy of the trie in which a particular entry is removed

    function _copyRemove(trie, key, hashCode) {
        var t2 = new HashTrie(trie.options);
        if (hashCode === "") {
            t2.leafKVPs = trie.leafKVPs.filter(function (kvp) {
                return !trie.options.sameKey(kvp.k, key);
            });
            t2.subTries = trie.subTries;
            return t2;
        } else {
            var h = hashCode.charAt(0);
            for (var hc in trie.subTries) {
                if (trie.subTries.hasOwnProperty(hc)) {
                    t2.subTries[hc] = hc == h ? _copyRemove(trie.subTries[hc], key, hashCode.substring(1)) : trie.subTries[hc];
                }
            }
            t2.leafKVPs = trie.leafKVPs;
        }
        return t2;
    }


    // Constructor

    function HashTrie(options) {
        this.leafKVPs = [];
        this.subTries = {};
        this.options = options || {hash: stdOptions.hash, sameKey: stdOptions.sameKey};
    }

    HashTrie.prototype = {
        leafKVPs: [],
        subTries: {},
        options: stdOptions,


        /**
         * Ask whether the map contains an entry for a given key
         * @param key the supplied key
         * @returns boolean true if the key is present in the map, otherwise false
         */
        containsKey: function (key) {
            return _getKVP(this, key) !== null;
        },

        /**
         * Get the value associated with a given key in the map
         * @param key the supplied key
         * @returns object the associated value if present; otherwise null. Note that
         * null may mean that the key is absent, or that the key is present and associated
         * with the value null.
         */

        get: function (key) {
            var kvp = _getKVP(this, key);
            return kvp === null ? [] : kvp.v;
        },

        /**
         * Add or replace an entry for a given key, modifying the map in situ
         * @param key the new key
         * @param value the new value
         */

        inSituPut: function (key, value) {
            //print("in situ put " + showValue(key) + " = " + showValue(value));
            _inSituPut(this, key, value, this.options.hash(key));
        },

        /**
         * Add or replace an entry for a given key, returning a copy of the map. The original map
         * is not changed.
         * @param key the new key
         * @param value the new value
         * @returns object new map
         */

        put: function (key, value) {
            return _copyPut(this, key, value, this.options.hash(key));
        },

        /**
         * Remove an entry for a given key, returning a copy of the map. The original map
         * is not changed.
         * @param key the new key
         * @returns object new map
         */

        remove: function (key) {
            return _copyRemove(this, key, this.options.hash(key));
        },

        /**
         * Iterate over the entries in the map. The supplied function is called for each entry in turn,
         * in undefined order; the function is called with a single parameter which is an object of the
         * form {k:key, v:value}
         * @param f the function to be called for each key-value pair.
         */

        forAllPairs: function (f) {
            this.leafKVPs.forEach(f);
            for (var h in this.subTries) {
                if (this.subTries.hasOwnProperty(h)) {
                    this.subTries[h].forAllPairs(f);
                }
            }
        },

        display: function () {
            print("HashTrie:");
            function disp(trie, level) {
                if (level > 0) {
                    print("Subtrie " + level);
                }
                trie.leafKVPs.forEach(function (kvp) {
                    print(showValue(kvp.k) + ": " + showValue(kvp.v));
                });
                for (var h in trie.subTries) {
                    if (trie.subTries.hasOwnProperty(h)) {
                        disp(trie.subTries[h], level + 1);
                    }
                }
            }
            disp(this, 0);
        },

        /**
         * Return all the keys present in the map, as an array, in undefined order
         * @returns Array containing all the keys
         */

        keys: function () {
            var result = [];
            this.forAllPairs(function (pair) {
                result.push(pair.k);
            });
            return result;
        },

        /**
         * Test conformance to a type
         * @param keyTest a function which must return true for every key value
         * @param valueTest a function which must return true for every item in every value
         * @param valueCountTest a function which must return true for the cardinality of every value
         * @returns boolean
         */
        conforms: function (keyTest, valueTest, valueCountTest) {
            var map = this;
            //print("map.conforms " + showValue(map.keys()));
            return Iter.ForArray(map.keys()).every(function (k) {
                //print("map.conforms " + showValue(k) + " : " + showValue(map.get(k)));
                var v = map.get(k);
                return keyTest(k) && valueCountTest(v.length) && Iter.ForArray(v).every(valueTest);
            });
        }

    };

    return HashTrie;
})();

var Axis = function () {

    "use strict";
    
    var DU = DomUtils;

    var axes = {
        ancestor: function (node) {
            var p;
            switch (node.nodeType) {
                case DU.DOCUMENT_NODE:
                case DU.DOCUMENT_FRAGMENT_NODE:
                    return Iter.Empty;
                case DU.ATTRIBUTE_NODE:
                    if (node.parent) {
                        return Iter.Stepping(node.parent, function (node) {
                            return node.parentNode;
                        });
                    } else {
                        return Iter.Empty;
                    }
                    break;
                default:
                    p = node.parentNode;
                    if (!p) {
                        return Iter.Empty;
                    }
                    return Iter.Stepping(p, function (node) {
                        return node.parentNode;
                    });
            }
        },
        ancestorOrSelf: function (node) {
            return Iter.Join([
                Iter.Singleton(node),
                Axis.ancestor(node)]);
        },
        attribute: function (node) {
            if (node.nodeType == DU.ELEMENT_NODE) {
                //print("domNode is an element");
                var attMap = node.attributes;
                //print("attMap.length is " + attMap.length);

                var array = [];
                var i, name;
                for (i = 0; i < attMap.length; i++) {
                    name = attMap[i].name;
                    if (!(name.substring(0, 5) == "xmlns" && (name.length == 5 || name.charAt(5) == ":"))) {
                        //print("Att " + name + "=>" + showValue(attMap[i]));
                        array.push(new AttributeNode(Atomic.QName.fromParts(attMap[i].prefix, attMap[i].namespaceURI,
                            attMap[i].localName), attMap[i].value, node));
                    }
                }
                //print("array length" + array.length);
                return Iter.ForArray(array);
            } else {
                return Iter.Empty;
            }
        },
        child: function (node) {
            function kids(node) {
                return Iter.Stepping(node.firstChild, function (node) {
                    return node.nextSibling;
                });
            }
            if(node === null) {
            // Something odd with IE - fn-has-children-19 shows it
                return Iter.Empty;
            }
            switch (node.nodeType) {
                case DU.DOCUMENT_NODE:
                    return kids(node).filter(function (node) {
                        return !((node.nodeType == DU.PROCESSING_INSTRUCTION_NODE && node.target == "xml") || 
                        node.nodeType == DU.TEXT_NODE);
                    });
                case DU.DOCUMENT_FRAGMENT_NODE:
                case DU.ELEMENT_NODE:
                    return kids(node);
                default:
                    return Iter.Empty;
            }
        },
        descendant: function (node) {
            return Axis.child(node).mapOneToMany(
                function (node) {
                    return Axis.descendantOrSelf(node);
                });
        },
        descendantOrSelf: function (node) {
            return Iter.Join([Iter.Singleton(node), Axis.descendant(node)]);
        },
        following: function (node) {
            switch (node.nodeType) {
                case DU.DOCUMENT_NODE:
                case DU.DOCUMENT_FRAGMENT_NODE:
                    return Iter.Empty;
                case DU.ATTRIBUTE_NODE:
                case DU.NAMESPACE_NODE:
                    var p = DU.xdmParentNode(node);
                    return p===null ? Iter.Empty : Iter.Join([Axis.descendant(p), Axis.following(p)]);
                default:
                    return Axis.ancestorOrSelf(node).mapOneToMany(
                        function (node) {
                            return Axis.followingSibling(node).mapOneToMany(Axis.descendantOrSelf);
                        }
                    );
            }
        },
        followingSibling: function (node) {
            switch (node.nodeType) {
                case DU.DOCUMENT_NODE:
                case DU.DOCUMENT_FRAGMENT_NODE:
                case DU.ATTRIBUTE_NODE:
                case DU.NAMESPACE_NODE:
                    return Iter.Empty;
                default:
                    return Iter.Stepping(node.nextSibling, function (node) {
                        return node.nextSibling;
                    });
            }
        },
        namespace: function (node) {
            if (node.nodeType == DU.ELEMENT_NODE) {
                return Iter.ForArray(
                    DU.inScopeNamespaces(node).map(
                        function (ns) {
                            return new NamespaceNode(ns.prefix, ns.uri, node);
                        }
                    ));
            } else {
                return Iter.Empty;
            }
        },
        parent: function (node) {
            return Iter.Singleton(DU.xdmParentNode(node));
        },
        preceding: function (node) {
            return Axis.ancestorOrSelf(node).mapOneToMany(
                function (node) {
                    return Axis.precedingSibling(node).mapOneToMany(
                        function(node) {
                            // Need descendants in reverse document order
                            return Iter.ForArray(Axis.descendantOrSelf(node).expand().reverse());
                        });
                }
            );
        },
        precedingSibling: function (node) {
            switch (node.nodeType) {
                case DU.DOCUMENT_NODE:
                case DU.DOCUMENT_FRAGMENT_NODE:
                case DU.ATTRIBUTE_NODE:
                case DU.NAMESPACE_NODE:
                    return Iter.Empty;
                default:
                    return Iter.Stepping(node.previousSibling, function (node) {
                        return node.previousSibling;
                    });
            }
        },
        self: function (node) {
            return Iter.Singleton(node);
        }
    };
    axes["ancestor-or-self"] = axes.ancestorOrSelf;
    axes["descendant-or-self"] = axes.descendantOrSelf;
    axes["following-sibling"] = axes.followingSibling;
    axes["preceding-sibling"] = axes.precedingSibling;
    return axes;

}();

// Define error class for all XSLT (and XPath) dynamic errors

/* Saxon-JS specific error codes
  * SXJS0001 - 'Cannot export for Javascript if the stylesheet uses unsupported features' used in Saxon-EE
  * SXJS0002 - Not implemented / restrictions in Saxon-JS
  * SXJS0003 - Unknown... comparer/ operator/ node type, etc
  * SXJS0004 - Internal error (e.g. Expr internalError)
  * SXJS0005 - JSValue restrictions
  * SXJS0006 - API / initialization error
  * SXJS0007 - interactive functions errors
  * */

function XError(message, code, expr) {
    if (!(this instanceof XError)) {
        return new XError(message, code, expr);
    }
    this.name = 'XError';
    this.message = message || 'Default Message';
    this.code = code || "FORG0001";
    if (expr) {
        this.setExpr(expr);
    }
    this.stack = (new Error()).stack;
}

XError.prototype = Object.create(Error.prototype);
XError.prototype.constructor = XError;
XError.prototype.code = null;
XError.prototype.xsltLineNr = null;
XError.prototype.xsltModule = null;
XError.prototype.compiledLineNr = null;
XError.prototype.isGlobal = false;
XError.prototype.setExpr = function (expr) {
    this.xsltLineNr = DomUtils.getInheritedAttribute(expr, "line");
    this.xsltModule = DomUtils.getInheritedAttribute(expr, "module");
    this.compiledLineNr = expr.lineNumber;
    if(this.xsltLineNr !== null) {
    this.message += " at "+ this.xsltModule+"#"+this.xsltLineNr;
    }
};
XError.test = function (condition /*, ...*/) {
    if (condition) {
        throw XError.call(this, arguments[1], arguments[2], arguments[3]);
    }
};
/*jshint bitwise: false*/
var Expr = function () {

    "use strict";
    
    var DU = DomUtils;
    
    /* Indicator for xsl:break in xsl:iterate */
    function BreakIndicator() {} 
    
    var expression = {
        analyzeString: function (expr, context) {
            var input = evaluate(argRole(expr, "select"), context).next();
            if (input === null) {
                return Iter.Empty;
            }
            input = input.toString();
            var regex = evaluate(argRole(expr, "regex"), context).next().toString();
            var flags = evaluate(argRole(expr, "flags"), context).next().toString();
            var onMatch = argRole(expr, "matching");
            var onNoMatch = argRole(expr, "nonMatching");
            var details = analyze(input, regex, flags, true, false);
            var c2 = context.newContext(false);
            var strings = details.map(function (m) {
                return m.string;
            });
            c2.focus = Iter.Tracker(Iter.ForArray(strings));
            
            return c2.focus.mapOneToMany(function (item) {
                var info = details[c2.focus.position - 1];
                if (info.matching) {
                    c2.focus.regexGroups = info.groups;
                    return onMatch ? evaluate(onMatch, c2): Iter.Empty;
                } else {
                    c2.focus.regexGroups =[];
                    return onNoMatch ? evaluate(onNoMatch, c2): Iter.Empty;
                }
            });
        },
        and: function (expr, context) {
            return Iter.oneBoolean(ebv(evalChild1(expr, context)) && ebv(evalChild2(expr, context)));
        },
        among: function (expr, context) {
            var m = evalChild1(expr, context).next();
            var n = evalChild2(expr, context);
            return n.filter(function (node) {
                return node === m;
            });
        },
        applyImports: function (expr, context) {
            var mode = context.currentMode;
            if (mode === null) {
                throw XError("applyImports: no current mode", "XTDE0560", expr);
            }
            if (!context.focus.current) {
                throw XError("applyImports: no context item", "XTDE0560", expr);
            }
            var c2 = context.newContext(true);
            assembleParams(expr, context, c2);
            c2.focus = Iter.Tracker(Iter.Singleton(context.focus.current));
            c2.focus.next();
            return mode.applyImports(c2);
        },
        applyT: function (expr, context) {
            var mode;
            if (hasFlag(expr, "c")) {
                mode = context.currentMode;
            } else {
                var modeName = DU.getAttributeAsEQName(expr, "mode");
                if (modeName === null) {
                    modeName = "";
                }
                mode = context.fixed.modes[modeName];
                if (mode === null) {
                    internalError("Mode " + modeName + " not found");
                }
            }
            var c2 = context.newContext(true);
            assembleParams(expr, context, c2);
            c2.focus = Iter.Tracker(evalChild1(expr, context));
            return mode.applyTemplates(c2);
        },
        arith: function (expr, context) {
            var calcFn = Calculate[expr.getAttribute("calc")];
            if (! calcFn) {
                notImplemented("arithmetic (" + expr.getAttribute("calc") + ")", expr);
            }
            return Iter.Singleton(binaryOperator(expr, context, calcFn));
        },
        arith10: function (expr, context) {
            function dbl(iter) {
                var item = iter.next();
                return item === null ? Atomic. double.fromNumber(NaN): Atomic. double.cast(item);
            }
            
            var calcFn = Calculate[expr.getAttribute("calc")];
            return Iter.Singleton(calcFn(dbl(evalChild1(expr, context)), dbl(evalChild2(expr, context))));
        },
        array: function (expr, context) {
            var aray = DU.getChildElements(expr).map(function (exp) {
                return evaluate(exp, context).expand();
            });
            //print("aray: " + showValue(aray));
            return Iter.Singleton(new XdmArray(aray));
        },
        arrayBlock: function (expr, context) {
            var aray = DU.getChildElements(expr).map(function (exp) {
                return evaluate(exp, context).expand();
            });
            //print("aray: " + showValue(aray));
            return Iter.Singleton(new XdmArray(aray));
        },
        atomic: function (expr) {
            var value = expr.getAttribute("val");
            var type = expr.getAttribute("type").substring(3);
            if (! Atomic[type]) {
                internalError("Unknown type: " + type, expr);
            }
            return Iter.Singleton(Atomic[type].fromString(value));
        },
        atomSing: function (expr, context) {
            var base = evalChild1(expr, context).mapOneToMany(atomize);
            if (! expr.hasAttribute("card")) {
                base = Iter.LookAhead(base);
                if (base.peek() === null) {
                    var x = roleDiagnostic(expr.getAttribute("diag"));
                    throw XError("The " + x.required + " is empty", x.code, expr);
                }
            }
            return base;
        },
        att: function (expr, context) {
            var content = evalChild1(expr, context);
            var strContent = makeSimpleContent(content);
            var attName = DU.getAttributeAsQName(expr, "name");
            if (attName === null) {
                throw XError("Invalid attribute name " + expr.getAttribute("name"), "XTDE0850", expr);
            }
            //print("att uri=" + attName.uri + " local=" + attName.local);
            var attNode = context.createAttributeFromQName(attName);
            attNode.value = strContent;
            var flags = expr.hasAttribute("flags") ? expr.getAttribute("flags") : "";
            return Iter.Singleton(markLocal(attNode, flags));
        },
        attVal: function (expr, context) {
            var name = DU.getAttributeAsQName(expr, "name");
            //print("attVal name " + name.toString());
            if (!context.focus.current) {
                throw XError("attVal: no context item", "XPDY0002", expr);
            }
            var item = context.focus.current;
            if (! DU.isNode(item)) {
                throw XError("Context item for 'attVal' must be a node", "XPTY0020", expr);
            }
            if (item.nodeType != DU.ELEMENT_NODE) {
                return Iter.Empty;
            }
            var val;
            if (name.uri === "") {
                val = item.hasAttribute(name.local) ? item.getAttribute(name.local) : null;
            } else if (name.uri === "http://www.w3.org/XML/1998/namespace") {
                val = item.hasAttribute("xml:" + name.local) ? item.getAttribute("xml:" + name.local) : null;
            } else {
                val = item.hasAttributeNS(name.uri, name.local) ? item.getAttributeNS(name.uri, name.local) : null;
            }
            //print("attVal val " + val);
            return val === null ? Iter.Empty : Iter.Singleton(Atomic.untypedAtomic.fromString(val));
        },
        axis: function (expr, context) {
            //print("axis " + expr.getAttribute("jsTest"));
            /*jslint evil: true */
            var nodeTest = new Function ('item', expr.getAttribute("jsTest"));
            var axis = expr.getAttribute("name");
            if (! context.focus.current) {
                throw XError("Context item is absent for " + axis + " axis", "XPDY0002", expr);
            }
            if (! DU.isNode(context.focus.current)) {
                throw XError("Context item for " + axis + " axis is not a node", "XPTY0020", expr);
            }
            return Axis[axis](context.focus.current).filter(nodeTest);
        },
        "break": function (expr, context) {
            return Iter.Join([Iter.Empty, Iter.Singleton(new BreakIndicator())]);
        },
        callT: function (expr, context) {
            var name = DU.getAttributeAsEQName(expr, "name");
            var target = context.fixed.namedTemplates[name];
            if (target === null) {
                internalError("Template " + name + " not found", expr);
            }
            var c2 = context.newContext(true);
            assembleParams(expr, context, c2);
            
            return evalChild1(target, c2);
        },
        cast: function (expr, context) {
            var iter = evalChild1(expr, context);
            var input = iter.next();
            var type = expr.getAttribute("as");
            if (input === null) {
                if (type.slice(-1) == "?" || "1" == expr.getAttribute("emptiable")) {
                    return Iter.Empty;
                } else {
                    throw XError("Empty sequence casting to " + type, "XPTY0004", expr);
                }
            }
            if (iter.next() !== null) {
                throw XError("Multiple sequence casting to " + type, "XPTY0004", expr);
            }

            try {
                type = type.replace(/(\?|\*)$/, "");
                var target = getAtomicType(type);
                var resolver = target.name == "QName" ? stylesheetResolver(expr, true): null;
                //print("Found type " + expr.getAttribute("as") + " - " + target.name);
                return Iter.Singleton(target.cast(input, resolver));
            }
            catch (e) {
                if (e.code !== null) {
                    throw e;
                }
                throw XError("Failed to cast to type " + type, "XPTY0004", expr);
            }
        },
        castable: function (expr, context) {
            var input = evalChild1(expr, context).mapOneToMany(atomize).expand();
            var result;
            if (input.length === 0) {
                result = "1" == expr.getAttribute("emptiable");
            } else if (input.length > 1) {
                result = false;
            } else {
                try {
                    var target = getAtomicType(expr.getAttribute("as"));
                    var resolver = target.name == "QName" ? stylesheetResolver(expr, true): null;
                    target.cast(input[0], resolver);
                    result = true;
                }
                catch (e) {
                    result = false;
                }
            }
            return Iter.oneBoolean(result);
        },
        cfn: function (expr, context) {
            // curried system function
            var name = expr.getAttribute("name");
            var args;
            if (name == "_format-number_1") {
                args =[evalChild1(expr, context), Iter.oneString(expr.getAttribute("pic"))];
                if (expr.hasAttribute("format")) {
                    args.push(Iter.oneString(expr.getAttribute("format")));
                }
                return CoreFn[ "format-number"](args, context, expr);
            } else if (name == "_translate_1") {
                args =[evalChild1(expr, context),
                Iter.oneString(expr.getAttribute("a1")),
                Iter.oneString(expr.getAttribute("a2"))];
                return CoreFn.translate(args, context);
            } else {
                internalError("Unimplemented: cfn " + name, expr);
            }
        },
        check: function (expr, context) {
            var card = expr.getAttribute("card");
            var showCard = {
                "*": "zero or more",
                "+": "one or more",
                "?": "zero or one",
                "°": "zero",
                "1": "exactly one"
            };
            
            function cardError(hasProblem) {
                var x = roleDiagnostic(expr.getAttribute("diag"));
                //print("Required card " + card);
                throw XError("Required cardinality of " + x.required + " is " + showCard[card] +
                "; supplied value " + hasProblem, x.code, expr);
            }
            
            var base = evalChild1(expr, context);
            if (card == "*") {
                return base;
            }
            var input = Iter.LookAhead(base);
            var first = input.peek();
            if (first === null) {
                if (card == "?" || card == "°") {
                    return Iter.Empty;
                } else {
                    cardError("is empty");
                }
            } else if (card == "°") {
                cardError("is not empty (first item " + showValue(first) + ")");
            }
            if (card == "+") {
                return input;
            }
            input.next();
            var second = input.next();
            if (second !== null) {
                var n = input.count() + 2;
                cardError("contains " + n + " items (" + showValue(first) + ", " + showValue(second) +
                (n > 2 ? ",... )": ")"));
            }
            return Iter.Singleton(first);
        },
        choose: function (expr, context) {
            var operands = DU.getChildElements(expr);
            var i;
            for (i = 0; i < operands.length; i += 2) {
                if (ebv(evaluate(operands[i], context))) {
                    return evaluate(operands[i + 1], context);
                }
            }
            return Iter.Empty;
        },
        comment: function (expr, context) {
            var content = evalChild1(expr, context);
            var commentNode = context.resultDocument.createComment(makeSimpleContent(content));
            var flags = expr.hasAttribute("flags") ? expr.getAttribute("flags") : "";
            return Iter.Singleton(markLocal(commentNode, flags));
        },
        compareToInt: function (expr, context) {
            var a = evalChild1(expr, context).next();
            if (a === null) {
                return Iter.Empty;
            }
            var b = Atomic.integer.fromString(expr.getAttribute("val"));
            return Iter.oneBoolean(Compare.testComparison(expr.getAttribute("op"), a.compareTo(b)));
        },
        compAtt: function (expr, context) {
            var flags = expr.hasAttribute("flags") ? expr.getAttribute("flags") : "";
            return computedElemOrAttr(expr, context, function (qname) {
                var attNode = context.createAttributeFromQName(qname);
                attNode = markLocal(attNode, flags);
                attNode.value = makeSimpleContent(evaluate(argRole(expr, "select"), context));
                return attNode;
            });
        },
        compElem: function (expr, context) {
            // TODO flags not yet taken into account:
            // P not inheritNamespacesFromParent
            // C not inheritNamespacesToChildren
            var flags = expr.hasAttribute("flags") ? expr.getAttribute("flags") : "";
            return computedElemOrAttr(expr, context, function (ns, lexi) {
                var elemNode = context.createElement(ns, lexi);
                if (ns !== "") { //  || (flags && flags.indexOf('C') >= 0)
                    var parts = lexi.split(":");
                    DU.declareNS(elemNode, parts.length == 1 ? "": parts[0], ns);
                }
                makeComplexContent(elemNode, evaluate(argRole(expr, "content"), context), context);
                return markLocal(elemNode, flags);
            });
        },
        condCont: function (expr) {
            notImplemented("xsl:where-populated", expr);
        },
        condSeq: function (expr) {
            notImplemented("xsl:on-empty/on-non-empty", expr);
        },
        conditionalSort: function (expr, context) {
            if (ebv(evalChild1(expr, context))) {
                return evalChild2(expr, context);
            } else {
                return evalChild1(DU.getChildElements(expr)[1], context);
            }
        },
        convert: function (expr, context) {
            var target = getAtomicType(expr.getAttribute("to"));
            return evalChild1(expr, context).mapOneToOne(
            hasFlag(expr, "p") ? function (v) {
                return promote(v, target.name);
            }: target.cast);
        },
        copy: function (expr, context) {
            // TODO XSLT 3.0 select attribute
            if (!context.focus.current) {
                throw XError("copy: no context item", "XTTE0945", expr);
            }
            var item = context.focus.current;
            var flags = expr.getAttribute("flags");
            return DU.shallowCopy(item, context, flags, function (c2) {
                return evalChild1(expr, c2);
            });
        },
        copyOf: function (expr, context) {
            var flags = expr.getAttribute("flags");
            return evalChild1(expr, context).mapOneToOne(function (item) {
                return DU.copyItem(item, context, flags);
            });
        },
        currentGroup: function (expr, context) {
            if (context && context.currentGroup) {
                return Iter.ForArray(context.currentGroup);
            } else {
                throw XError("There is no current group", "XTDE1061", expr);
            }
        },
        currentGroupingKey: function (expr, context) {
            if (context && context.currentGroupingKey) {
                return Iter.ForArray(context.currentGroupingKey);
            } else {
                throw XError("There is no current grouping key", "XTDE1071", expr);
            }
        },
        cvUntyped: function (expr, context) {
            var input = evalChild1(expr, context);
            var to = expr.getAttribute("to");
            var convert = getAtomicType(to).cast;
            var toString = to == "xs:string";
            /*  AnyURI has special privileges to be promoted to xs:string - typically in cases involving doc(resolve-uri(...)) */
            return input.mapOneToOne(function (item) {
                if (Atomic.untypedAtomic.matches(item) || (toString && Atomic.anyURI.matches(item))) {
                    //print("converting to " + convert(item).type + " (" + expr.getAttribute("to"));
                    return convert(item);
                } else {
                    //print("not converting " + item.type);
                    return item;
                }
            });
        },
        data: function (expr, context) {
            return evalChild1(expr, context).mapOneToMany(atomize);
        },
        dbl: function (expr) {
            var value = expr.getAttribute("val");
            return Iter.Singleton(Atomic. double.fromString(value));
        },
        dec: function (expr) {
            var value = expr.getAttribute("val");
            return Iter.oneDecimal(Big(value));
        },
        doc: function (expr, context) {
            var docNode = newDoc(DU.getChildElements(expr)[0], context);
            var flags = expr.hasAttribute("flags") ? expr.getAttribute("flags") : "";
            return Iter.Singleton(markLocal(docNode, flags));
        },
        docOrder: function (expr, context) {
            return DU.inDocumentOrder(evalChild1(expr, context));
        },
        dot: function (expr, context) {
            if (! context.focus.current) {
                throw XError("dot: no context item", "XPDY0002", expr);
            }
            return Iter.Singleton(context.focus.current);
        },
        elem: function (expr, context) {
            // TODO flags attribute not yet taken into account:
            // P not inheritNamespacesFromParent
            // C not inheritNamespacesToChildren
            // "d" to indicate default namespace
            var needNS = false;
            var name = expr.getAttribute("name");
            //print("elem name " + name);
            var parts = name.split(":");
            var uri = null;
            if (expr.hasAttribute("nsuri")) {
                uri = expr.getAttribute("nsuri");
                needNS = true;
            }
            
            if (parts.length == 2 && uri === null) {
                uri = uriFromStaticContext(expr, parts[0]);
                //print("URI for " + parts[0] + " = " + uri);
                needNS = true;
            }
            if (uri === null) {
                uri = "";
            }
            if (uri == "http://www.w3.org/2000/xmlns/") {
                throw XError("Disallowed namespace " + uri, "XTDE0835", expr);
            }
            var elemNode = context.createElement(uri, name);
            if (expr.hasAttribute("namespaces")) {
                // TODO work in progress...
                // 9.7 SEF namespaces="=http://www.w3.org/1999/xhtml"
                // 9.8 SEF namespaces="#"
                var namespaces = expr.getAttribute("namespaces").toString().split(" ");
                var n;
                for (n = 0; n < namespaces.length; n++) {
                    var pu = namespaces[n].split("=");
                    var u = pu.length == 2 ? pu[1] : uriFromStaticContext(expr, pu[0]);
                    if (pu[0] != "#") {
                        //print("Set namespace " + pu[0] + "=" + u);
                        DU.declareNS(elemNode, pu[0], u);
                        if (pu[0] == parts[0] && u == uri) { //check
                            needNS = true;
                        }
                    }/* else if (pu[0] == "#") {
                        DU.declareNS(elemNode, "", u);
                        if ("" == parts[0] && u == uri) { //check
                            needNS = true;
                        }
                    }*/
                    /*if ((pu[0] == parts[0] || (pu[0] == "#" && "" == parts[0])) && u == uri) {
                        needNS = true;
                    }*/
                    
                }
            }
            if (needNS) {
                //print("FIXUP " + parts[0] + "=" + uri);
                DU.declareNS(elemNode, parts.length == 2 ? parts[0]: "", uri);
            }
            makeComplexContent(elemNode, evalChild1(expr, context), context);
            var flags = expr.hasAttribute("flags") ? expr.getAttribute("flags") : "";
            //print("New Element: " + elemNode.toString());
            return Iter.Singleton(markLocal(elemNode, flags));
        },
        empty: function () {
            return Iter.Empty;
        },
        emptyTextNodeRemover: function (expr, context) {
            return evalChild1(expr, context).filter(function (item) {
                return !(item instanceof Node && item.nodeType == DU.TEXT_NODE && item.textContent === "");
            });
        },
        error: function (expr) {
            throw XError(expr.getAttribute("message"), expr.getAttribute("code"), expr);
        },
        evaluate: function (expr, context) {
            var xpath = evaluate(argRole(expr, "xpath"), context).next().toString();
            var src = evaluate(argRole(expr, "cxt"), context);
            var params = evaluate(argRole(expr, "wp"), context);
            var namespaces = {};
            var nsContext = argRole(expr, "nsCxt");
            var i;
            //nsContext = nsContext ? evaluate(nsContext, context): context;
             if (nsContext ) {
                var n = evaluate(nsContext, context).next();
                var atts = n.attributes;
                for (i = 0; i < atts.length;++ i) {
                    var a = atts[i];
                    if (a.prefix == "xmlns") {
                        namespaces[a.localName] = a.value;
                    }
                }
            } else {
                var ns = DU.getInheritedAttribute(expr, "ns");
                if (ns !== null) {
                    var decls = ns.split(" ");
                    for (i = 0; i < decls.length; i++) {
                        var pair = decls[i].split("=");
                        namespaces[pair[0]]=pair[1];
                    }
                }
            }
            var options = {params: params,namespaces:namespaces};
            var baseURI = argRole(expr, "baseUri");
            if(baseURI) {
                options.staticBaseURI = evaluate(baseURI,context).next().toString();
            }
            
            var z = SaxonJS.XPath.evaluateXDM(xpath, src, params, context, namespaces,options);
            return z;
        },
        every: function (expr, context) {
            var slot = parseInt(expr.getAttribute("slot"), 10);
            var iter = evalChild1(expr, context);
            var satisfies = arg2Fn(expr);
            return Iter.oneBoolean(! iter.some(function (item) {
                context.localVars[slot] =[item];
                return ! ebv(satisfies(context));
            }));
        },
        except: function (expr, context) {
            var lhs = evalChild1(expr, context);
            var rhs = evalChild2(expr, context);
            return Iter.Difference(lhs, rhs, DU.compareDocumentOrder);
        },
        false: function () {
            return Iter.oneBoolean(false);
        },
        filter: function (expr, context) {
            var input = evalChild1(expr, context);
            var predFn = arg2Fn(expr);
            if (hasFlag(expr, "i")) {
                // filter is independent of the focus (probably but not necessarily numeric)
                var predicate = predFn(context).expand();
                if (predicate.length == 1 && Atomic.numeric.matches(predicate[0])) {
                    var subscript = predicate[0].toNumber();
                    if (input instanceof Iter.ForArray) {
                        return Iter.Singleton(input.expand()[subscript - 1]);
                    } else {
                        var tracker = Iter.Tracker(input);
                        return tracker.filter(function () {
                            return tracker.position == subscript;
                        });
                    }
                } else {
                    //print("predicate " + showValue(predicate));
                    //print("EBV: " + ebv(Iter.ForArray(predicate)));
                    return ebv(Iter.ForArray(predicate)) ? input: Iter.Empty;
                }
            }
            var c2 = context.newContext(false);
            c2.focus = Iter.Tracker(input);            
            var condition;
            if (hasFlag(expr, "p")) {
                // Positional
                condition = function () {
                    //print("matching item " + c2.focus.current);
                    var predicate = predFn(c2).expand();
                    if (predicate.length == 1 && Atomic.numeric.matches(predicate[0])) {
                        //print("predicate position = " + c2.focus.position + " =? " + showValue(predicate[0]));
                        return c2.focus.position == predicate[0].toNumber();
                        //print("matches? " + result);
                    } else {
                        return ebv(Iter.ForArray(predicate));
                    }
                };
            } else {
                condition = function () {
                    return ebv(predFn(c2));
                };
            }
            return c2.focus.filter(condition);
        },
        first: function (expr, context) {
            return Iter.Singleton(evalChild1(expr, context).next());
        },
        fnRef: function (expr) {
            throw XError("Saxon-JS does not support higher-order functions", "XTSE3540", expr);
        },
        follows: function (expr, context) {
            return Iter.Singleton(
            binaryOperator(expr, context, function (a, b) {
                return Atomic. boolean.fromBoolean(DU.compareDocumentOrder(a, b) > 0);
            }));
        },
        "for": function (expr, context) {
            var slot = parseInt(expr.getAttribute("slot"), 10);
            var action = arg2Fn(expr);
            return evalChild1(expr, context).mapOneToMany(function (item) {
                context.localVars[slot] =[item];
                //print("for loop item " + showValue(item));
                return action(context);
            });
        },
        forEach: function (expr, context) {
            var c2 = context.newContext(false);
            c2.focus = Iter.Tracker(evalChild1(expr, context));
            c2.currentTemplate = null;
            var action = arg2Fn(expr);
            var mapper = function () {
                //print("forEach action .=" + showValue(c2.focus.current));
                return action(c2);
            };
            return c2.focus.mapOneToMany(mapper);
        },
        forEachGroup: function (expr, context) {
            return Compare.grouping(expr, context);
        },
        fn: function (expr, context) {
            var funct = CoreFn[expr.getAttribute("name")];
            if (!funct) {
                notImplemented(expr.getAttribute("name") + "()", expr);
            }
            var args = DU.getChildElements(expr).map(
            function (e) {
                return evaluate(e, context);
            });
            return funct(args, context, expr);
        },
        functionCall: function (expr) {
            notImplemented(expr.getAttribute("name") + "()", expr);
        },
        gc: Compare.generalComparison,
        gc10: function (expr, context) {
            function singleBool(a) {
                return (a.length == 1 && Atomic. boolean.matches(a[0]));
            }
            function toEbvArray(a) {
                return[Atomic. boolean.fromBoolean(ebv(Iter.ForArray(a)))];
            }
            var lhs = evalChild1(expr, context).expand();
            var rhs = evalChild2(expr, context).expand();
            if (singleBool(lhs)) {
                rhs = toEbvArray(rhs);
            } else if (singleBool(rhs)) {
                lhs = toEbvArray(lhs);
            } else {
                lhs = Iter.ForArray(lhs).mapOneToMany(atomize).expand();
                rhs = Iter.ForArray(rhs).mapOneToMany(atomize).expand();
            }            
            var comparer = Compare.allocateCodedComparer(expr.getAttribute("comp"));
            return Compare.gc(Iter.ForArray(lhs), rhs, expr.getAttribute("op"), comparer);
        },
        gcEE: Compare.generalComparison,
        gVarRef: function (expr, context) {
            var name = expr.getAttribute("name");
            //print("gVarRefName: " + name);
            var glob = context.fixed.globalVars[name];
            if (!glob.decl) {
                internalError("Missing global $" + name, expr);
            }
            if (glob.value === null) {
                //print("evaluating global $" + name + ": " + glob.decl);
                if (glob.decl.tagName == "globalParam") {
                    var supplied = context.fixed.options.stylesheetParams[name];
                    if (supplied === undefined && /^Q\{\}/.test(name)) {
                        supplied = context.fixed.options.stylesheetParams[Atomic.QName.fromEQName(name).local];
                    }
                    if (supplied !== undefined) {
                        if (supplied === null) {
                            supplied = [];
                        }
                        //print("Found supplied parameter " + name + " = " + supplied + " (type " + typeof supplied + ")");
                        /*jslint evil: true */
                        var acceptor = new Function ('val', glob.decl.getAttribute("jsAcceptor"));
                        //print("Converting using " + glob.decl.getAttribute("jsAcceptor"));
                        /*jslint evil: true */
                        var cardCheck = new Function ('n', glob.decl.getAttribute("jsCardCheck") + ' return c(n);');
                        //print("Cardinality Checker " + cardCheck);
                        var converted = convertParamFromJS(supplied, cardCheck, acceptor, name);
                        glob.value = Array.isArray(converted) ? converted:[converted];
                        //print("Converted param " + name + " = " + showValue(glob.value));
                    } else {
                        //print("Parameter " + name + " not supplied");
                        if (hasFlag(glob.decl, "r")) {
                            throw XError("Parameter " + name + " is required", "XTDE0050", glob);
                        } else if (hasFlag(glob.decl, "i")) {
                            throw XError("Parameter " + name + " cannot be empty", "XTDE0700", glob);
                        } else if (DU.getChildElements(glob.decl).length === 0) {
                            //print("Defaulting parameter " + name + " to empty sequence");
                            glob.value =[];
                        }
                    }
                }
                if (glob.value === null) {
                    // if glob.decl.tagName != "globalParam", i.e. if glob.decl.tagName == "globalVariable"
                    var c2 = context.newContext(true);
                    c2.tempOutputState = "variable";
                    c2.currentMode = context.fixed.modes[ ""];
                    c2.currentTemplate = null;
                    c2.focus = Iter.Tracker(Iter.Singleton(context.fixed.globalContextItem));
                    c2.focus.next();
                    try {
                        glob.value = evalChild1(glob.decl, c2).expand();
                    }
                    catch (e) {
                        if (e instanceof XError) {
                            if (Atomic.QName.fromEQName(name).uri != "http://saxon.sf.net/generated-variable") {
                                e.isGlobal = true;
                                // Only set 'e.isGlobal =  true' if it was a global parameter in the original stylesheet,
                                // not when it has been generated
                            }
                        }
                        throw e;
                    }
                    //print("global $" + name + " = " + showValue(glob.value));
                }
            }
            return Iter.ForArray(glob.value);
        },
        homCheck: function (expr, context) {
            var base = new Iter.LookAhead(evalChild1(expr, context));
            var first = base.peek();
            if (first === null) {
                return Iter.Empty;
            } else {
                var expectNodes = (DU.isNode(first));
                var checker = base.filter(function (item) {
                    if (DU.isNode(item) != expectNodes) {
                        throw XError("Cannot mix nodes and atomic values in the result of a path expression", "XPTY0018", expr);
                    }
                    return true;
                });
                return expectNodes ? DU.inDocumentOrder(checker): checker;
            }
        },
        ifCall: function (expr, context) {
            var name = DU.getAttributeAsQName(expr, "name", false);
            var wait, c2, fn;
            // ixsl:schedule-action is a hack because we can't evaluate the action expression until after waiting.
            if (name.local == "schedule-action") {
                // From Saxon 9.7.0.8, document attribute added; expression inserted as 2nd child between wait and callT
                var using9707 = DU.getChildElements(expr).length != 3;
                wait = evalChild1(expr, context).next().toNumber();
                var document = using9707 ? null : evalChild2(expr, context).next();
                //print("schedule action wait = " + wait);
                c2 = context.newContext(false);
                c2.clearGrouping();
                if (context.focus) {
                    //print("context.focus.current " + context.focus.current);
                    c2.focus = new Iter.Tracker(new Iter.Singleton(context.focus.current));
                    c2.focus.next();
                }

                var callT = DU.getChildElements(expr)[using9707 ? 1 : 2];
                var tName = DU.getAttributeAsEQName(callT, "name");
                var target = context.fixed.namedTemplates[tName];
                if (target === null) {
                    internalError("Template " + tName + " not found", callT);
                }
                assembleParams(callT, context, c2);

                fn = function () {
                    //print("scheduled action triggered");
                    evalChild1(target, c2).expand();
                    // force evaluation
                };
                if (document !== null) {
                    var abs = SaxonJS.getPlatform().resolveUri(document.toString(), Expr.staticBaseUri(expr, context));
                    if (!context.fixed.documentPool[abs]) {
                        SaxonJS.getPlatform().asyncGetXml(abs, function (uri, doc) {
                            //print("Added document to pool " + uri);
                            context.fixed.documentPool[uri] = doc;
                            fn();
                        });
                    } else {
                        //print("Found " + abs + " in pool");
                        fn();
                    }
                } else if (wait !== 0) {
                    setTimeout(fn, wait);
                }

                return Iter.Empty;
            }
            var args = DU.getChildElements(expr).map(
            function (e, n) {
                return evaluate(e, context);
            });
            //print("ifCall " + name.uri + " - " + name.local);
            return ExtraFn(name.uri, name.local, args, context, expr);
        },
        indexedFilter: function (expr, context) {
            // Ignore the indexing optimization
            var c2 = context.newContext(false);
            c2.focus = Iter.Tracker(evalChild1(expr, context));
            var pred = arg2Fn(expr);
            var condition = function () {
                return ebv(pred(c2));
            };
            return c2.focus.filter(condition);
        },
        indexedLookup: function (expr, context) {
            return Compare.generalComparison(expr, context, "=");
        },
        inlineFn: function (expr) {
            notImplemented("inline function", expr);
        },
        instance: function (expr, context) {
            var cardinality = {
                "*": {
                    min: 0, max: Infinity
                },
                "+": {
                    min: 1, max: Infinity
                },
                "?": {
                    min: 0, max: 1
                },
                "°": {
                    min: 0, max: 0
                },
                "1": {
                    min: 1, max: 1
                }
            };
            var val = evalChild1(expr, context);
            var typeDef = expr.getAttribute("of");
            if (typeDef == "empty-sequence()") {
                return Iter.oneBoolean(val.next() === null);
            }
            //print("instance of type: " + typeDef);
            var kleene = typeDef.charAt(typeDef.length - 1);
            //print("Kleene: " + kleene);
            var hasKleene = ("*+?°".indexOf(kleene) >= 0);
            var card = cardinality[hasKleene ? kleene: "1"];
            if (hasKleene) {
                typeDef = typeDef.substring(0, typeDef.length - 1);
            }
            //print("Card: " + card.min + ", " + card.max);
            /*jslint evil: true */
            var test = new Function ('item', expr.getAttribute("jsTest"));
            var item;
            var count = 0;
            while ((item = val.next()) !== null) {
                //print(showValue(item) + " instance-of " + type.name);
                if (++ count > card.max || ! test(item)) {
                    //print("Not instance. " + (count > card.max ? "Found " + count + "items." : " Non-matching item."));
                    return Iter.oneBoolean(false);
                }
            }
            return Iter.oneBoolean(count >= card.min);
        },
        int: function (expr) {
            var value = expr.getAttribute("val");
            return Iter.Singleton(Atomic.integer.fromString(value));
        },
        intersect: function (expr, context) {
            var lhs = evalChild1(expr, context);
            var rhs = evalChild2(expr, context);
            return Iter.Intersect(lhs, rhs, DU.compareDocumentOrder);
        },
        intRangeTest: function (expr, context) {
            var lhs = evalChild1(expr, context);
            var kids = DU.getChildElements(expr);
            var min = evaluate(kids[1], context).next().toNumber();
            var max = evaluate(kids[2], context).next().toNumber();
            var match = lhs.some(function (item) {
                var v = item.value;
                return v >= min && v <= max;
            });
            return Iter.oneBoolean(match);
        },
        is: function (expr, context) {
            return Iter.Singleton(
            binaryOperator(expr, context, function (a, b) {
                return Atomic. boolean.fromBoolean(DU.isSameNode(a, b));
            }));
        },
        isLast: function (expr, context) {
            return Iter.oneBoolean((context.focus.position == context.focus.last()) == (expr.getAttribute("test") == "1"));
        },
        iterate: function (expr, context) {
            var params = DU.getChildElements(DU.getChildElements(expr)[1]);
            params.forEach(function (p) {
                evaluate(p,context);
            }); 
            var c2 = context.newContext(false);
            c2.focus = Iter.Tracker(evalChild1(expr, context));
            c2.currentTemplate = null;
            var action = argRole(expr, "action");
            var completion = argRole(expr, "on-completion");
            var result = [];
            var c;
            var broken = false;
            while((c = c2.focus.next()) !== null) {
                var c3 = c2.newContext(false);
                c3.focus.current = c;
                var seq = Expr.evaluate(action, c3);               
                Array.prototype.push.apply(result,(seq.expand()));
                 if(result[result.length - 1] instanceof BreakIndicator) {
                    result.pop();
                    broken = true;
                    break;
                }
                c2.localVars = c3.localVars;
            } 
            if(!broken && completion !== null) {
                 Array.prototype.push.apply(result,(Expr.evaluate(completion, c2).expand()));
            }
            return Iter.ForArray(result);
        },
        lastOf: function (expr, context) {
            var lookAhead = Iter.LookAhead(evalChild1(expr, context));
            return lookAhead.filter(function () {
                return lookAhead.peek() === null;
            });
        },
       
        let: function (expr, context) {
            // Because we evaluate the variable fully, we can modify context in-situ
            var oldTempOutputState = context.tempOutputState;
            context.tempOutputState = "variable";
            var value = evalChild1(expr, context).expand();
            context.tempOutputState = oldTempOutputState;
            var slot = parseInt(expr.getAttribute("slot"), 10);
            //print("let $" + expr.getAttribute("var") + " := " + showValue(value));
            context.localVars[slot] = value;
            return evalChild2(expr, context);
        }, 
        literal: function (expr, context) {
            var iterators = DU.getChildElements(expr).map(
            function (e) {
                return evaluate(e, context);
            });
            return Iter.Join(iterators);
        },
        map: function (expr, context) {
            var m = new HashTrie();
            var key = null;
            DU.getChildElements(expr).forEach(function (v) {
                if (key === null) {
                    key = evaluate(v, context).next();
                } else {
                    m.inSituPut(key, evaluate(v, context).expand());
                    key = null;
                }
            });
            return Iter.Singleton(m);
        },
        merge: function (expr) {
            notImplemented("xsl:merge", expr);
        },
        mergeAdj: function (expr, context) {
            // merge adjacent text nodes
            function isTextNode(item) {
                return item instanceof Node && item.nodeType == DU.TEXT_NODE;
            }
            
            var result =[];
            var iter = evalChild1(expr, context);
            var prevIsText = false;
            var item;
            while ((item = iter.next()) !== null) {
                var thisIsText = isTextNode(item);
                if (!(thisIsText && item.nodeValue === "")) {
                    if (prevIsText && thisIsText) {
                        result.push(context.resultDocument.createTextNode(result.pop().nodeValue + item.nodeValue));
                    } else {
                        prevIsText = thisIsText;
                        result.push(item);
                    }
                }
            }
            //print("after mergeAdj: " + result.length);
            return Iter.ForArray(result);
        },
        message: function (expr, context) {
            var msg = "";
            // Because we evaluate the variable fully, we can modify context in-situ
            var oldTempOutputState = context.tempOutputState;
            context.tempOutputState = "variable";
            evalChild1(expr, context).mapOneToMany(atomize).forEachItem(function (it) {
                msg += " " + it.toString();
            });
            var terminate = evaluate(argRole(expr, "terminate"), context).next();
            var code = evaluate(argRole(expr, "error"), context).next();
            if (terminate == "yes" || terminate == "true" || terminate == "1") {
                throw XError("Terminated with " + msg, code.toString(), expr);
            } else {
                if (context.fixed.options.deliverMessage) {
                    context.fixed.options.deliverMessage(msg);
                }
            }
            context.tempOutputState = oldTempOutputState;
            return Iter.Empty;
        },
        minus: function (expr, context) {
            // unary minus
            return evalChild1(expr, context).mapOneToOne(function (item) {
                return item.negate();
            });
        },
        namespace: function (expr, context) {
            var prefix = evalChild1(expr, context).next().toString();
            var uri = evalChild2(expr, context).next().toString();
            if (prefix !== "" && ! Regex.isNCName(prefix)) {
                throw XError("Prefix " + prefix + " is not an NCName", "XTDE0920", expr);
            }
            if (prefix == "xmlns" || uri == "http://www.w3.org/2000/xmlns/") {
                throw XError("Disallowed prefix/namespace " + uri, "XTDE0835", expr);
            }
            return Iter.Singleton(new NamespaceNode(prefix, uri));
        },
        nextIteration: function (expr, context) { 
            var withParams = DU.getChildElements(expr, "withParam"); 
            var tempVars = [];
            withParams.forEach(function (wp) {
                var slot = parseInt(wp.getAttribute("slot"), 10);
                tempVars[slot] = evalChild1(wp, context).expand();
             });
             for(var slot in tempVars) {
                 context.localVars[slot] = tempVars[slot];
             }             
             return Iter.Empty;
        },
        nextMatch: function (expr, context) {
            var mode = context.currentMode;
            var rule = context.currentTemplate;
            if (! rule) {
                throw XError("xsl:next-match: there is no current template", "XTDE0560", expr);
            }
            var c2 = context.newContext(true);
            assembleParams(expr, context, c2);
            return mode.nextMatch(c2);
        },
        nodeNum: function (expr, context) {
            return Numberer.nodeNum(expr, context);
        },
        numSeqFmt: function (expr, context) {
            return Numberer.numSeqFmt(expr, context);
        },
        or: function (expr, context) {
            return Iter.oneBoolean(ebv(evalChild1(expr, context)) || ebv(evalChild2(expr, context)));
        },
        param: function (expr, context) {
            var name = DU.getAttributeAsEQName(expr, "name");
            var slot = parseInt(expr.getAttribute("slot"), 10);
            var tunnel = hasFlag(expr, "t");
            var paramSet = tunnel ? context.tunnelParams: context.localParams;
            var value = paramSet[name];
            if (! value) {
                var fallback = argRole(expr, "select");
                if (fallback && ! hasFlag(expr, "r")) {
                    var oldTempOutputState = context.tempOutputState;
                    context.tempOutputState = "xsl:param";
                    value = evaluate(fallback, context).expand();
                    context.tempOutputState = oldTempOutputState;
                    //print("param " + name + " defaulting to " + showValue(value));
                } else {
                    throw XError("Required parameter $" + name + " not supplied", "XTDE0700", expr);
                }
            }
            //print("Set slot " + slot + "(of " + context.depth + ") to " + showValue(value));
            if (!(typeof value == "object" && "length" in value)) {
                throw XError("Param value of $" + name + " is not an array", "SXJS0004", expr);
            }
            context.localVars[slot] = value;
            var conv = argRole(expr, "conversion");
            if (conv !== null) {
                //print("Converting " + name + ": " + showValue(value));
                context.localVars[slot] = evaluate(conv, context).expand();
            }
            return Iter.Empty;
        },
        precedes: function (expr, context) {
            return Iter.Singleton(
            binaryOperator(expr, context, function (a, b) {
                return Atomic. boolean.fromBoolean(DU.compareDocumentOrder(a, b) < 0);
            }));
        },
        procInst: function (expr, context) {
            var name = evalChild1(expr, context).next().value;
            var content = evalChild2(expr, context);
            var piNode = context.resultDocument.createProcessingInstruction(name, makeSimpleContent(content));
            return Iter.Singleton(piNode);
        },
        qName: function (expr) {
            var pre = expr.getAttribute("pre");
            var uri = expr.getAttribute("uri");
            var loc = expr.getAttribute("loc");
            return Iter.Singleton(Atomic.QName.fromParts(pre, uri, loc));
        },
        range: function (expr) {
            var a = Atomic.integer.fromString(expr.getAttribute("from"));
            var b = Atomic.integer.fromString(expr.getAttribute("to"));
            return range(a, b);
        },
        resultDoc: function (expr, context) {
            if (context.tempOutputState) {
                throw XError("Cannot call xsl:result-document while evaluating " + context.tempOutputState, "XTDE1480", expr);
            }
            var hrefExp = argRole(expr, "href");
            var href = hrefExp === null ? "": evaluate(hrefExp, context).next().toString();
            //print("result document " + href);
            var replaceContent = false;
            expr.getAttribute("local").split(/\r?\n/).forEach(function (line) {
                if (/^method=/.test(line)) {
                    replaceContent = /interactiveXSLT\}replace-content$/.test(line);
                }
            });
            var target;
            var intoHTML = href.charAt(0) == "#" || href == "?.";
            //print("result document intoHTML " + intoHTML);
            var doc = newDoc(argRole(expr, "content"), context, intoHTML);
            var moveToTarget = function (doc, target) {
                Axis.child(doc).forEachItem(function (item) {
                    target.appendChild(item);
                });
            };
            if (href === "") {
                // Not quite accurate...
                return Iter.Singleton(doc);
            } else if (intoHTML) {
                //print("result-document href=" + href);
                // TODO check that context.focus.current is in the window.document 
                target = href == "?." ? context.focus.current : window.document.getElementById(href.substring(1));
                if (! target) {
                    print("Result document href=" + href + ": no such node");
                    return Iter.Empty;
                }
                if (replaceContent) {
                    target.innerHTML = "";
                }
                moveToTarget(doc, target);
                return Iter.Empty;
            /*} else if (href.charAt(0) == "?") { // include this in intoHTML branch?
                /!*Very limited support for XPath 1 - no namespaces etc.
                Note that it produces a snapshot so multiple nodes could be affected - caveat emptor  Doesn't work in IE*!/
                var path = href.substr(1);
                var xpathResult = window.document.evaluate(path, context.focus.current, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                for (var i = 0; i < xpathResult.snapshotLength; i++) {
                    target = xpathResult.snapshotItem(i);
                    if (replaceContent) {
                        target.innerHTML = "";
                    }
                    moveToTarget(doc, target);
                }
                return Iter.Empty;*/
            } else {
                //print("result-document href=" + href);
                if (context.fixed.resultDocUris[href]) {
                    throw XError("A result document with URI " + href + " has already been created", "XTDE1490", expr);
                }
                context.fixed.resultDocUris[href] = true;
                context.fixed.options.deliverResultDocument(href, doc);
                return Iter.Empty;
            }
        },
        root: function (expr, context) {
            if (!context.focus.current) {
                throw XError("Focus is absent", "XPDY0002", expr);
            }
            var item = context.focus.current;
            if (! DU.isNode(item)) {
                throw XError("Context item for '/' must be a node", "XPTY0020", expr);
            }
            var root = DU.ownerDocument(item);
            if (root.nodeType != DU.DOCUMENT_NODE && root.nodeType != DU.DOCUMENT_FRAGMENT_NODE) {
                throw XError("Root node for '/' must be a document node", "XPDY0050", expr);
            }
            return Iter.Singleton(DU.ownerDocument(item));
        },
        sequence: function (expr, context) {
            var kids = DU.getChildElements(expr);
            var iterators = kids.map(function (expr) {
                return evaluate(expr, context);
            });
            return Iter.Join(iterators);
        },
        slash: function (expr, context) {
            var c2 = context.newContext(false);
            c2.focus = Iter.Tracker(evalChild1(expr, context));
            var rhs = arg2Fn(expr);
            var mapper = function () {
                return rhs(c2);
            };
            return c2.focus.mapOneToMany(mapper);
        },
        some: function (expr, context) {
            var slot = parseInt(expr.getAttribute("slot"), 10);
            var iter = evalChild1(expr, context);
            var satisfies = arg2Fn(expr);
            return Iter.oneBoolean(
            iter.some(function (item) {
                context.localVars[slot] =[item];
                return ebv(satisfies(context));
            }));
        },
        sort: Compare.sortSequence,
        str: function (expr) {
            var value = expr.getAttribute("val");
            return Iter.oneString(value);
        },
        subscript: function (expr, context) {
            var base = evalChild1(expr, context);
            var subscript = evalChild2(expr, context).next().value;
            if (base instanceof Iter.ForArray) {
                var value = base.expand()[subscript - 1];
                if (value === undefined) {
                    value = null;
                }
                return Iter.Singleton(value);
            } else {
                var first = base.mapOneToOne(function (item, index) {
                    //print ("index = " + index);
                    return index + 1 == subscript ? item: null;
                }).next();
                return Iter.Singleton(first);
            }
        },
        supplied: function (expr, context) {
            var slot = parseInt(expr.getAttribute("slot"), 10);
            var value = context.localVars[slot];
            //print("Found supplied slot " + slot + " $" + expr.getAttribute("name") + " = " + value);
            return Iter.ForArray(value);
        },
        "switch": function (expr, context) {
            // "switch" no longer found in SEFs from 9.7.0.15
            var saxonVersion = context.fixed.options.saxonVersion;
            if (saxonVersion && saxonVersion.substring(0,5) == "9.7.0") {
                if (parseInt(saxonVersion.split(".")[3], 10) < 15) {
                    // regenerate SEFs generated by 9.7.0.14 or earlier
                    regenerateSEF("9.7.0.15", expr);
                }
            }
            // TODO remove code entirely? Comment out? Or does XPath use it?
            var lhs = evalChild1(expr, context).next();
            //print("switch lhs: " + showValue(lhs));
            if (lhs === null) {
                return Iter.oneBoolean(false);
            }
            lhs = Atomic.base64Binary.cast(lhs);
            var cases = DU.getChildElements(expr, "case");
            for (var c = 0; c < cases.length; c++) {
                var caseVal = evalChild1(cases[c], context).next();
                //print("switch rhs: " + showValue(caseVal));
                if (caseVal.equals(lhs)) {
                    return evalChild2(cases[c], context);
                }
            }
            return evaluate(argRole(expr, "default"), context);
        },
        tail: function (expr, context) {
            var start = parseInt(expr.getAttribute("start"), 10) - 1;
            return evalChild1(expr, context).filter(function (item) {
                return start-- <= 0;
            });
        },
        tailCallLoop: function (expr, context) {
            // TODO: optimize tail calls
            return evalChild1(expr, context);
        },
        to: function (expr, context) {
            var start = evalChild1(expr, context).next();
            var end = evalChild2(expr, context).next();
            if (start === null || end === null || start.compareTo(end) > 0) {
                return Iter.Empty;
            }
            //print("from " + showValue(start) + " to " + showValue(end));
            return range(start, end);
        },
        treat: function (expr, context) {
            /*jslint evil: true */
            var test = new Function ('item', expr.getAttribute("jsTest"));
            //print("treat: " + expr.getAttribute("jsTest"));
            return evalChild1(expr, context).mapOneToOne(function (item) {
                //print("Testing " + showValue(item) + " against " + expr.getAttribute("as"));
                if (! test(item)) {
                    var x = roleDiagnostic(expr.getAttribute("diag"));
                    throw XError("Required item type of " + x.required + " is " + expr.getAttribute("as") +
                    "; supplied value is " + showValue(item), x.code, expr);
                } else {
                    return item;
                }
            });
        },
        true: function () {
            return Iter.oneBoolean(true);
        },
        try: function (expr, context) {
            // Allow the catch to be suppressed so we can get a stack trace
            var CATCH = true;
            if (CATCH) {
                try {
                    return Iter.ForArray(evalChild1(expr, context).expand());
                }
                catch (e /*if e instanceof XError*/) {
                    //Ugllify can't handle the "instance of" extension
                    //print("Caught error: " + e + " - " + e.code);
                    if (e instanceof XError && ! e.isGlobal) {
                        context.currentError = e;
                        if (e.compiledLineNr === null) {
                            e.setExpr(expr);
                        }
                        var q = Atomic.QName.fromParts("", "http://www.w3.org/2005/xqt-errors", e.code);
                        var catches = Iter.ForArray(DU.getChildElements(expr, "catch"));
                        var catcher;
                        while ((catcher = catches.next()) !== null) {
                            /*jslint evil: true */
                            var matches = new Function ('q', "return " + catcher.getAttribute("test") + ";");
                            if (matches(q)) {
                                //print("Catch match");
                                return evalChild1(catcher, context);
                            }
                        }
                        throw e;
                    } else if (e instanceof XError) {
                        throw e;
                    } else {
                        if (Error.dumpStack) {
                            Error.dumpStack();
                        }
                        throw e;
                    }
                }
            } else {
                return evalChild1(expr, context);
            }
        },
        ufCall: function (expr, context) {
            var name = DU.getAttributeAsEQName(expr, "name");
            var args = DU.getChildElements(expr);
            var target = context.fixed.userFunctions[name + "#" + args.length];
            if (target === null) {
                internalError("Function " + name + "#" + args.length + " not found");
            }
            var c2 = context.newContext(true);
            c2.clearGrouping();
            c2.tempOutputState = "function";
            c2.currentMode = context.fixed.modes[ ""];
            c2.currentTemplate = null;
            c2.localVars = args.map(
            function (arg) {
                return evaluate(arg, context).expand();
            });
            //c2.localVars.forEach(function(v, i) {print("Arg " + i + " = " + v.join(","))});
            c2.localParams = {
            };
            return evaluate(target, c2);
        },
        union: function (expr, context) {
            var lhs = evalChild1(expr, context);
            var rhs = evalChild2(expr, context);
            return Iter.Union(lhs, rhs, DU.compareDocumentOrder);
        },
        useAS: function (expr, context) {
            var name = DU.getAttributeAsEQName(expr, "name");
            var target = context.fixed.attributeSets[name];
            if (target === null) {
                internalError("Attribute set " + name + " not found", expr);
            }
            var c2 = context.newContext(true);
            c2.tempOutputState = "attribute set";
            return evalChild1(target, c2);
        },
        vc: function (expr, context) {
            function untypedToStr(val) {
                return val === null ? null: Atomic.untypedAtomic.matches(val) ? Atomic.string.cast(val): val;
            }
            
            var op = expr.getAttribute("op");
            var onEmpty = expr.getAttribute("onEmpty");
            
            var lchild = evalChild1(expr, context);
            var rchild = evalChild2(expr, context);
            var lhs = untypedToStr(lchild.next());
            var rhs = untypedToStr(rchild.next());
            if (lhs === null || rhs === null) {
                return onEmpty ? Iter.oneBoolean(onEmpty == "1") : Iter.Empty;
            }
            if (lchild.next() !== null || rchild.next() !== null) {
                throw XError("Value comparison only applicable to single values", "XPTY0004", expr);
            }            
            /* NaN comparisons are treated specially */
            if ((Atomic.isSubtype(lhs.type, "numeric") && isNaN(lhs.value)) ||
            (Atomic.isSubtype(rhs.type, "numeric") && isNaN(rhs.value))) {
                return Iter.oneBoolean(op == "ne");
            }
             //print("Comparing " + showValue(lhs) + " with " + showValue(rhs) + " with comparer " + expr.getAttribute("comp"));
            var comparer = Compare.allocateCodedComparer(expr.getAttribute("comp"));
            if (op == "=" || op == "eq" || op == "!=" || op == "ne") {
                //print("comparing " + showValue(lhs) + " to " + showValue(rhs));
                return Iter.oneBoolean(Compare.testEquality(op, comparer.equals(lhs, rhs)));
            } else {
                return Iter.oneBoolean(Compare.testComparison(op, comparer.compare(lhs, rhs)));
            }
        },
        valueOf: function (expr, context) {
            var content = evalChild1(expr, context);
            var textNode = context.resultDocument.createTextNode(makeSimpleContent(content));
            var flags = expr.hasAttribute("flags") ? expr.getAttribute("flags") : "";
            return Iter.Singleton(markLocal(textNode, flags));
        },
        varRef: function (expr, context) {
            var slot = parseInt(expr.getAttribute("slot"), 10);
            var value = context.localVars[slot];
            //print("$" + expr.getAttribute("name") + " = " + showValue(value));
            return Iter.ForArray(value);
        },
        xslNumber: function (expr, context) {
            return Numberer.xslNumber(expr, context);
        },
        styleValue: function (expr, context) { // TODO When is this used?
            var prop = expr.getAttribute("name");
            return Iter.oneString(context.focus.current.style[prop]);
        }
    };
    
   
    
    function roleDiagnostic(str) {
        var parts = str.split("|");
        var kind = parts[0];
        var operand = parts[1];
        var errorCode = parts[2] === "" ? "XPTY0004": parts[2];
        var name = parts[3];

        var axisName = [
            "ancestor",             // ANCESTOR
            "ancestor-or-self",     // ANCESTOR_OR_SELF;
            "attribute",            // ATTRIBUTE;
            "child",                // CHILD;
            "descendant",           // DESCENDANT;
            "descendant-or-self",   // DESCENDANT_OR_SELF;
            "following",            // FOLLOWING;
            "following-sibling",    // FOLLOWING_SIBLING;
            "namespace",            // NAMESPACE;
            "parent",               // PARENT;
            "preceding",            // PRECEDING;
            "preceding-sibling",    // PRECEDING_SIBLING;
            "self",                 // SELF;
            "preceding-or-ancestor" // PRECEDING_OR_ANCESTOR;
        ];
        
        var ordinal = function (n) {
            switch (n) {
                case 1:
                return "first";
                case 2:
                return "second";
                case 3:
                return "third";
                default:
                return n + "th";
            }
        };
        var getMessage = function () {
            switch (parseInt(kind, 10)) {
                case 0:
                return ordinal(+ operand + 1) + " argument of " +
                (name === "" ? "anonymous function": name + "()");
                case 1:
                return ordinal(+ operand + 1) + " operand of '" + name + '\'';
                case 9:
                return "operand of '-'";
                case 2:
                return "value in '" + name + "' expression";
                case 3:
                    return name == "saxon:context-item" ? "context item" : "value of variable $" + name;
                case 4:
                var p = name.split("/");
                return '@' + p[1] + " attribute of " + (p[0] == "LRE" ? "a literal result element": p[0]);
                case 5:
                return "result of call to " + (name === "" ? "anonymous function": "function " + name);
                case 7:
                return "result of template " + name;
                case 6:
                return ordinal(+ operand + 1) + " sort key";
                case 8:
                return "value of parameter $" + name;
                case 11:
                return "value of the grouping key";
                case 13:
                return "the context item";
                case 14:
                return "the context item for the " + axisName[operand] + " axis";
                case 15:
                return "the value of the " + name + " option";
                case 17:
                return "document-order sorter";
                default:
                return "";
            }
        };
        return {
            required: getMessage(), code: errorCode
        };
    }
    
    /**
     * Analyze a string using a regular expression
     * @param input the input string
     * @param regex the regular expression (in XPath dialect)
     * @param flags the regular expression flags (in XPath dialect)
     * @param allowZeroLength true if a regex that matches a zero-length string is permitted
     * @param nonMatchEmptyStr true if non-matching empty strings should be included in details 
     * (true for use by fn:tokenize(), but false for fn:analyze-string() and xsl:analyze-string)
     * @returns Array of objects representing the matching and non-matching parts of the
     * input string. The objects contain the entries: matching:true|false; string: the matching or
     * non-matching string; groups: the captured groups
     */
    
    function analyze(input, regex, flags, allowZeroLength, nonMatchEmptyStr) {
        if (! flags.match(/^[smijxq]*$/)) {
            throw XError("Illegal flags for regular expression: " + flags, "FORX0001");
        }
        var pattern = Regex.prepareRegex(regex, flags + "g", input);
        if (! allowZeroLength && pattern.test("")) {
            throw XError("Regular expression matches zero-length string", "FORX0003");
        }
        var details =[];
        var result;
        var prevEnd = 0;
        var loops = 0;
        while ((result = pattern.exec(input)) !== null) {
            //print("analyze " + result.index + "-" + pattern.lastIndex + "=" + result[0]);
            if (result.index > prevEnd || (result.index == prevEnd && nonMatchEmptyStr)) {
                details.push({
                    matching: false, string: Atomic.string.fromString(input.substring(prevEnd, result.index))
                });
            }
            details.push({
                matching: true, groups: result, string: Atomic.string.fromString(result[0])
            });
            prevEnd = pattern.lastIndex;
            if (loops++ > 1000) {
                throw XError("looping???", "SXJS0004");
            }
        }
        if (input.length > prevEnd) {
            details.push({
                matching: false, string: Atomic.string.fromString(input.substring(prevEnd, input.length))
            });
        }
        return details;
    }
    
    function wsCollapse(str) {
        return str.replace(/[ \n\r\t]+/g, ' ').replace(/^[ ]|[ ]$/g, '');
    }
    
    /**
     * Atomize a single item, according to XPath rules. Note that although (because we are not schema-aware) the
     * result of atomizing a node is always a single item, this is not the case when arrays are atomized, so in
     * general atomization is a one-to-many operation.
     * @param item the item to be atomized
     * @returns an iterator over: In the case of a node, the typed value of the node.
     * In the case of an atomic value, the supplied value unchanged.
     * In the case of an array, the atomization of the array members in sequence.
     */
    
    function atomize(item) {
        if (DU.isNode(item)) {
            return Iter.Singleton(atomizeNode(item));
        } else if (isArray(item)) {
            return Iter.Join(item.value.map(function (member) {
                return Iter.ForArray(member);
            })).mapOneToMany(atomize);
        } else if (isMap(item)) {
            throw XError("Cannot atomize a map", "FOTY0013");
        } else {
            return Iter.Singleton(item);
        }
    }
    
    function atomizeNode(node) {
        var s = Atomic.string.fromString,
        u = Atomic.untypedAtomic.fromString;
        switch (node.nodeType) {
            case DU.DOCUMENT_NODE:
            return u(node.documentElement.textContent);
            case DU.DOCUMENT_FRAGMENT_NODE:
            case DU.ELEMENT_NODE:
            case DU.TEXT_NODE:
            return u(node.textContent || "");
            case DU.ATTRIBUTE_NODE:
            return u(node.value);
            case DU.COMMENT_NODE:
            return s(node.textContent);
            case DU.PROCESSING_INSTRUCTION_NODE:
            return s(node.data);
            case DU.NAMESPACE_NODE:
            return s(node.uri);
            default:
                throw XError("Unknown node type " + node.nodeType, "SXJS0003");
        }
    }
    
    /**
     * Compute the effective boolean value of a sequence, according to XPath rules
     * @param iter the input sequence, supplied as an iterator
     * @returns a primitive boolean, true or false
     * @throws a dynamic error if EBV is not defined for the type of the sequence
     */
    
    function ebv(iter) {
        var first = iter.next();
        
        function ebvError(reason) {
            throw XError("Effective boolean value is not defined for " + reason, "FORG0006");
        }
        
        function noMore() {
            if (iter.next() !== null) {
                ebvError("an atomic sequence of length > 1");
            } else {
                return true;
            }
        }
        
        if (first === null) {
            return false;
        }
        if (DU.isNode(first)) {
            return true;
        }
        if (Atomic. boolean.matches(first)) {
            return noMore() && first.toBoolean();
        } else if (Atomic.numeric.matches(first)) {
            var n = first.toNumber();
            return noMore() && ! isNaN(n) && n !== 0;
        } else if (Atomic.string.matches(first) || Atomic.untypedAtomic.matches(first) || Atomic.anyURI.matches(first)) {
            return noMore() && first.toString().length !== 0;
        } else {
            ebvError("type " + first.type);
        }
    }
    
    function untypedToDouble(item) {
        return item.type === "untypedAtomic" ? Atomic. double.cast(item): item;
    }
    
    function range(a, b) {
        var arith = Calculate[ "i+i"];
        var one = Atomic.integer.fromNumber(1);
        return Iter.Stepping(a,
        function (item) {
            var next = arith(item, one);
            //print("range i=" + item + " b=" + b + " next=" + next);
            return next.compareTo(b) > 0 ? null: next;
        });
    }
    
    /**
     * Assemble parameters for a template call using call-template, apply-templates, apply-imports, or next-match
     * @param expr the expression
     * @param oldContext context for the calling expression
     * @param newContext context for the called template
     */
    
    function assembleParams(expr, oldContext, newContext) {
        var withParams = DU.getChildElements(expr, "withParam");
        var paramMap =[ {
        },
        {
        }];
        for (var n in oldContext.tunnelParams) {
            if (oldContext.tunnelParams.hasOwnProperty(n)) {
                //print("Existing tunnel param " + n + " = " + showValue(oldContext.tunnelParams[n]));
                paramMap[1][n] = oldContext.tunnelParams[n];
            }
        }
        // Because we evaluate the variable fully, we can modify context in-situ
        var oldTempOutputState = oldContext.tempOutputState;
        oldContext.tempOutputState = "template parameter";
        withParams.forEach(function (wp) {
            var pName = DU.getAttributeAsEQName(wp, "name");
            var tunnel = hasFlag(wp, "t") ? 1: 0;
            paramMap[tunnel][pName] = evalChild1(wp, oldContext).expand();
            //print("New param " + pName + " = " + showValue(paramMap[tunnel][pName]));
            //if (tunnel == 1) {
            //    //print("New tunnel param " + pName + " = " + showValue(paramMap[tunnel][pName]));
            //}
        });
        oldContext.tempOutputState = oldTempOutputState;
        newContext.localParams = paramMap[0];
        newContext.tunnelParams = paramMap[1];
    }

    /* If flags contains 'l' then mark the node as local (to label that the node never needs to be copied). */

    function markLocal(node, flags) {
        if (flags && flags.indexOf("l") >= 0) {
            node._saxonIsLocal = true;
        }
        return node;
    }
    
    function computedElemOrAttr(expr, context, maker) {
        var isAtt = expr.tagName == "compAtt";
        var name = Regex.trim(evaluate(argRole(expr, "name"), context).next().toString());
        var nsExp = argRole(expr, "namespace");
        //print("name, nsExp: " + name + ", " + nsExp);
        var ns, qname;
        if (nsExp === null) {
            if (isAtt && name == "xmlns") {
                throw XError("Attribute must not be named xmlns", "XTDE0855", expr);
            }
            qname = stylesheetQName(expr, name, false);
            // TODO: catch XTDE0290 and replace with a different code.
            ns = qname.uri;
        } else {
            ns = evaluate(nsExp, context).next().value;
            //print("ns " + ns);
            if (isAtt) {
                // TODO: handle conflicts where the prefix needs to be changed - see DU.resolveLexicalQName
                if (ns === "" && name.includes(":")) {
                    name = name.replace(/^.*:/, "");
                    qname = Atomic.QName.fromParts("", ns, name);
                } else if (name.includes(":")) {
                    var parts = name.split(":");
                    qname = Atomic.QName.fromParts(parts[0], ns, parts[1]);
                }
            }
            //print("making " + ns + " == " + name);
        }
        if (ns == "http://www.w3.org/2000/xmlns/") {
            throw XError("Disallowed namespace " + ns, "XTDE0835", expr);
        }
        return isAtt ? Iter.Singleton(maker(qname)) : Iter.Singleton(maker(ns, name));
    }
    
    
    /**
     * Implement a binary operator over singleton values returning null if either operand is null
     */
    
    function binaryOperator(expr, context, fn) {
        var a = evalChild1(expr, context).next();
        var b = evalChild2(expr, context).next();
        if (a === null || b === null) {
            //print("binary operator has a null arg: " + a + " " + b);
            return null;
        } else {
            return fn(a, b);
        }
    }
    
    function getAtomicType(name) {
        if (name.substring(0, 3) == "xs:") {
            var result = Atomic[name.substring(3)];
            if (! result) {
                throw XError("Unimplemented type " + name, "SXJS0002");
            }
            return result;
        } else {
            throw XError("Unknown type " + name, "SXJS0003");
        }
    }
    
    
    function staticBaseUri(expr, context) {
        /* When not in browser, context.fixed.staticBaseURI !== null iff relocatable == "true" (which implies
         * not 9.7). This means that the SEF contains no base URI info.
         * Otherwise, the SEF contains baseUri info, and can be taken from there. */
        if (SaxonJS.getPlatform().inBrowser || context.fixed.staticBaseURI !== null) {
            return context.fixed.staticBaseURI;
        }
        var e = expr;
        while (true) {
            if (e.hasAttribute("baseUri")) { 
                return e.getAttribute("baseUri");
            } else {
                e = DU.xdmParentNode(e);
                if (e === null || e.nodeType != DU.ELEMENT_NODE) {
                    return null;
                }
            }
        }
    }
    
    
    function uriFromStaticContext(expr, prefix) {
        // TODO: redundant, see stylesheetResolver
        var ns = expr.lookupNamespaceURI(prefix);
        if (ns !== null) {
            return ns;
        }
        ns = DU.getInheritedAttribute(expr, "ns");
        if (ns === null) {
            return null;
        }
        var decls = ns.split(" ");
        var i;
        for (i = 0; i < decls.length; i++) {
            var pair = decls[i].split("=");
            if (pair[0] == prefix) {
                return pair[1];
            }/* else if (prefix == "#" && pair[0] === "") {
                return pair[1];
            }*/
            // TODO work in progress...
        }
        return null;
    }
    
    // intoHTMLpage - true when building content to be appended to the HTML page
    function newDoc(contentExpr, context, intoHTMLpage) {
        var doc = context.resultDocument.createDocumentFragment();
        var docNode = DU.obtainDocumentNumber(doc);
        docNode._saxonBaseUri = staticBaseUri(contentExpr, context);
        var c2 = context.newContext(false);
        if (intoHTMLpage) {
            c2.resultDocument = window.document;
        }
        makeComplexContent(docNode, evaluate(contentExpr, c2), c2);
        // docNode is NOT attachable (since it is a document fragment node, used as a dummy parent),
        // so do not set docNode._saxonIsLocal = true;
        return docNode;
    }
    
    function notImplemented(name, src) {
        throw XError("The " + name + " construct is not implemented in Saxon-JS", "SXJS0002", src);
    }

    function regenerateSEF(saxonVersion, src) {
        throw XError("The SEF is out of date, regenerate using Saxon-EE " + saxonVersion + " or later", "SXJS0002", src);
    }
    
    function evalChild1(expr, context) /* returns iterator */ {
        var child1 = DU.getChildElements(expr)[0];
        if (!child1) {
            throw XError("Expr has no children", "SXJS0004", expr);
        }
        return evaluate(child1, context);
    }
    
    function evalChild2(expr, context) /* returns iterator */ {
        return evaluate(DU.getChildElements(expr)[1], context);
    }
    
    function argRole(expr, role) {
        var children = expr.childNodes;
        var i;
        for (i = 0; i < children.length; i++) {
            var domNode = children[i];
            if (domNode.nodeType == DU.ELEMENT_NODE && domNode.getAttribute("role") == role) {
                return domNode;
            }
        }
        return null;
    }
    
    function hasFlag(expr, flag) {
        return expr.hasAttribute("flags") && expr.getAttribute("flags").indexOf(flag) >= 0;
    }
    
    
    /**
     * Namespace resolver for QNames that need to be resolved against namespaces declared in the stylesheet.
     * For use in conjunction with Atomic.QName.fromString
     * @param element the element in the compiled stylesheet on which the lexical qname appears
     * @param useDefault true if no prefix means use the default namespace (otherwise, no prefix means no namespace)
     * @returns Function - a namespace resolver, which is a function from lexical QNames to namespace URIs.
     */
    
    function stylesheetResolver(element, useDefault) {
        var ns = DU.getInheritedAttribute(element, "ns");
        if (ns === null) {
            throw XError("Namespace context not available for " + element.tagName, "SXJS0004");
        }
        return function (prefix) {
            //print("Stylesheet resolve " + prefix);
            //print("ns=" + ns);
            if (prefix === "" && ! useDefault) {
                return "";
            }
            var decls = ns.split(" ");
            var i;
            for (i = 0; i < decls.length; i++) {
                var pair = decls[i].split("=");
                if (pair[0] == prefix) {
                    return pair[1];
                }
            }
            if (prefix === "") {
                return "";
            }
            throw XError("Undeclared prefix: " + prefix, "XTDE0290");
        };
    }
    
    function stylesheetQName(element, lexi, useDefault) {
        return Atomic.QName.fromString(lexi, stylesheetResolver(element, useDefault));
    }
    
    function getSourceLoc(src) {
        if (typeof src === 'undefined') {
            return undefined;
        }
        return getSourceProp(src, "module", 20) + "#" + getSourceProp(src, "line", 10);
    }

    function getSourceProp(src, name, tries) {
        if (src !== null && tries > 0) {
            var val = DU.getAttribute(src, name);
            if (val !== null && val !== "") {
                return val;
            } else {
                return getSourceProp(src.parentNode, name, tries - 1);
            }
        }
        return undefined;
    }
    
    function internalError(msg) {
        print("*** Internal error: " + msg);
        if (Error.dumpStack) {
            Error.dumpStack();
        }
        throw XError("Internal error: " + msg, "SXJS0004");
    }
    
    //var evaluate = evaluateWithTrace;
    var evaluate = evaluateWithoutTrace;
    
    var depth = 0;
    var spaces = "                       ";
    
    
    function evaluateWithTrace(expr, context) {
        if (! context) {
            internalError("No context supplied!");
        }
        depth++;
        if (spaces.length < depth) {
            spaces += spaces;
        }
        var nameAtt = expr.hasAttribute("name") ? (" name='" + expr.getAttribute("name") + "'"): "";
        print(spaces.substring(0, depth) + "<" + expr.tagName + " line='" + DU.getInheritedAttribute(expr, "line") + "'" + nameAtt +
        " focus='" + (context.focus ? showValue(context.focus.current): 'absent') + "'>");
        
        var result = evaluateWithoutTrace(expr, context);
        if (!(typeof result == "object" && "next" in result)) {
            internalError("Result of " + expr.tagName + " is not an iterator");
        }
        
        print(spaces.substring(0, depth) + "</" + expr.tagName + ">");
        depth--;
        return result;
    }
    
    function evaluateWithoutTrace(expr, context) {
        var fn = expression[expr.tagName];
        if (! fn) {
            internalError("Unknown expr: " + expr.tagName);
        }
        try {
            return fn(expr, context);
        }
        catch (e /* if e instanceof XError*/) {
            if (e instanceof XError) {
                context.currentError = e;
                if (e.compiledLineNr === null && e.xsltLineNr === null) {
                    e.setExpr(expr);
                    if (e.xsltLineNr !== null) {
                        //e.message += " at "+ e.xsltModule+"#"+e.xsltLineNr;
                    }
                }
                throw e;
            } else {
                //Error.dumpStack(e);
                throw e;
            }
        }
    }
    
    function evalFn(expr) {
        var fn = expression[expr.tagName];
        if (! fn) {
            internalError("Unknown expr: " + expr.tagName);
        }
        return function (context) {
            try {
                return fn(expr, context);
            }
            catch (e) {
                if (e instanceof XError) {
                    context.currentError = e;
                    if (e.compiledLineNr === null) {
                        e.setExpr(expr);
                    }
                }
                //console.log(e.stack); // Used for running in browser, but not with Nashorn
                throw e;
            }
        };
    }
    
    function arg2Fn(expr) {
        // Return a function to evaluate the second argument of the current expression
        return evalFn(DU.getChildElements(expr)[1]);
    }

    function evaluateIfPresent(expr, context) {
        return expr === null ? Iter.Empty: evaluate(expr, context);
    }
    
    function checkXmlChar(int) {
        if (int < 1 || (int > 0xD7FF && int < 0xE000) || (int > 0xFFFD && int < 0x10000) || int > 0x10FFFF) {
            throw XError("Invalid XML character 0x" + int.toString(16), "FOCH0001");
        }
    }
    
    /**
     * Check whether a string contains characters > 65535
     */
    
    function isAstral(str) {
        for (var i = 0; i < str.length; i++) {
            var c = str.charCodeAt(i);
            //print ("cp: " + c);
            if (c >= 55296 && c <= 56319) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Convert an array of codepoints to a string
     * @param codes an array of JS numbers representing Unicode codepoints. An astral character (>65535) is
     * represented as a single codepoint, not as a surrogate pair
     * @returns {string} the string represented by the sequence of codepoints
     */
    
    function codepointsToString(codes) {
        var str = "";
        codes.forEach(function (int) {
            checkXmlChar(int);
            return str += (int < 65536 ?
            String.fromCharCode(int):
            (String.fromCharCode(((int - 65536) >> 10) + 0xD800)) + String.fromCharCode(((int - 65536) & 0x3FF) + 0xDC00));
        });
        return str;
    }
    
    /**
     * Convert a string to a sequence of codepoints
     * @param str the input string. Any surrogates must be properly paired; if not, the consequences are unpredictable
     * @returns Array - an array of JS numbers representing Unicode codepoints. An astral character (>65535) is
     * represented as a single codepoint, not as a surrogate pair
     */
    
    function stringToCodepoints(str) {
        var result =[];
        for (var i = 0; i < str.length; i++) {
            var c = str.charCodeAt(i);
            result.push((c >= 55296 && c <= 56319) ? ((c - 55296) * 1024) + (str.charCodeAt(++ i) - 56320) + 65536: c);
        }
        //print("to-codepoints " + result.join());
        return result;
    }
    
    function promote(value, type) {
        function promotable(from, to) {
            if (Atomic.decimal.matches(from)) {
                return to == "decimal" || to == "float" || to == "double";
            } else if (Atomic. float.matches(from)) {
                return to == "float" || to == "double";
            } else {
                return false;
            }
        }
        //print("promote to " + type);
        if (Atomic[type].matches(value)) {
            return value;
        } else if (promotable(value, type)) {
            return Atomic[type].cast(value);
        } else {
            throw XError("Incompatible operands: " + value.type + " and " + type, "XPTY0004");
        }
    }
    
    /**
     * Construct simple content
     * @param sequence the input sequence, in the form of an iterator
     * @returns String - the constructed simple content, as a string
     */
    
    function makeSimpleContent(sequence) /*returns string*/ {
        var result = "";
        sequence.forEachItem(function (item) {
            if (result !== "") {
                result += " ";
            }
            result += item.toString();
        });
        return result;
    }
    
    /**
     * Construct complex content
     * @param parent the parent node being constructed; on entry this will be childless,
     * on return it is modified to contain the supplied content.
     * @param sequence the supplied content in the form of an iterator
     * @param context
     * @return void
     */
    function makeComplexContent(parent, sequence, context) {
        //print("--------makeComplexContent--------");
        if (!context) {
            internalError("No context in makeComplexContent for " + showValue(parent));
        }
        var foundNonAttribute = false;
        var prevAtomic = false;
        //print("MCC parent:"+DU.nameOfNode(parent)+ " context:"+context);
        function checkAttOrNs(child, found) {
            function describe(child) {
                return child instanceof NamespaceNode ? "a namespace": "an attribute";
            }
            
            if (found) {
                throw XError("Cannot create " + describe(child) +
                " node after creating children", "XTDE0410");
            }
            if (parent.nodeType == DU.DOCUMENT_FRAGMENT_NODE || parent.nodeType == DU.DOCUMENT_NODE) {
                throw XError("Cannot add " + describe(child) + " to a document node", "XTDE0410");
            }
        }
        
        function append(parent, child) {
            //print("---append---");
            var childIsAttachable = child._saxonIsLocal ? child._saxonIsLocal : false;
            if (isArray(child)) {
                // flatten the array
                //print("append array to node: " + showValue(child));
                child.value.forEach(function (mem) {
                    mem.forEach(function (item) {
                        append(parent, item);
                    });
                });
            } else if (isMap(child)) {
                throw XError("A map can't be a child of an XML node", "XPTY0004");
            } else {
                // Makes a copy of child before appending where appropriate, to ensure that HTMLElements are produced
                // in the right cases, and to prevent node destruction
                // i.e. if (childIsAttachable == false) or (inBrowser && (parent & child not both HTMLElements or both XML elements))
                // i.e. when child is a node in the HTML page, or source document (not one we have constructed in a temporary tree)
                // Should not always copy, else the recursive copying mechanism is badly inefficient.
                if (DU.isNode(child)) {
                    //print("MCC.append node parent:"+DU.nameOfNode(parent)+ " child:"+DU.nameOfNode(child)+ "(" +child.toString() + ")" +" context:"+context);
                    /*if (parent.nodeType == DU.DOCUMENT_NODE || parent.nodeType == DU.DOCUMENT_FRAGMENT_NODE) {
                        print("MCC.append node parent: document (fragment) node, child:"+DU.nameOfNode(child));
                    } else {
                        print("MCC.append node parent:"+DU.nameOfNode(parent)+ " child:"+DU.nameOfNode(child)+ "(" +showValue(child) + ")");
                    }*/
                    prevAtomic = false;
                } else {
                    //print("MCC.append text parent:"+DU.nameOfNode(parent)+ " child:"+child.toString()+ " context:"+context);
                    child = context.resultDocument.createTextNode((prevAtomic ? " ": "") + child.toString());
                    prevAtomic = true;
                }
                if (parent.nodeType == DU.ELEMENT_NODE || parent.nodeType == DU.DOCUMENT_FRAGMENT_NODE) {
                    if (DU.isNSNode(child)) {
                        if (SaxonJS.getPlatform().inBrowser && parent instanceof HTMLElement) {
                            // TODO possibly should do nothing
                            //print("appending NSNode to parent");
                            parent.appendChild(parent.ownerDocument.importNode(child, true));
                        } else {
                            checkAttOrNs(child, foundNonAttribute);
                            if (child.prefix == parent.prefix && child.uri != parent.namespaceURI) {
                                throw XError("Saxon-JS restriction: namespace nodes in content clash with the element prefix", "SXJS0002");
                                //parent.prefix = parent.prefix + "_1"; // OK 99.99% of the time...
                                // TODO: this doesn't work. See test namespace-2001. The prefix property is read-only,
                                // and there is no way to change the name of an existing node. We're going to have
                                // to restructure the code so the content nodes are examined before deciding the name
                                // of the parent element. It might be possible to attach the child nodes temporarily to
                                // a document fragment node and then transfer them using importNode.
                            }
                            //print("ns " + child.prefix + "=" + child.uri);
                            if (child.prefix === "") {
                                if (parent.namespaceURI === "") {
                                    throw XError("Cannot add a default namespace to a no-namespace element", "XTDE0440");
                                }
                                if (parent.hasAttributeNS("", "xmlns")) {
                                    if (parent.getAttributeNS("", "xmlns") != child.uri) {
                                        throw XError("Cannot have two different default namespaces", "XTDE0430");
                                    }
                                } else if (!(SaxonJS.getPlatform().inBrowser && parent instanceof HTMLElement)) {
                                    parent.setAttributeNS("", "xmlns", child.uri);
                                }
                            } else {
                                var NSNS = "http://www.w3.org/2000/xmlns/";
                                var NSName = "xmlns:" + child.prefix;
                                if (parent.hasAttributeNS(NSNS, child.prefix) && parent.getAttributeNS(NSNS, child.prefix) != child.uri) {
                                    throw XError("Cannot have two namespaces with the same prefix", "XTDE0430");
                                }
                                parent.setAttributeNS(NSNS, NSName, child.uri);
                            }
                        }
                    } else if (child.nodeType == DU.ATTRIBUTE_NODE) {
                        checkAttOrNs(child, foundNonAttribute);
                        //print("attribute name " + child.name);
                        if (child.namespaceURI !== "") {
                            //print("attribute namespace fixup");
                            var parts = child.name.split(":");
                            //print("fixup: ns for prefix " + parts[0] + " = " + parent.lookupNamespaceURI(parts[0]));
                            //print("child.namespaceURI = " + child.namespaceURI);
                            if (!(parts.length == 2 && parent.lookupNamespaceURI(parts[0]) == child.namespaceURI)) {
                                // fixup is needed
                                if (parts.length == 2 && parent.lookupNamespaceURI(parts[0]) === null) {
                                    // declare the namespace on the parent
                                    parent.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:" + parts[0], child.namespaceURI);
                                } else {
                                    // prefix already in use: find a new one
                                    var prefix = parts.length == 2 ? parts[0]: "ns";
                                    while (true) {
                                        if (parent.lookupNamespaceURI(prefix) === null) {
                                            parent.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:" + prefix, child.namespaceURI);
                                            child.name = (prefix + ":" + parts[parts.length - 1]);
                                            break;
                                        } else {
                                            prefix = prefix + "_1";
                                        }
                                    }
                                }
                            }
                        }
                        parent.setAttributeNS(child.namespaceURI, child.name, child.value);
                    } else if (child.nodeType == DU.DOCUMENT_NODE || child.nodeType == DU.DOCUMENT_FRAGMENT_NODE) {
                        Axis.child(child).forEachItem(function (item) {
                            //print("appending children of document (fragment) node type " + child.nodeType);
                            append(parent, item);
                        });
                    } else {
                        foundNonAttribute = true;
                        //print("appending child " + DU.nameOfNode(child) + " of type " + child.nodeType);
                        //print("childIsAttachable " + childIsAttachable);
                        // Ensure that a constructed tree is always homogeneous
                        // i.e. parent and child elements are both HTML, or both XML

                        if (!childIsAttachable || SaxonJS.getPlatform().inBrowser &&
                            parent instanceof HTMLElement != child instanceof HTMLElement) {
                            // DU.copyItem uses context.createElement which ensures the child will be an HTMLElement if
                            // context.resultDocument is window.document
                            //print("copy child before appending");
                            var newNode = DU.copyItem(child, context, "c");
                            parent.appendChild(newNode);
                            newNode._saxonIsLocal = false;
                            // When newNode has been attached to a parent, it is not attachable
                        } else {
                            //print("append child directly");
                            parent.appendChild(child);
                            child._saxonIsLocal = false;
                            // When child has been attached to a parent, it is not attachable
                        }

                        if (!SaxonJS.getPlatform().inBrowser || context.resultDocument != window.document) {
                            //TODO what are the right conditions for this ?
                            // not inBrowser
                            //parent.appendChild(parent.ownerDocument.importNode(child, true)); // importNode makes a copy
                            //parent.appendChild(child);
                            var chPrefix = child.prefix || "",
                                chUri = child.namespaceURI || "";
                            if (parent.nodeType == DU.ELEMENT_NODE && child.nodeType == DU.ELEMENT_NODE &&
                                !(SaxonJS.getPlatform().inBrowser && child instanceof HTMLElement) &&
                                child.lookupNamespaceURI(chPrefix !== chUri)) {
                                DU.declareNS(child, chPrefix, chUri);
                            }
                        }

                    }
                } else if (parent.nodeType == DU.DOCUMENT_NODE) {
                    if (child !== null) {
                        parent.documentElement = child;
                    }
                } else {
                    throw XError("Unknown parent node type " + parent.nodeType, "SXJS0003");
                }
            }

        }
        
        sequence.forEachItem(function (item) {
            append(parent, item);
        });
    }

    
    
    /**
     * Create an XDM Array (XPath 3.1).
     * @param value the content of the array. This must be supplied as an array of arrays: the outer
     * array represents the XDM array itself, and the inner arrays represent the values that are the
     * members of the XDM array, each one being a sequence (sequences are represented as Javascript arrays).
     * @constructor
     */
    
    function XdmArray(value) {
        this.value = value;
    }
    
    XdmArray.prototype = {
        value:[],
        get: function (n) {
            if (typeof n != "number") {
                throw XError("Array subscript is not numeric", "XPTY0004");
            }
            if (n < 1 || n >= this.value.length) {
                throw XError("Array index (" + n + ") out of bounds (1 to " + this.value.length + ")", "FOAY0001");
            }
            return this.value[n -1];
        }
    };

    function isArray(item) {
        return item instanceof XdmArray;
    }

    function isMap(item) {
        return item instanceof HashTrie || item instanceof JSValue;
    }

    
    // Conversion used for stylesheet parameters
    
    function convertParamFromJS(value, cardinalityChecker, acceptor, name) {
        //print("convertParamFromJS " + showValue(value));
        //print("acceptor " + acceptor);

        /* When the type is declared as xs:untypedAtomic, xs:string, xs:boolean or xs:double,
        conversion to XDM type has been done by the acceptor.
         Nodes do not get converted. */
        function checkAtomicTypes(value) {
            return DU.isNode(value) || Atomic.untypedAtomic.matches(value) || Atomic.string.matches(value) ||
                Atomic.boolean.matches(value) || Atomic.double.matches(value);
        }

        /* When the conversion has not already been done by the acceptor (in particular, when the declared type is item()
           or not given; or map(*) or array(*)), then do the conversion (to the 'assumed' type) now. */
        function convert(value, insideArr) {
            if (value !== null && !checkAtomicTypes(value)) {
                return convertFromJS(value, insideArr);
            }
            return value;
        }

        if (acceptor === undefined) {
            return value;
        }
        if (Array.isArray(value)) {
            if (!cardinalityChecker(value.length)) {
                throw XError("Supplied value for parameter " + name + " has wrong cardinality", "XTTE0590");
            }
            return value.map(function (item) {
                // Use insideArr parameter to ensure that nested JS arrays get converted to XDM arrays
                return convert(acceptor(item), true);
            });
        }
        return convert(acceptor(value));
    }
    
    /**
     * Wrapper for a JavaScript value/object. A JSValue behaves like a map.
     * @param value the JS value to be wrapped.
     * @constructor
     */
    
    function JSValue(value) {
        this.value = value;
    }
    
    JSValue.prototype = {
        value: null,

        /**
         * Ask whether the wrapped object contains an entry for a given key
         * @param key the supplied key
         * @returns boolean true if the key is present in the wrapped object, otherwise false
         */
        containsKey: function (key) {
            return this.value[key] !== null;
        },

        /**
         * Get the value associated with a given key in the wrapped object
         * @param key the supplied key
         * @returns object the result of doing JS-to-XDM conversion on the associated value if present; otherwise null.
         * Note that null may mean that the key is absent, or that the key is present and associated with the value null.
         */

        get: function (key) {
            var val = convertFromJS(this.value[key]);
            return Array.isArray(val) ? val : [val];
        },

        /**
         * Add or replace an entry for a given key, modifying the map in situ.
         * Not allowed for JSValue, so always throws an error.
         * @param key the new key
         * @param value the new value
         */

        inSituPut: function (key, value) {
            throw XError("inSituPut() not allowed for JSValue", "SXJS0005");
        },

        /**
         * Add or replace an entry for a given key, returning a copy of the map. The original map
         * is not changed.
         * Not allowed for JSValue, so always throws an error.
         * @param key the new key
         * @param value the new value
         * @returns object new map
         */

        put: function (key, value) {
            throw XError("put() not allowed for JSValue", "SXJS0005");
        },

        /**
         * Remove an entry for a given key, returning a copy of the map. The original map
         * is not changed.
         * Not allowed for JSValue, so always throws an error.
         * @param key the new key
         * @returns object new map
         */

        remove: function (key) {
            throw XError("remove() not allowed for JSValue", "SXJS0005");
        },

        /**
         * Return all the keys present in the wrapped object, as an array of XDM Strings, in undefined order
         * @returns Array containing all the keys
         */

        keys: function () {
            var result = [];
            for (var i in this.value) {
                if (this.value.hasOwnProperty(i)){
                    result.push(Atomic.string.fromString(i));
                }
            }
            return result;
        },

        /**
         * Iterate over the entries in the wrapped object. The supplied function is called for each entry in turn,
         * in undefined order; the function is called with a single parameter which is an object of the
         * form {k:key, v:value}
         * @param f the function to be called for each key-value pair.
         */

        forAllPairs: function (f) {
            var map = this;
            map.keys().forEach(function (key) {
                f({k:key, v:map.get(key)});
            });
        },

        /**
         * Test conformance to a type
         * @param keyTest a function which must return true for every key value
         * @param valueTest a function which must return true for every item in every value
         * @param valueCountTest a function which must return true for the cardinality of every value
         * @returns boolean
         */
        conforms: function (keyTest, valueTest, valueCountTest) {
            var map = this;
            //print("map.conforms " + showValue(map.keys()));
            return Iter.ForArray(map.keys()).every(function (k) {
                //print("map.conforms " + showValue(k) + " : " + showValue(map.get(k)));
                var v = map.get(k);
                return keyTest(k) && valueCountTest(v.length) && Iter.ForArray(v).every(valueTest);
            });
        }
    };
    
    function convertFromJS (item, insideArr) {
        //print("convertFromJS item: " + item);
        //print("typeof item " + (typeof item));
        switch (typeof item) {
            case "undefined":
                return []; // previously return Atomic.untypedAtomic.fromString("");
            case "string":
            return Atomic.string.fromString(item);
            case "number":
            return Atomic. double.fromNumber(item);
            case "boolean":
            return Atomic. boolean.fromBoolean(item);
            case "function":
                // JSValue containing the function
            return new JSValue(item);
            case "object":
            if (DomUtils.isNode(item)) {
                return item;
            } else if (item instanceof Date) {
                return Atomic.dateTime.fromString(item.toISOString());
            } else if (Array.isArray(item)) {
                // JS array -> XDM sequence, but any nested arrays become XDM arrays
                var convertedArr =[];
                if (insideArr) {
                    //print("---inside array");
                    item.forEach(function (x) {
                        var convX = convertFromJS(x, true);
                        var y = Array.isArray(convX) ? convX : [convX];
                        convertedArr.push(y);
                    });
                    //print("convertedArr " + showValue(convertedArr));
                    return new Expr.XdmArray(convertedArr);
                } else {
                    //print("---inside sequence");
                    item.forEach(function (x) {
                        convertedArr.push(convertFromJS(x, true));
                    });
                    //print("converted sequence " + showValue(convertedArr));
                    return convertedArr;
                }
            } else if (item === null) {
                // null -> empty sequence
                return [];
            } else {
                // JSValue containing the object (includes Window, Location, Attr objects)
                return new JSValue(item);
            }
                break;
            default:
                return item;
        }
    }
    
    function convertToJS (item) {
        //print("convertToJS item: " + showValue(item));
        if (Atomic.string.matches(item) || Atomic.anyURI.matches(item) || Atomic.duration.matches(item) ||
        Atomic.hexBinary.matches(item) || Atomic.base64Binary.matches(item) || Atomic.untypedAtomic.matches(item)) {
            return item.toString();
        } else if (Atomic.numeric.matches(item)) {
            return item.toNumber();
        } else if (Atomic. boolean.matches(item)) {
            return item.toBoolean();
        } else if (Atomic.dateTime.matches(item) || Atomic.date.matches(item) || Atomic.dateTimeStamp.matches(item)) {
            return item.toString();
            // TODO or convert to Date object?
            //return new Date(item.toString());
        } else if ( Atomic.time.matches(item) || Atomic.gYearMonth.matches(item) || Atomic.gYear.matches(item) || 
            Atomic.gMonthDay.matches(item) || Atomic.gMonth.matches(item) || Atomic.gDay.matches(item)) {
            return item.toString();
        } else if (Atomic.QName.matches(item)) {
            return item.toEQName();
        }
        // node => JS node
        // AttributeNode => pass the Saxon object unconverted
        // NamespaceNode => pass the Saxon object unconverted
        var array;
        if (DU.isNode(item)) {
            return item;
        }
        // array => JS array
        else if (item instanceof Expr.XdmArray) {
            //print("item instanceof Expr.XdmArray: " + showValue(item));
            array =[];
            if (item.value.length === 0) {
                // empty array => JS empty array
            } else {
                item.value.forEach(function (x) {
                    array.push(convertToJS(x));
                });
            }
            return array;
        }
        // sequence with length > 1 => JS array
        // sequence of length 1 => single item
        // empty sequence => JS null
        else if (Array.isArray(item)) {
            // represents a sequence
            //print("item is a sequence: " + showValue(item));
            array =[];
            if (item.length === 0) {
                // empty sequence => JS null
                return null;
            } else if (item.length == 1) {
                // sequence of length 1 => single item
                return convertToJS(item[0]);
            } else {
                item.forEach(function (x) {
                    //print("sequence entry: " + showValue(x));
                    array.push(convertToJS(x));
                });
            }
            return array;
        }
        // map => JS object, with all the keys converted to strings
        else if (item instanceof HashTrie) {
            //print("item instanceof HashTrie " + showValue(item));
            var object = {
            };
            item.forAllPairs(function (x) {
                object[x.k.toString()] = convertToJS(x.v);
            });
            return object;
        }
        // JSValue(x) -> x
        else if (item instanceof JSValue) {
            //print("item instanceof JSValue " + showValue(item));
            return item.value;
        } else {
            throw XError("convertToJS() not implemented for " + showValue(item) + ", " + (typeof item) + ", " + (item.constructor.name),
            "SXJS0004");
        }
    }
    
    function flatten(iter) {
        return iter.mapOneToMany(function (item) {
            //print("flatten " + showValue(item));
            if (isArray(item)) {
                return Iter.Join(item.value.map(function (mem) {
                    return flatten(Iter.ForArray(mem));
                }));
            } else {
                return Iter.Singleton(item);
            }
        });
    }
    
    function serialize(seq, params) {
        // A simple and non-conformant serializer
        //var indent = params == undefined ? "": "none";
        function serItem(item) {
            if (isArray(item)) {
                var aRes = "[";
                item.value.forEach(function (mem) {
                    if (aRes != "[") {
                        aRes += ",";
                    }
                    aRes += serSequence(mem);
                });
                return aRes + "]";
            } else if (isMap(item)) {
                var mRes = "{";
                item.forAllPairs(function (pair) {
                    if (mRes != "{") {
                        mRes += ",";
                    }
                    mRes += '"' + pair.k + '":';
                    mRes += serSequence(pair.v);
                });
                return mRes + "}";
            } else if (DU.isNode(item)) {
                return DU.xmlToString(item, params);
                //return item.toString();
            } else if (Atomic.string.matches(item) || Atomic.untypedAtomic.matches(item)) {
                return '"' + item.toString().replace(/&ZZZamp;/g,"&").replace(/""/g,'"').replace(/''/g,"'")+ '"';
                //return '"' + item.toString().replace(/&amp;/g,"&").replace(/&gt;/g,">").replace(/&lt;/g,"<") + '"';
            } else if (Atomic.integer.matches(item) || Atomic.numeric.matches(item) || Atomic. boolean.matches(item)) {
                return item.toString();
            } else if (item instanceof Iter.Singleton) {
                return serItem(item.next());
            } else {
                return showValue(item);
            }
        }
        
        function serSequence(seq) {
            if (seq === undefined) {
                return "(undefined)";
            }
            if (seq.length == 1) {
                return serItem(seq[0]);
            } else {
                var sRes = "(";
                seq.forEach(function (item) {
                    if (sRes != "(") {
                        sRes += ",";
                    }
                    sRes += serItem(item);
                });
                return sRes + ")";
            }
        }

        /*if (isMap(params) && convertToJS(params)["method"] == "json") {
            throw XError("fn:serialize() with method json not supported", "SXJS0002");
        }*/
        return serSequence(seq.expand());
    }
    
    
    return {
        analyze: analyze,
        argRole: argRole,
        atomize: atomize,
        codepointsToString: codepointsToString,
        convertFromJS: convertFromJS,
        convertToJS: convertToJS,
        ebv: ebv,
        evalChild1: evalChild1,
        evalChild2: evalChild2,
        evaluate: evaluate,
        evaluateIfPresent: evaluateIfPresent,
        flatten: flatten,
        getSourceLoc: getSourceLoc,
        hasFlag: hasFlag,
        internalError: internalError,
        isArray: isArray,
        isAstral: isAstral,
        isMap: isMap,
        JSValue: JSValue,
        makeComplexContent: makeComplexContent,
        markLocal: markLocal,
        notImplemented: notImplemented,
        promote: promote,
        roleDiagnostic: roleDiagnostic,
        serialize: serialize,
        staticBaseUri: staticBaseUri,
        stringToCodepoints: stringToCodepoints,
        stylesheetResolver: stylesheetResolver,
        untypedToDouble: untypedToDouble,
        wsCollapse: wsCollapse,
        XdmArray: XdmArray
    };
}
();
var Mode = function () {

    "use strict";

    /**
     * Compare the relative ranking of two template rules, taking into account first
     * their import precedence, then their priority, then their relative position in document order
     * @param r1 the first rule
     * @param r2 the second rule
     * @returns negative number if the first rule is lower ranking, 0 if it ranks equal, positive number if it ranks higher
     */

    function compareRank(r1, r2) {
        if (r1.prec == r2.prec) {
            if (r1.prio == r2.prio) {
                return r1.seq - r2.seq;
            } else {
                return r1.prio - r2.prio;
            }
        } else {
            return r1.prec - r2.prec;
        }
    }

    var builtInTemplateRules = {
        TC: function (item, mode, context) {
            // text-only-copy
            //print("built-in TC: " + Atomic.showValue(item));
            if (DomUtils.isNode(item)) {
                switch (item.nodeType) {
                    case DomUtils.DOCUMENT_NODE:
                    case DomUtils.DOCUMENT_FRAGMENT_NODE:
                    case DomUtils.ELEMENT_NODE:
                        var c2 = context.newContext(false);
                        c2.focus = Iter.Tracker(Axis.child(item));
                        return mode.applyTemplates(c2);
                    case DomUtils.TEXT_NODE:
                    case DomUtils.CDATA_SECTION:
                        return Iter.Singleton(DomUtils.copyItem(item, context));
                    case DomUtils.ATTRIBUTE_NODE:
                        return Iter.Singleton(context.resultDocument.createTextNode(item.value));
                    default:
                        return Iter.Empty;
                }
            } else {
                return Iter.Singleton(item);
            }
        },
        SC: function (item, mode, context) {
            // shallow-copy
            //print("built-in SC: " + showValue(item));
            // don't need to switch according to type to reduce costs - DomUtils.shallowCopy() does that
            function action (c1) {
                var c2 = c1.newContext(false);
                var iterators = [];
                iterators[0] = Iter.Tracker(Axis.attribute(item));
                iterators[1] = Iter.Tracker(Axis.child(item));
                c2.focus = Iter.Join(iterators);
                return mode.applyTemplates(c2);
            }
            return DomUtils.shallowCopy(item, context, "c", action);
        },
        DC: function (item, mode, context) {
            // deep-copy
            //print("built-in DC: " + showValue(item));
            return Iter.Singleton(DomUtils.copyItem(item, context, "c"));
        },
        DS: function (item, mode, context) {
            // deep-skip
            return Iter.Empty;
        },
        SS: function (item, mode, context) {
            // shallow-skip
            //print("built-in SS: " + Atomic.showValue(item));
            if (DomUtils.isNode(item)) {
                 switch (item.nodeType) {
                    case DomUtils.DOCUMENT_NODE:
                    case DomUtils.DOCUMENT_FRAGMENT_NODE:
                    case DomUtils.ELEMENT_NODE:
                        var c2 = context.newContext(false);
                        var iterators = [];
                        iterators[0] = Iter.Tracker(Axis.attribute(item));
                        iterators[1] = Iter.Tracker(Axis.child(item));
                        c2.focus = Iter.Join(iterators);
                        return mode.applyTemplates(c2);
                    default:
                        return Iter.Empty;
                 }
            } else {
                 return Iter.Singleton(item);
            }
        },
        bubble: function (item, mode, context) {
            // bubble for ixsl
            //print("built-in bubble: " + Atomic.showValue(item));
            if (DomUtils.isNode(item)) {
                switch (item.nodeType) {
                    case DomUtils.ELEMENT_NODE:
                        var c2 = context.newContext(false);
                        c2.focus = Iter.Tracker(Axis.parent(item));
                        return mode.applyTemplates(c2);
                    default:
                        return Iter.Empty;
                }
            } else {
                return Iter.Singleton(item);
            }
        }
    };

    function showRule(rule) {
        return JSON.stringify({prec: rule.prec, prio: rule.prio, seq: rule.seq, line: rule.line, match:rule.pattern});
    }

    function makePatternForRule(templateRule) {
        return makePattern(Expr.argRole(templateRule, "match"));
    }

    function makeTracingPatternForRule(templateRule) {
        var matcher = makePatternForRule(templateRule);
        return function(item, context) {
            print("Testing pattern on line " + templateRule.lineNumber + " against " + showValue(item));
            var matched = matcher(item, context);
            print(matched ? "Match." : "No match.");
            return matched;
        };
    }

    function Mode(expr) {
        this._expr = expr;
        this.onNoMatch = expr.getAttribute("onNo");
        this._rules = DomUtils.getChildElements(expr).map(function(templateRule) {
            return {
                rule: templateRule,
                prec: parseInt(templateRule.getAttribute("prec"), 10),
                prio: parseFloat(templateRule.getAttribute("prio")),
                seq: parseInt(templateRule.getAttribute("seq"), 10),
                minImp: parseInt(templateRule.getAttribute("minImp"), 10),
                //pattern: makeTracingPatternForRule(templateRule),
                pattern: makePatternForRule(templateRule),
                action: Expr.argRole(templateRule, "action")
            };
        }).sort(compareRank).reverse();
    }

    Mode.prototype = {
        _expr: null,
        _rules: null,
        onNoMatch: "TC",
        applyTemplates: function (context) {
            var mode = this;
            return context.focus.mapOneToMany(function (item) {
                //print("mode applyTemplates: item " + showValue(item));
                return mode._processItem(item, context);
            });
        },
        applyImports: function (context) {
            var currentRule = context.currentTemplate;
            if (!currentRule) {
                throw XError("No current template rule", "XTDE0560");
            }
            return this._processItem(context.focus.current, context, function (rule) {
                return rule.prec >= currentRule.minImp && rule.prec < currentRule.prec;
            });
        },
        nextMatch: function (context) {
            var currentRule = context.currentTemplate;
            if (!currentRule) {
                throw XError("No current template rule", "XTDE0560");
            }
            //print("nextMatch: currentRule:" + currentRule.prec + " " + showRule(currentRule));
            return this._processItem(context.focus.current, context, function (rule) {
                //print("comparing with " + showRule(rule));
                return compareRank(rule, currentRule) < 0;
            });
        },
        findBestRule: function (item, context, ruleFilter) {
            var rules = this._rules;
            var bestRule = null;
            rules.forEach(function (rule) {
                //print("processItem consider " + showRule(rule) + " for " + showValue(item));
                //print("- ruleFilter ok? " + (!ruleFilter || ruleFilter(rule)));
                //print("- rank ok? " + (!bestRule || compareRank(rule, bestRule) > 0));
                //print("- matches? " + rule.pattern(item, context));

                if ((!ruleFilter || ruleFilter(rule)) &&
                    (!bestRule || compareRank(rule, bestRule) > 0) &&
                    rule.pattern(item, context)) {
                    bestRule = rule;
                }
            });
            return bestRule;
        },
        isNonDOMmode: function (context) {
            return this.findBestRule(Expr.JSValue(window), context) !== null;
        },
        _processItem: function (item, context, ruleFilter) {
            //print("Matching " + showValue(item));
            var bestRule = this.findBestRule(item, context, ruleFilter);
            
            if (bestRule !== null) {
                //print("Found matching rule");
                context.currentTemplate = bestRule;
                context.currentMode = this;
                return Expr.evaluate(bestRule.action, context);
            }
            //alert("Found no matching rule");
            var tr;
            var mName = DomUtils.getAttribute(this._expr, "name");
            //print("mode name: " + mName);
            if (mName !== null && mName.split("}")[0] == "Q{http://saxonica.com/ns/interactiveXSLT") {
                tr = "bubble";
            } else {
                tr = this.onNoMatch.split('+')[0];
            }
            var fallback = builtInTemplateRules[tr];
            if (fallback) {
                //print("Use built-in rule");
                return fallback(item, this, context);
            } else {
                throw XError("No matching template rule for " + showValue(item) + " onNoMatch = " + this.onNoMatch, "XTDE0555");
            }
        },
        printRules: function() {
            var rules = this._rules;
            var result = "";
            rules.forEach(function(rule) {
                result += showRule(rule);
            });
            return result;
        }

    };

    return Mode;

}();
var Iter = function () {

    "use strict";
    
    /**
     * This module contains a number of general-purpose iterator implementations.
     * An "iterator" is anything with a next() method. The next() method returns the
     * next item in a sequence, or null when the sequence is exhausted. Some iterators
     * also expose additional methods: expand() for the array of items being iterated
     * over (if available), peek() for the next item to be returned without advancing
     * the iterator, etc.
     */
    
    function AbstractIterator() {
    }
    
    AbstractIterator.prototype = {
        filter: function (f) {
            return Filter(this, f);
        },
        mapOneToOne: function (f) {
            return OneToOne(this, f);
        },
        mapOneToMany: function (f) {
            return new OneToMany(this, f);
        },
        forEachItem: function (action) {
            var item;
            while ((item = this.next()) !== null) {
                action(item);
            }
        },
        some: function (condition) {
            var item;
            while ((item = this.next()) !== null) {
                if (condition(item)) {
                    return true;
                }
            }
            return false;
        },
        every: function (condition) {
            var item;
            while ((item = this.next()) !== null) {
                if (! condition(item)) {
                    return false;
                }
            }
            return true;
        },
        count: function () {
            var result = 0;
            this.forEachItem(function () {
                result++;
            });
            return result;
        },
        expand: function () {
            var result =[];
            this.forEachItem(function (item) {
                result.push(item);
            });
            return result;
        }
    };
    
    /**
     * SingletonIterator is an iterator over a sequence of length 1. It can also be used as an empty iterator by supplying
     * null as the item value
     * @param item the single item to be returned by the iterator, or null if no items are to be returned.
     */
    
    function Singleton(item) {
        if (!(this instanceof Singleton)) {
            return new Singleton(item);
        }
        AbstractIterator.call(this);
        this._item = item;
    }
    
    Singleton.prototype = Object.create(AbstractIterator.prototype);
    Singleton.prototype.constructor = Singleton;
    Singleton.prototype._item = null;
    Singleton.prototype.next = function () {
        var result = this._item;
        this._item = null;
        return result;
    };
    Singleton.prototype.peek = function () {
        return this._item;
    };
    Singleton.prototype.expand = function () {
        return this._item === null ?[]:[ this._item];
    };
    
    
    /**
     * Iter.Empty is a simple stateless object with a next() method that always returns null
     */
    
    var Empty = {
        next: function () {
            return null;
        },
        peek: function () {
            return null;
        },
        expand: function () {
            return[];
        },
        count: function () {
            return 0;
        },
        filter: function () {
            return Empty;
        },
        mapOneToOne: function () {
            return Empty;
        },
        mapOneToMany: function () {
            return Empty;
        },
        forEachItem: function () {
        },
        some: function () {
            return false;
        }
    };
    
    /**
     * ForArray Iter is an iterator over a sequence of items supplied in the form of a Javascript array
     * @param array the array of items
     */
    
    function ForArray(array) {
        if (!(this instanceof ForArray)) {
            return new ForArray(array);
        }
        AbstractIterator.call(this);
        if (! Array.isArray(array)) {
            Expr.internalError("ForArray expects array");
        }
        this._array = array;
    }
    
    ForArray.prototype = Object.create(AbstractIterator.prototype);
    ForArray.prototype.constructor = ForArray;
    
    ForArray.prototype._array = null;
    ForArray.prototype._index = 0;
    ForArray.prototype.next = function () {
        return (this._index < this._array.length) ? this._array[ this._index++]: null;
    };
    ForArray.prototype.peek = function () {
        return (this._index < this._array.length) ? this._array[ this._index]: null;
    };
    ForArray.prototype.expand = function () {
        return this._array;
    };
    ForArray.prototype.count = function () {
        return this._array.length;
    };
    
    /**
     * Iter.Filter is an iterator over items that selects a subset of the items returned
     * by a base iterator
     * @param base the base iterator (must have a next() method which returns items)
     * @param predicate a function to decide whether to include a base item in the result.
     * The function takes a single argument (an item), and returns true if the item is to be
     * retained, false if it is to be dropped.
     */
    
    function Filter(base, predicate) {
        if (!(this instanceof Filter)) {
            return new Filter(base, predicate);
        }
        AbstractIterator.call(this);
        this._base = base;
        this._predicate = predicate;
        if (! predicate) {
            Expr.internalError("Filter iterator undefined predicate");
        }
    }
    
    Filter.prototype = Object.create(AbstractIterator.prototype);
    Filter.prototype.constructor = Filter;
    
    Filter.prototype._base = null;
    Filter.prototype._predicate = null;
    Filter.prototype.next = function () {
        //print("Filter.next()");
        while (true) {
            var nextItem = this._base.next();
            if (! nextItem) {
                return null;
            }
            //print("filter " + showValue(nextItem) + ", " + this._predicate(nextItem));
            if (this._predicate(nextItem)) {
                return nextItem;
            }
        }
    };
    
    
    /**
     * OneToMany iterator: for each item returned by a base iterator, invokes
     * a mapping function which returns a sequence of items in the form of an inner
     * iterator; the result of the mapping iterator is the concatenation of the
     * results of the inner iterators.
     * @param base the base iterator
     * @param mapper the mapping function: a function which takes a single item
     * as its argument, and returns an iterator over a sequence of items
     */
    
    function OneToMany(base, mapper) {
        if (!(this instanceof OneToMany)) {
            return new OneToMany(base, mapper);
        }
        AbstractIterator.call(this);
        this._base = base;
        this._mapper = mapper;
    }
    
    OneToMany.prototype = Object.create(AbstractIterator.prototype);
    OneToMany.prototype.constructor = OneToMany;
    
    OneToMany.prototype._base = null;
    OneToMany.prototype._mapper = null;
    OneToMany.prototype._currentIter = null;
    OneToMany.prototype.next = function () {
        while (true) {
            if (this._currentIter !== null) {
                var n = this._currentIter.next();
                if (n) {
                    //print("innerItem " + showValue(n));
                    return n;
                }
            }
            var outerItem = this._base.next();
            //print("outerItem " + showValue(outerItem));
            if (outerItem === null) {
                return null;
            }
            this._currentIter = this._mapper(outerItem);
            if (this._currentIter && ! this._currentIter.next) {
                Expr.internalError("Result of mapper is not an iterator, mapper = " + this._mapper);
            }
        }
    };
    
    
    /**
     * OneToOne Item Mapping iterator: for each item returned by a base iterator, invokes
     * a mapping function which returns either a single item or null;
     * the result of the mapping iterator is the concatenation of the
     * results of these function calls, ignoring any nulls.
     * @param base the base iterator
     * @param mapper the mapping function: a function which takes a single item
     * as its argument, and returns either a single item or null. A second argument
     * is also supplied to the mapper function: namely the position of the item
     * in the sequence, zero-based.
     */
    
    function OneToOne(base, mapper) {
        if (!(this instanceof OneToOne)) {
            return new OneToOne(base, mapper);
        }
        AbstractIterator.call(this);
        this._base = base;
        if (!(typeof base == "object" && "next" in base)) {
            Expr.internalError("Base not an iterator");
        }
        this._mapper = mapper;
    }
    
    OneToOne.prototype = Object.create(AbstractIterator.prototype);
    OneToOne.prototype.constructor = OneToOne;
    
    OneToOne.prototype._base = null;
    OneToOne.prototype._mapper = null;
    OneToOne.prototype._position = 0;
    OneToOne.prototype.next = function () {
        while (true) {
            var item = this._base.next();
            if (! item) {
                return null;
            }
            var mapped = this._mapper(item, this._position++);
            if (mapped) {
                return mapped;
            }
        }
    };
    
    
    /**
     * A Stepping Iter delivers a sequence of items in which each item is computed as a function of the previous item.
     * @param start the first item to be returned
     * @param step a function which given an item, computes the next item to be returned, or returns null to signal the end
     * of the sequence
     */
    
    function Stepping(start, step) {
        if (!(this instanceof Stepping)) {
            return new Stepping(start, step);
        }
        AbstractIterator.call(this);
        this._next = start;
        this._step = step;
    }
    
    Stepping.prototype = Object.create(AbstractIterator.prototype);
    Stepping.prototype.constructor = Stepping;
    
    Stepping.prototype._step = null;
    Stepping.prototype._next = null;
    Stepping.prototype.next = function () {
        var n = this._next;
        if (! n) {
            return null;
        } else {
            this._next = this._step(n);
            return n;
        }
    };
    Stepping.prototype.peek = function () {
        return this._next;
    };
    
    
    /**
     * A JoinIterator takes an array of iterators as input and returns the result of
     * consuming each of the iterators in turn
     * It provides both a next() and current() item
     * @param iterators the array of iterators whose delivered items are to be concatenated
     * into a single sequence
     */
    
    function Join(iterators) {
        if (!(this instanceof Join)) {
            return new Join(iterators);
        }
        AbstractIterator.call(this);
        if (! Array.isArray(iterators)) {
            Expr.internalError("JoinIterator expects array");
        }
        this._iterators = iterators;
    }
    
    Join.prototype = Object.create(AbstractIterator.prototype);
    Join.prototype.constructor = Join;
    
    Join.prototype._iterators =[];
    Join.prototype.current = null;
    Join.prototype.next = function () {
        while (true) {
            if (this._iterators.length === 0) {
                this.current = null;
                return null;
            }
            var item = this._iterators[0].next();
            if (item === null) {
                this._iterators.shift();
            } else {
                this.current = item;
                return item;
            }
        }
    };
    
    /**
     * A Union Iter takes two sequences of nodes, both properly ordered, and returns the union
     * of the two sequences, also properly ordered, with duplicates eliminated. The input sequences are
     * normally in document order, but they can also be in reverse document order, or any other order,
     * provided the ordering is consistent with the supplied compare() function.
     * @param iter1 first operand sequence, as an iterator, ordered according to the compare() function
     * @param iter2 second operand sequence, as an iterator, ordered according to the compare() function
     * @param compare function to compare two nodes (typically to determine their relative position in document order)
     */
    function Union(iter1, iter2, compare) {
        if (!(this instanceof Union)) {
            return new Union(iter1, iter2, compare);
        }
        AbstractIterator.call(this);
        this._iter1 = Iter.LookAhead(iter1);
        this._iter2 = Iter.LookAhead(iter2);
        this._compare = compare;
    }
    
    Union.prototype = Object.create(AbstractIterator.prototype);
    Union.prototype.constructor = Union;
    
    
    Union.prototype._iter1 = null;
    Union.prototype._iter2 = null;
    Union.prototype._compare = null;
    Union.prototype.current = null;
    Union.prototype.next = function () {
        var n1 = this._iter1.peek();
        var n2 = this._iter2.peek();
        if (n1 && n2) {
            //print("union.next n1&n2 " + showValue(n1) + " : " + showValue(n2));
            var c = this._compare(n1, n2);
            //print("union comparison " + c);
            if (c < 0) {
                this.current = this._iter1.next();
                return this.current;
            } else if (c > 0) {
                this.current = this._iter2.next();
                return this.current;
            } else {
                this.current = this._iter1.next();
                this._iter2.next();
                return this.current;
            }
        } else if (n1) {
            //print("union.next n1 " + showValue(n1));
            this.current = this._iter1.next();
            return this.current;
        } else if (n2) {
            //print("union.next n2 " + showValue(n2));
            this.current = this._iter2.next();
            return this.current;
        } else {
            this.current = null;
            return null;
        }
    };
    
    
    /**
     * An IntersectIterator takes two sequences of nodes, both properly ordered, and returns the nodes that are present
     * in both sequences, also properly ordered, with duplicates eliminated. The input sequences are
     * normally in document order, but they can also be in reverse document order, or any other order,
     * provided the ordering is consistent with the supplied compare() function.
     * @param iter1 first operand sequence, as an iterator, ordered according to the compare() function
     * @param iter2 second operand sequence, as an iterator, ordered according to the compare() function
     * @param compare function to compare two nodes (typically to determine their relative position in document order)
     */
    
    function Intersect(iter1, iter2, compare) {
        if (!(this instanceof Intersect)) {
            return new Intersect(iter1, iter2, compare);
        }
        AbstractIterator.call(this);
        this._iter1 = Iter.LookAhead(iter1);
        this._iter2 = Iter.LookAhead(iter2);
        this._compare = compare;
    }
    
    Intersect.prototype = Object.create(AbstractIterator.prototype);
    Intersect.prototype.constructor = Intersect;
    
    Intersect.prototype._iter1 = null;
    Intersect.prototype._iter2 = null;
    Intersect.prototype._compare = null;
    Intersect.prototype.current = null;
    Intersect.prototype.next = function () {
        var n1 = this._iter1.peek();
        var n2 = this._iter2.peek();
        while (n1 && n2) {
            var c = this._compare(n1, n2);
            if (c < 0) {
                this._iter1.next();
                n1 = this._iter1.peek();
            } else if (c > 0) {
                this._iter2.next();
                n2 = this._iter2.peek();
            } else {
                this.current = this._iter1.next();
                this._iter2.next();
                return this.current;
            }
        }
        this.current = null;
        return null;
    };
    
    /**
     * A DifferenceIterator takes two sequences of nodes, both properly ordered, and returns nodes that are in the first
     * sequence but not the second, also properly ordered, with duplicates eliminated. The input sequences are
     * normally in document order, but they can also be in reverse document order, or any other order,
     * provided the ordering is consistent with the supplied compare() function.
     * @param iter1 first operand sequence, as an iterator, ordered according to the compare() function
     * @param iter2 second operand sequence, as an iterator, ordered according to the compare() function
     * @param compare function to compare two nodes (typically to determine their relative position in document order)
     */
    
    function Difference(iter1, iter2, compare) {
        if (!(this instanceof Difference)) {
            return new Difference(iter1, iter2, compare);
        }
        AbstractIterator.call(this);
        this._iter1 = Iter.LookAhead(iter1);
        this._iter2 = Iter.LookAhead(iter2);
        this._compare = compare;
    }
    
    Difference.prototype = Object.create(AbstractIterator.prototype);
    Difference.prototype.constructor = Difference;
    
    Difference.prototype._iter1 = null;
    Difference.prototype._iter2 = null;
    Difference.prototype._compare = null;
    Difference.prototype.current = null;
    Difference.prototype.next = function () {
        var n1 = this._iter1.peek();
        var n2 = this._iter2.peek();
        while (n1 && n2) {
            //print("n1 - " + n1);
            //print("n2 - " + n2);
            var c = this._compare(n1, n2);
            if (c < 0) {
                //print("<");
                this.current = this._iter1.next();
                return this.current;
            } else if (c > 0) {
                //print(">");
                this._iter2.next();
                n2 = this._iter2.peek();
            } else {
                //print("=");
                this._iter1.next();
                this._iter2.next();
                n1 = this._iter1.peek();
                n2 = this._iter2.peek();
            }
        }
        if (n1 && ! n2) {
            //print("more: " + n1);
            this.current = this._iter1.next();
            return this.current;
        }
        this.current = null;
        return null;
    };
    
    /**
     * A Lookahead iterator takes a base iterator as input, and returns an iterator over the same items as the base sequence,
     * but with the ability to peek one item ahead in the input.
     * @param base the base iterator
     */
    
    function LookAhead(base) {
        if ("peek" in base) {
            return base;
        }
        if (!(this instanceof LookAhead)) {
            return new LookAhead(base);
        }
        AbstractIterator.call(this);
        this._base = base;
        this._nextButOne = base.next();
        //print("Lookahead.initial " + (this._nextButOne == null ? "null" : this._nextButOne.tagName + "(" + this._nextButOne.textContent + ") "));
    }
    
    LookAhead.prototype = Object.create(AbstractIterator.prototype);
    LookAhead.prototype.constructor = LookAhead;
    
    LookAhead.prototype._base = null;
    LookAhead.prototype.next = function () {
        var temp = this._nextButOne;
        //print("Lookahead.next " + showValue(temp));
        if (temp) {
            this._nextButOne = this._base.next();
        }
        return temp;
    };
    // peek() returns the same result as next() but without changing the iterator position
    LookAhead.prototype.peek = function () {
        //print("Lookahead.peek " + showValue(this._nextButOne));
        return this._nextButOne;
    };
    
    //function makeLookAheadIterator(base) {
    //    return "peek" in base ? base : LookAheadIterator(base);
    //}
    
    /**
     * A Tracker Iter  takes a base iterator as input, and returns an iterator over the same items as the base sequence,
     * but with the ability to get the current item in the sequence (the one most recently delivered by calling next()),
     * to determine the position of the current item in the sequence, and to determine the number of items in the sequence
     * by reading ahead.
     * @param base the base iterator
     */
    
    function Tracker(base) {
        if (!(this instanceof Tracker)) {
            return new Tracker(base);
        }
        AbstractIterator.call(this);
        this._base = base;
    }
    
    Tracker.prototype = Object.create(AbstractIterator.prototype);
    Tracker.prototype.constructor = Tracker;
    
    
    Tracker.prototype._base = null;
    Tracker.prototype._last = -1;
    /**
     * position returns the 1-based position of the current item in the sequence. Its value is 0 before
     * the first item has been read, and is -1 after a call on next() has returned null.
     */
    Tracker.prototype.position = 0;
    /**
     * current returns the item that was most recently returned by calling next(). Before the first call
     * on next(), and after a call on next() has returned null, the value is null.
     */
    Tracker.prototype.current = null;
    /**
     * next() delivers the next item in the sequence. At the end of the sequence it returns null.
     */
    Tracker.prototype.next = function () {
        this.position++;
        this.current = this._base.next();
        if (this.current === null) {
            this.position = -1;
        }
        return this.current;
    };
    /**
     * last() delivers the number of items in the sequence. If the base iterator has an expand() function
     * this is achieved by getting the size of the expanded base iterator. Otherwise it is achieved by reading
     * all the items delivered by the base iterator into an array; subsequent calls on next() then access this
     * array instead of making further calls on the base iterator.
     * @returns a number indicating the number of items in the base sequence.
     */
    Tracker.prototype.last = function () {
        if (this._last < 0) {
            if (this._base instanceof ForArray) {
                this._last = this._base.expand().length;
            } else {
                var reservoir =[];
                var item;
                while ((item = this._base.next()) !== null) {
                    reservoir.push(item);
                }
                this._last = this.position + reservoir.length;
                this._base = Iter.ForArray(reservoir);
            }
        }
        return this._last;
    };
    
    
    return {
        Empty: Empty,
        Singleton: Singleton,
        Join: Join,
        Stepping: Stepping,
        LookAhead: LookAhead,
        Tracker: Tracker,
        ForArray: ForArray,
        Union: Union,
        Intersect: Intersect,
        Difference: Difference,
        AnyIterator: AbstractIterator,
        
        trace: function (label, iter, verbose) {
            var item;
            var array =[];
            while ((item = iter.next()) !== null) {
                var display;
                if (typeof item == "object") {
                    if (item instanceof Node) {
                        display = verbose ? item.toString(): (item.nodeType + ":" + (item.tagName || item.textContent));
                    } else if (item instanceof NamespaceNode) {
                        display = "xmlns:" + item.prefix + "=" + item.uri;
                    } else {
                        display = item.toString();
                    }
                } else {
                    display = typeof item;
                }
                print(label + ": " + display);
                array.push(item);
            }
            if (array.length === 0) {
                print(label + ": <empty>");
            }
            return Iter.ForArray(array);
        },
        
        
        oneString: function (str) {
            return Iter.Singleton(Atomic.string.fromString(str));
        },
        
        oneInteger: function (number) {
            return Iter.Singleton(Atomic.integer.fromNumber(number));
        },
        
        oneDouble: function (number) {
            return Iter.Singleton(Atomic. double.fromNumber(number));
        },
        
        oneFloat: function (number) {
            return Iter.Singleton(Atomic. float.fromNumber(number));
        },
        
        oneDecimal: function (big) {
            return Iter.Singleton(Atomic.decimal.fromBig(big));
        },
        
        oneBoolean: function (bool) {
            return Iter.Singleton(Atomic. boolean.fromBoolean(bool));
        }
    };
}
();
var makePattern = function(node) {

    "use strict";

    var patterns = {
        "p.any": function(item) {
            return function() {
                return true;
            };
        },
        "p.booleanExp": function(node) {
            return function(item, context) {
                var c2 = context.newContext();
                c2.focus = Iter.Tracker(Iter.Singleton(item));
                c2.focus.next();
                return Expr.ebv(Expr.evalChild1(node, c2));
            };
        },
        "p.genNode": function (node) {
            var equivExpr = DomUtils.getChildElements(node)[0];
            return function (item, context) {
                if (!DomUtils.isNode(item)) {
                    return false;
                }
                //print("p.genNode testing " + showValue(item));
                var iter = Axis.ancestorOrSelf(item);
                var anc;
                while ((anc = iter.next()) !== null) {
                    //print("anc " + showValue(anc));
                    var c2 = context.newContext(false);
                    c2.focus = Iter.Tracker(Iter.Singleton(anc));
                    c2.focus.next();
                    var nodeset = Expr.evaluate(equivExpr, c2);
                    var desc;
                    while ((desc = nodeset.next()) !== null) {
                        if (desc == item) {
                            //print("found!!!");
                            return true;
                        }
                    }
                }
                return false;
            };
        },
        "p.nodeSet": function (node) {
            return function (item, context) {
                var iter = Expr.evalChild1(node, context);
                var it;
                while ((it = iter.next()) !== null) {
                    //print("p.nodeSet comparing " + showValue(it) + " with " + showValue(item));
                    if (it == item) {
                        return true;
                    }
                }
                return false;
            };
        },
        "p.nodeTest": function(node) {
            //print("nodeTest: " + node.getAttribute("jsTest"));
            /*jslint evil: true */
            return new Function('item', node.getAttribute("jsTest"));
        },
        "p.simPos": function (node) {
            /*jslint evil: true */
            var test = new Function('item', node.getAttribute("jsTest"));
            var pos = parseInt(node.getAttribute("pos"), 10);
            return function(item, context) {
                return test(item) &&
                    Axis.precedingSibling(item).filter(test).count() == pos - 1;
            };
        },
        "p.venn": function (node) {
            var kids = DomUtils.getChildElements(node);
            var lhs = makePattern(kids[0]);
            var rhs = makePattern(kids[1]);
            var op = node.getAttribute("op");
            switch (op) {
                case "union":
                    return function(item, context) {
                        return lhs(item, context) || rhs(item, context);
                    };
                case "intersect":
                    return function (item, context) {
                        return lhs(item, context) && rhs(item, context);
                    };
                case "except":
                    return function (item, context) {
                        return lhs(item, context) && !rhs(item, context);
                    };
                default:
                    throw XError("unknown op " + op, "SXJS0003");
            }
        },
        "p.withCurrent": function (node) {
            var basePattern = makePattern(DomUtils.getChildElements(node)[0]);
            return function (item, context) {
                var c2 = context.newContext(true);
                c2.localVars[0] = [item];
                return basePattern(item, c2);
            };
        },
        "p.withPredicate": function (node) {
            var kids = DomUtils.getChildElements(node);
            var basePattern = makePattern(kids[0]);
            var predicate = kids[1];
            return function(item, context) {
                if (!basePattern(item, context)) {
                    return false;
                }
                var c2 = context.newContext(false);
                c2.focus = Iter.Tracker(Iter.Singleton(item));
                c2.focus.next();
                var result = Expr.ebv(Expr.evaluate(predicate, c2));
                //print("testing item " + item);
                //print("pattern predicate result = " + result);
                return result;
            };
        },
        "p.withUpper": function(node) {
            var kids = DomUtils.getChildElements(node);
            var basePattern = makePattern(kids[0]);
            var upperPattern = makePattern(kids[1]);
            var axis = node.getAttribute("axis");
            if (axis == "parent") {
                if (node.getAttribute("upFirst") == "true") {
                    return function(item, context) {
                        var parent = DomUtils.xdmParentNode(item);
                        return parent && upperPattern(parent, context) && basePattern(item, context);
                    };
                } else {
                    return function (item, context) {
                        var parent = DomUtils.xdmParentNode(item);
                        return parent && basePattern(item, context) && upperPattern(parent, context);
                    };
                }
            } else {
                return function(item, context) {
                    if (!basePattern(item, context)) {
                        return false;
                    }
                    var ancestors = Axis[axis](item);
                    var anc;
                    while ((anc = ancestors.next()) !== null) {
                        if (upperPattern(anc, context)) {
                            return true;
                        }
                    }
                    return false;
                };
            }
        }
    };

    var pat = patterns[node.tagName];
    if (pat) {
        return pat(node);
    } else {
        throw XError("Unimplemented pattern " + node.tagName, "SXJS0002");
    }
};
var Regex = (function () {
    
    "use strict";

    var regexCategoryEscapes = null;

    var fullUnicode = false;

    try {
        fullUnicode = '\uD83D\uDE80'.match(new RegExp('.', 'gu')).length == 1;
    } catch (e) {
        fullUnicode = false;
    }

    function obtainCategoryEscapes() {
        if (regexCategoryEscapes === null) {
            print("Loading categories.json");
            var content = SaxonJS.getPlatform().readResource("opt/categories.json");
            regexCategoryEscapes = JSON.parse(content);
            print("Finished loading categories.json");
        }
        return regexCategoryEscapes;
    }

    // Perform some simple preprocessing of regular expressions to handle the most common differences
    // between the XPath and JS regex dialects. Can be suppressed using the flag "j".

    function prepareRegex(regex, flags, input) {

        function handleEscapes(regex, i) {
            // Given an integer such as 10, generate the \u hex escaped form \u000A
            function toU(code) {
                var h = code.toString(16);
                while (h.length < 4) {
                    h = "0" + h;
                }
                return "\\u" + (fullUnicode && h.length > 4 ? "{" + h + "}" : h);
            }

            // Given a monotonic sequence of integers such as (2, 5, 10, 12), treated as
            // a sequence of pairs ((2 - 5), (10 - 12)), generate the set of
            // ranges in regex form \u0002-\u0003\u000A-\u000C etc
            function expandPairs(bounds) {
                var output = "";
                for (var p = 0; p < bounds.length; p += 2) {
                    if (fullUnicode || bounds[p + 1] < 65536) {
                        output += toU(bounds[p]);
                        if (bounds[p + 1] > bounds[p]) {
                            output += "-" + toU(bounds[p + 1]);
                        }
                    }
                }
                return output;
            }

            // Given a sequence of implicitly-paired integers representing subranges, e.g. (2, 5, 10, 12)
            // representing (2..5, 10..12), generate the inverse ranges, (0..1, 6..9, 13..65535)
            function invertBounds(bounds) {
                var out = [];
                if (bounds[0] !== 0) {
                    out.push(0);
                    out.push(bounds[0] - 1);
                }
                for (var i = 2; i < bounds.length; i += 2) {
                    out.push(bounds[i - 1] + 1);
                    out.push(bounds[i] - 1);
                }
                var last = bounds[bounds.length - 1];
                if (fullUnicode || last < 65535) {
                    out.push(last + 1);
                    out.push(fullUnicode ? 1114111 : 65535);
                }
                return out;
            }

            // Expand a sequence of bounds in the form of implicitly-paired integers e.g. [10, 13, 48, 60]
            // meaning (10 to 13, 48 to 60)

            function expandIntRanges(bounds, inBrackets, inverse) {
                if (inverse) {
                    bounds = invertBounds(bounds);
                }
                var output = expandPairs(bounds);
                if (!inBrackets) {
                    output = "[" + output + "]";
                }
                return output;
            }

            // Expand a sequence of bounds in the form of hex strings, e.g [["A", "D"], ["31", "3A"]]

            function expandStringRanges(ranges, inBrackets, inverse) {
                var bounds = [];
                ranges.forEach(function (range) {
                    bounds.push(parseInt(range[0], 16));
                    bounds.push(parseInt(range[1], 16));
                });
                return expandIntRanges(bounds, inBrackets, inverse);
            }

            var next = regex.charAt(i + 1);
            if (STRICT && "nrt\\|.-^?*+{}()[]pPsSiIcCdDwW$".indexOf(next) < 0 && !(bracketDepth === 0 && /[0-9]/.test(next))) {
                error("\\" + next + " is not allowed in XPath regular expressions");
            }
            if ((next == "p" || next == "P")) {
                //print("found \\p{}");
                var end = regex.indexOf("}", i);
                var cat = regex.substring(i + 3, end);
                if (hasFlag("x")) {
                    cat = cat.replace(/[ \n\r\t]+/g, ""); //cat = cat.replace(" ", "");
                }
                var regexCE = obtainCategoryEscapes();
                var data = regexCE[cat];
                if (!data) {
                    error("Unknown category " + cat);
                }
                var ranges;
                if (cat.length == 1) {
                    // e.g. \P{L}
                    ranges = [];
                    data.split("\|").forEach(function (subRange) {
                        ranges = ranges.concat(regexCE[subRange]);
                    });
                } else {
                    ranges = data;
                }
                output += expandStringRanges(ranges, bracketDepth > 0, next == "P");

                i = end;
            } else if (next == "d") {
                output += expandStringRanges(obtainCategoryEscapes().Nd, bracketDepth > 0, false);
                i++;
            } else if (next == "i") {
                output += expandIntRanges(iniNameChar, bracketDepth > 0, false);
                i++;
            } else if (next == "c") {
                output += expandIntRanges(nameChar, bracketDepth > 0, false);
                i++;
            } else if (next == "I") {
                output += expandIntRanges(iniNameChar, bracketDepth > 0, true);
                i++;
            } else if (next == "C") {
                output += expandIntRanges(nameChar, bracketDepth > 0, true);
                i++;
            } else if (/[0-9]/.test(next)) {
                if (bracketDepth > 0) {
                    error("Numeric escape within charclass");
                } else {
                    // TODO: check multi-digit back-references
                    if (!rParenClosed[parseInt(next, 10)]) {
                        error("No capturing expression #" + next);
                    } else {
                        print("Capture #" + next + " ok");
                    }
                    output += "\\" + next;
                    i++;
                }
            } else if(next == "-" || next=="$") {
                output += next;
                i++;
            } else {
                output += "\\" + next;
                i++;
            }
            return {output: output, i: i};
        }

        var STRICT = true;

        flags = flags ? flags.toString() : "";

        if (!fullUnicode && input && Expr.isAstral(input)) {
            throw new XError("Cannot handle non-BMP characters with regular expressions in this browser", "SXJS0002");
        }
        //print("flags " + flags);
        function hasFlag(flag) {
            return flags.indexOf(flag) >= 0;
        }

        function error(msg) {
            throw new XError("Invalid XPath regular expression: " + msg, "FORX0002");
        }

        var jsFlags = (hasFlag("i") ? "i" : "") + (hasFlag("m") ? "m" : "") + (hasFlag("g") ? "g" : "") + (fullUnicode ? "u" : "");

        if (hasFlag("j")) {
            // Flag "j" means use the regex with JS syntax and semantics
            return new RegExp(regex, flags.replace("j", ""));
        }
        if (hasFlag("q")) {
            return new RegExp(regex.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"), jsFlags);
        }
        var output = "";
        var bracketDepth = 0;

        var iniNameChar = [
            // Read this as a sequence of start..end pairs representing ranges
            0x3A, 0x3A, 0x41, 0x5A, 0x5F, 0x5F, 0x61, 0x7A, 0xC0, 0xD6, 0xD8, 0xF6, 0xF8, 0x2FF, 0x370, 0x37D,
            0x37F, 0x1FFF, 0x200C, 0x200D, 0x2070, 0x218F, 0x2C00, 0x2FEF, 0x3001, 0xD7FF, 0xF900, 0xFDCF,
            0xFDF0, 0xFFFD, 0x10000, 0xEFFFF
        ];
        var nameChar = [
            // Read this as a sequence of start..end pairs representing ranges
            0x2D, 0x2E, 0x30, 0x3A, 0x41, 0x5A, 0x5F, 0x5F, 0x61, 0x7A, 0xB7, 0xB7, 0xC0, 0xD6,
            0xD8, 0xF6, 0xF8, 0x37D, 0x37F, 0x1FFF, 0x200C, 0x200D, 0x203F, 0x2040, 0x2070, 0x218F,
            0x2C00, 0x2FEF, 0x3001, 0xD7FF, 0xF900, 0xFDCF, 0xFDF0, 0xFFFD, 0x10000, 0xEFFFF
        ];


        //print("PrepareRegex /" + regex + "/");

        var parenStack = [];
        var rParenClosed = [];
        var parenNr = 1;

        var i;
        for (i = 0; i < regex.length; i++) {
            var c = regex.charAt(i);
            switch (c) {
                case "[":
                    if (STRICT && bracketDepth > 0) {
                        if (regex.charAt(i - 1) == "-") {
                            error("Regex subtraction not implemented");
                            // TODO: rewrite [A-[B]] as (?![B])[A]
                        } else {
                            error("Nested square brackets");
                        }
                    }
                    if (regex.charAt(i + 1) == "]") {
                        error("Character group is empty");
                    }
                    bracketDepth++;
                    output += c;
                    break;
                case "]":
                    if (bracketDepth === 0) {
                        error("Unmatched ']'");
                    }
                    bracketDepth--;
                    output += c;
                    break;
                case "(":
                    var capture = true;
                    if (i + 2 < regex.length) {
                        if (regex.charAt(i + 1) == "?") {
                            if (regex.charAt(i + 2) != ":") {
                                error("'(?' must be followed by ':'");
                            } else {
                                capture = false;
                            }
                        }
                    }
                    parenStack.push(capture ? parenNr++ : -1);
                    output += c;
                    break;
                case ")":
                    if (parenStack.length === 0) {
                        error("Unmatched ')'");
                    }
                    var closer = parenStack.pop();
                    if (closer > 0) {
                        rParenClosed[closer] = true;
                    }
                    output += c;
                    break;
                case ".":
                    if (bracketDepth === 0 && hasFlag("s")) {
                        output += "[^]"; // Matches any (single) character
                    } else {
                        output += c;
                    }
                    break;
                case "{":
                    if (STRICT && regex.charAt(i + 1) == ",") {
                        throw XError("{,x} not allowed in XPath regex dialect", "FORX0002");
                    }
                    output += c;
                    break;
                case " ":
                case "\n":
                case "\r":
                case "\t":
                    if (!hasFlag("x") || bracketDepth > 0) {
                        output += c;
                    }
                    break;
                case "\\":
                    //print("found escape");
                    if (hasFlag("q")) {
                        output += "\\\\";
                    } else if (i + 1 < regex.length) {
                        var escapes = handleEscapes(regex, i);
                        output = escapes.output;
                        i = escapes.i;
                    } else {
                        throw XError("No character for escape code in XPath regex", "FORX0002");
                    }
                    break;
                default:
                    output += c;
            }
        }
        if (bracketDepth > 0) {
            error("Unmatched '['");
        }
        if (parenStack.length !== 0) {
            error("Unmatched '(");
        }
        //print("Preprocessed regex: " + output);
        try {
            return new RegExp(output, jsFlags);
        } catch (e) {
            if (/^[imsxjqg]*$/.test(flags)) {
                throw new XError("Invalid regular expression /" + regex + "/: " + e.message, "FORX0002");
            } else {
                throw new XError("Invalid regex flags: " + flags, "FORX0001");
            }
        }
    }

    function convertReplacement(str, flags) {
        flags = flags.toString();
        if (/j/.test(flags)) {
            return str;
        } else if (/q/.test(flags)) {
            // Ensure the replacement string does not contain $' or $` which have special meaning in JS regex
            if (/\$['`]/.test(str)) {
                str = str.replace(/\$'/g, "$$$$'").replace(/\$`/g, "$$$$`");
            }
            return str.replace(/\$/g, "$$");
        } else {
            if (/(^|[^\\])\$([^0-9]|$)/.test(str) || /(^|[^\\])\\([^\\\$]|$)/.test(str)) {
                throw new XError("Invalid replacement string: " + str, "FORX0004");
            }
            return str.replace(/\\\\/g, "\\").replace(/\\\$/g, "$$$$").replace(/\$0/g, "$$&");
        }

    }

    var NamePattern = prepareRegex("^\\i\\c*$", "");
    var NMTOKENPattern = prepareRegex("^\\c+$", "");


    return {
        obtainCategoryEscapes: obtainCategoryEscapes,
        prepareRegex: prepareRegex,
        convertReplacement: convertReplacement,
        isNCName: function(s) {
            return NamePattern.test(s) && !/:/.test(s);
        },
        isName: function (s) {
            return NamePattern.test(s);
        },
        isNMTOKEN: function(s) {
            return NMTOKENPattern.test(s);
        },
        isQName: function(s) {
            // at most one colon allowed, not at the start or end
            return NamePattern.test(s) && /^[^:]+(:[^:]+)?$/.test(s);
        },
        trim: function(s) {
            // trim leading and trailing WS according to XML definition of whitespace
            return s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
        }
    };

})();


/**
 * CoreFn object containing a mapping from names of XPath functions
 * to (JS) functions providing the implementation. Each JS function accepts
 * three arguments:
 * args - an array of arguments to the function, each one being an iterator
 * over the items in the value of the argument
 * context - the context object
 * expr - the expression representing the function call
 * The function always returns an iterator over the result.
 */
var CoreFn = function () {

    "use strict";

    var E = Expr;
    var DU = DomUtils;

    function pool(key, context, fetch) {
        var content = context.fixed.documentPool[key];
        //print("Looked for " + key + (content ? ": found" : ": not found"));
        if (!content) {
            try {
                content = fetch();
            }
            catch (e) {
                content = e;
            }
            context.fixed.documentPool[key] = content;
            //print("Added document to pool " + key);
        } else {
            //print("Found " + key + " in pool");
        }
        if (content instanceof XError) {
            throw content;
        }
        return content;
    }

    function fetchDoc(uri, context) {
        if (uri.indexOf("#") >= 0) {
            throw XError("Fragments not supported in external document URIs", "FODC0002");
        }
        return pool(uri, context, function () {
            //print("Reading resource " + uri);
            var xml = SaxonJS.getPlatform().readFile(uri);
            var doc = DU.obtainDocumentNumber(SaxonJS.getPlatform().parseXmlFromString(xml));
            //print("doc: " + doc);
            doc._saxonDocumentUri = uri;
            doc._saxonBaseUri = uri;
            //print("Successfully read resource " + uri);
            return doc;
        });
    }

    function fetchTextDoc(uri, context) {
        if (uri.indexOf("#") >= 0) {
            throw XError("Fragments not supported in external document URIs", "FODC0002");
        }
        return pool(uri, context, function () {
            return SaxonJS.getPlatform().readFile(uri, "utf-8");
        });
    }

    /**
     * Get the absolute URI formed by resolving the first argument against the static base URI
     * @param args the arguments to a function
     * @param context the evaluation context
     * @param expr the expression whose static base URI is required
     * @return the absolute URI formed by resolving the value of the first argument against the static base URI;
     * or null if the first argument is an empty sequence
     */

    function absoluteUri(args, context, expr) {
        var base = E.staticBaseUri(expr, context);
        //print("base " + base);
        var href = args[0].next();
        //print("href " + href.toString());
        return href === null ? null : SaxonJS.getPlatform().resolveUri(href.toString(), base);
    }

    /**
     * Get the unparsed text resource identified by the relative URI in the first argument
     * @param args the arguments to a function
     * @param context the evaluation context
     * @param expr the expression representing the function call
     * @return the resource identified by the first argument; or an error if no resource can be read;
     * or null of the first argument is an empty sequence.
     */

    function fetchText(args, context, expr) {
        var uri;
        try {
            uri = absoluteUri(args, context, expr);
        } catch (e) {
            throw XError(e.message, "FOUT1170", expr);
        }
        if (uri.match(/#/)) {
            throw XError("Fragment identifier for uparsed-text" + uri.toString(), "FOUT1170", expr);
        }
        var enc = "";
        if (args[1]) {
            enc = stringZeroLengthIfAbsent(args[1]);
            if (enc != "utf-8" && enc != "utf-16") {
                throw XError("Unrecognized encoding " + enc, "FOUT1190");
            }
        }
        return uri === null ? null : pool(uri, context, function () {
            try {
                return SaxonJS.getPlatform().readFile(uri, enc);
            }
            catch (e) {
                throw XError("Cannot retrieve unparsed-text " + uri.toString(), "FOUT1170", expr);
            }
        });
    }

    function resourceAvailable(fetch) {
        try {
            fetch();
            return Iter.oneBoolean(true);
        }
        catch (e) {
            return Iter.oneBoolean(false);
        }
    }

    function dynamicEQName(arg, expr, errCode, defaultNS) {
        var supplied = arg.next();
        if (supplied) {
            var lexi = Regex.trim(supplied.toString());
            if (defaultNS && Regex.isNCName(lexi)) {
                return "Q{" + defaultNS + "}" + lexi;
            }
            var qn = Atomic.QName.fromString(lexi, E.stylesheetResolver(expr, false));
            if (qn === null) {
                throw new XError("Invalid QName " + lexi, errCode, expr);
            }
            return "Q{" + qn.uri + "}" + qn.local;
        } else {
            return null;
        }
    }

    function escape(args, test) {
        var str = stringZeroLengthIfAbsent(args[0]);
        var out = "";
        Expr.stringToCodepoints(str).forEach(function (ch) {
            var s = Expr.codepointsToString([ch]);
            out += test(ch, s) ? encodeURIComponent(s) : s;
        });
        return Iter.oneString(out);
    }

    function checkTimeFormat(fn, args) {
        if (!(args.length == 2 || args.length == 5)) {
            throw new XError("Wrong number of arguments (" + args.length + ") for  " + fn, "XPST0017");
        }
    }

    function applyFn(args) {
        // assume that this is invoking map.get() or array.get()
        var target = args[0].next();
        var key = args[1].next();
        //print("is XDM array? " + (key instanceof Expr.XdmArray));
        //print("apply " + showValue(key));
        var kv = key.value[0][0];
        if (target instanceof Expr.XdmArray) {
            kv = kv.toNumber();
        }
        return Iter.ForArray(target.get(kv));
    }


    return {
        abs: function (args) {
            var input = args[0].next();
            return input === null ? Iter.Empty : Iter.Singleton(input.abs());
        },
        "adjust-date-to-timezone": function (args, context) {
            return adjustToTimezone(args, "date", context);
        },
        "adjust-dateTime-to-timezone": function (args, context) {
            return adjustToTimezone(args, "dateTime", context);
        },
        "adjust-time-to-timezone": function (args, context) {
            return adjustToTimezone(args, "time", context);
        },
        "analyze-string": function (args, context) {
            var input = stringZeroLengthIfAbsent(args[0]);
            var result = context.resultDocument.createDocumentFragment();
            var ns = "http://www.w3.org/2005/xpath-functions";
            var root = context.resultDocument.createElementNS(ns, "analyze-string-result");
            result.appendChild(root);
            if (input === "") {
                return Iter.Singleton(root);
            }
            var regex = args[1].next().toString();
            var flags = args[2] ? args[2].next().toString() : "";
            var details = Expr.analyze(input, regex, flags, false, false);
            details.forEach(function (item) {
                var newElement, textContent;
                if (item.matching) {
                    var index, groups = item.groups;
                    newElement = context.resultDocument.createElementNS(ns, "match");
                    var g, pos = 0;
                    for (g = 1; g < groups.length; g++) {
                        if (groups[g]) {
                            index = groups[0].indexOf(groups[g], pos);
                            if (index > pos) {
                                textContent = context.resultDocument.createTextNode(groups[0].substring(pos, index));
                                newElement.appendChild(textContent);
                            }
                            var group = context.resultDocument.createElementNS(ns, "group");
                            group.setAttribute("nr", g);
                            var groupContent = context.resultDocument.createTextNode(groups[g]);
                            group.appendChild(groupContent);
                            newElement.appendChild(group);
                            pos = index + groups[g].length;
                        }
                    }
                    if (pos < groups[0].length) {
                        textContent = context.resultDocument.createTextNode(groups[0].substring(pos, index));
                        newElement.appendChild(textContent);
                    }
                    root.appendChild(newElement);
                } else {
                    newElement = context.resultDocument.createElementNS(ns, "non-match");
                    textContent = context.resultDocument.createTextNode(item.string);
                    newElement.appendChild(textContent);
                    root.appendChild(newElement);
                }
            });
            return Iter.Singleton(root);
        },
        apply: applyFn,
        "_APPLY": applyFn, // _APPLY used by 9.7
        "available-environment-variables": function () {
            return Iter.Empty;
        },
        avg: function (args) {
            var seq = args[0].mapOneToOne(E.untypedToDouble);
            var first = seq.next();
            if (first === null) {
                return Iter.Empty;
            }
            var zero = {
                sum: first, count: 1
            };
            //print("zero: " + showValue(zero.sum));
            var add = Calculate["a+a"];
            try {
                var result = fold(seq, zero, function (item, value) {
                    return {
                        sum: add(value.sum, item), count: value.count + 1
                    };
                });
                //print("sum: " + showValue(result.sum));
                return Iter.Singleton(Calculate["a/a"](result.sum, Atomic.integer.fromNumber(result.count)));
            }
            catch (e) {
                throw new XError("Input to avg() contains a mix of numeric and non-numeric values ", "FORG0006");
            }
        },
        "base-uri": function (args) {
            return args[0].mapOneToOne(function (node) {
                var b = DU.baseURI(node);
                //print("base-uri of " + showValue(node) + " --> " + b);
                return b === null ? null : Atomic.anyURI.fromString(b);
            });
        },
        "boolean": function (args) {
            return Iter.oneBoolean(E.ebv(args[0]));
        },
        ceiling: function (args) {
            var x = args[0].next();
            return Iter.Singleton(x === null ? null : x.ceiling());
        },
        "codepoint-equal": function (args) {
            var str1 = args[0].next();
            var str2 = args[1].next();
            if (str1 === null || str2 === null) {
                return Iter.Empty;
            }
            return Iter.oneBoolean(str1.toString() === str2.toString());
        },

        "codepoints-to-string": function (args) {
            return Iter.oneString(
                E.codepointsToString(
                    args[0].expand().map(
                        function (item) {
                            return item.toNumber();
                        })));
        },
        "collation-key": function (args, context, expr) {
            var collationObj = Compare.getCollation(expr, args[1]);
            var str = args[0].next();
            var key = collationObj.collationKey(str.value);
            return Iter.Singleton(Atomic.base64Binary.encodeFromString(key));
        },
        collection: function () {
            return Iter.Empty;
        },
        compare: function (args, context, expr) {
            var str1 = args[0].next();
            var str2 = args[1].next();
            if (str1 === null || str2 === null) {
                return Iter.Empty;
            } else {
                var result = Compare.getCollation(expr, args[2]).compare(str1.value, str2.value);
                return Iter.oneInteger(result);
            }
        },
        concat: function (args) {
            return Iter.oneString(args.map(function (iter) {
                var item = iter.next();
                return item === null ? "" : Atomic.string.cast(item);
            }).join(""));
        },
        contains: function (args, context, expr) {
            var str = stringZeroLengthIfAbsent(args[0]);
            var substr = stringZeroLengthIfAbsent(args[1]);
            var result = Compare.getCollation(expr, args[2]).contains(str, substr);
            return Iter.oneBoolean(result);
        },
        "contains-token": function (args, context, expr) {
            var str = stringZeroLengthIfAbsent(args[0]);
            var substr = stringZeroLengthIfAbsent(args[1]);
            substr = Regex.trim(substr);
            if (substr === "") {
                return Iter.oneBoolean(false);
            }
            var result = Compare.getCollation(expr, args[2]).containsToken(str, substr);
            return Iter.oneBoolean(result);
        },
        count: function (args) {
            return Iter.oneInteger(args[0].count());
        },
        "current-date": function (args, context) {
            //print("currentdate tz: " + context.fixed.currentDate.getTimezoneOffset());
            return Iter.Singleton(Atomic.date.fromDate(context.fixed.currentDate, -context.fixed.currentDate.getTimezoneOffset()));
        },
        "current-dateTime": function (args, context) {
            // TODO should return dateTimeStamp not just dateTime, but subtype not implemented
            return Iter.Singleton(Atomic.dateTime.fromDate(context.fixed.currentDate, -context.fixed.currentDate.getTimezoneOffset()));
        },
        "current-time": function (args, context) {
            return Iter.Singleton(Atomic.time.fromDate(context.fixed.currentDate, -context.fixed.currentDate.getTimezoneOffset()));
        },
        data: function (args) {
            return args[0].mapOneToOne(E.atomize);
        },
        dateTime: function (args) {
            var date = args[0].next();
            var time = args[1].next();
            if (date === null || time === null) {
                return Iter.Empty;
            }
            var tzString = "";
            // error if timezones are incompatible
            if (date.timezoneOffset !== null) {
                if (time.timezoneOffset === null) {
                    tzString = date.tzOffsetToString();
                } else if (time.timezoneOffset !== null && date.timezoneOffset != time.timezoneOffset) {
                    throw new XError("timezones are incompatible ", "FORG0005");
                }
            }
            return Iter.Singleton(Atomic.dateTime.fromString(
                date.toString().substring(0, 10) + "T" + time.toString() + tzString));
        },
        "day-from-date": function (args) {
            return dateComponent(args, "getUTCDate");
        },
        "day-from-dateTime": function (args) {
            return dateComponent(args, "getUTCDate");
        },
        "days-from-duration": function (args) {
            return durationComponent(args, 2);
        },
        "deep-equal": function (args, context, expr) {
            var result = Compare.getCollation(expr, args[2]).deepEqual(args[0], args[1]);
            return Iter.oneBoolean(result);
        },
        "default-collation": function () {
            return Iter.oneString("http://www.w3.org/2005/xpath-functions/collation/codepoint");
        },
        "default-language": function () {
            return Iter.oneString("en");
        },
        "distinct-values": function (args, context, expr) {
            var map = new HashTrie();
            map.options.sameKey = Compare.getCollation(expr, args[1]).deepEqualItems;
            return args[0].filter(function (item) {
                if (map.containsKey(item)) {
                    return false;
                } else {
                    map.inSituPut(item, true);
                    return true;
                }
            });
        },
        doc: function (args, context, expr) {
            var uri = absoluteUri(args, context, expr);
            if (uri === null) {
                return Iter.Singleton(null);
            } else {
                var d = fetchDoc(uri, context);
                var ss = SaxonJS.getSpaceStripper();
                if (ss !== null) {
                    d = ss(d);
                }
                return Iter.Singleton(d);
            }
        },
        "doc-available": function (args, context, expr) {
            var uri = absoluteUri(args, context, expr);
            return uri === null ? Iter.oneBoolean(false) : resourceAvailable(function () {
                fetchDoc(uri, context);
            });
        },
        document: function (args, context, expr) {
            var base;
            if (args[1]) {
                var b = DU.baseURI(args[1].next());
                if (b) {
                    base = b;
                }
            }
            if (!base) {
                base = E.staticBaseUri(expr, context);
            }
            return args[0].mapOneToMany(
                function (item) {
                    var b = DU.isNode(item) ? DU.baseURI(item) : base;
                    return E.atomize(item).mapOneToOne(function (href) {
                        if (b === null) {
                            throw new XError("No base URI for document('" + href + "')", "XTDE1162");
                        }
                        return fetchDoc(SaxonJS.getPlatform().resolveUri(href.toString(), b), context);
                    });
                });
        },
        "document-uri": function (args) {
            var node = args[0].next();
            if (node === null || node.nodeType != DU.DOCUMENT_NODE || !node._saxonDocumentUri) {
                return Iter.Empty;
            }
            return Iter.Singleton(Atomic.anyURI.fromString(node._saxonDocumentUri));
        },
        "element-available": function (args, context, expr) {
            // There's no real reason for calling this dynamically
            var parts = dynamicEQName(args[0], expr, "XTDE1440").split("}");
            return Iter.oneBoolean(true);
        },
        "element-with-id": function (args, context) {
            var id = stringZeroLengthIfAbsent(args[0]);
            if (!context.focus.current) {
                throw new XError("No context item for element-with-id()", "XPDY0002");
            }
            return Iter.Singleton(DU.ownerDocument(context.focus.current).getElementById(id));
        },
        empty: function (args) {
            return Iter.oneBoolean(args[0].next() === null);
        },
        "encode-for-uri": function (args) {
            // All characters are escaped except those identified as "unreserved" by [RFC 3986],
            // that is the upper- and lower-case letters A-Z, the digits 0-9, HYPHEN-MINUS ("-"),
            // LOW LINE ("_"), FULL STOP ".", and TILDE "~". But JS encodeURIComponent fails
            // to escape "!", "'", "(", ")", "*".
            var str = encodeURIComponent(stringZeroLengthIfAbsent(args[0])).replace(/[!'()*]/g, function (c) {
                return '%' + c.charCodeAt(0).toString(16).toUpperCase();
            });
            return Iter.oneString(str);
        },
        "ends-with": function (args, context, expr) {
            var str = stringZeroLengthIfAbsent(args[0]);
            var substr = stringZeroLengthIfAbsent(args[1]);
            var result = Compare.getCollation(expr, args[2]).endsWith(str, substr);
            return Iter.oneBoolean(result);
        },
        "environment-variable": function () {
            return Iter.Empty;
        },
        "error": function () {
            //TODO add arguments
            throw new XError("fn:error() invoked", "FOER0000");
        },
        "escape-html-uri": function (args) {
            return escape(args, function (ch) {
                return ch < 32 || ch > 126;
            });
        },
        "exactly-one": function (args) {
            var value = args[0].expand();
            if (value.length != 1) {
                throw new XError("Required length 1, actual length " + value.length, "FORG0005");
            }
            return Iter.Singleton(value[0]);
        },
        exists: function (args) {
            return Iter.oneBoolean(args[0].next() !== null);
        },
        "false": function () {
            return Iter.oneBoolean(false);
        },
        floor: function (args) {
            return args[0].mapOneToOne(function (item) {
                return item.floor();
            });
        },
        "format-date": function (args) {
            checkTimeFormat("format-date", args);
            if (args[2]) {
                return Iter.oneString(Numberer.formatDateTime("date", args[0].next(), args[1].next().toString(), args[2].next(), args[3].next(), args[4].next()));
            } else {
                return Iter.oneString(Numberer.formatDateTime("date", args[0].next(), args[1].next().toString()));
            }
        },
        "format-dateTime": function (args) {
            checkTimeFormat("format-dateTime", args);
            if (args[2]) {
                return Iter.oneString(Numberer.formatDateTime("dateTime", args[0].next(), args[1].next().toString(), args[2].next(), args[3].next(), args[4].next()));
            } else {
                return Iter.oneString(Numberer.formatDateTime("dateTime", args[0].next(), args[1].next().toString()));
            }
        },
        "format-integer": function (args) {
            // any supplied 3rd arg ($lang) is ignored (default lang is English)
            var num = args[0].next();
            if (num === null) {
                return Iter.oneString("");
            }
            return Iter.oneString(Numberer.formatInteger(num, args[1].next().toString()));
        },
        "format-number": function (args, context, expr) {
            var fmt = null;
            if (args[2]) {
                fmt = dynamicEQName(args[2], expr, "XTDE1260");
            }
            var num = args[0].next();
            if (num === null) {
                num = Number.NaN;
            } else {
                num = num.toDouble().value;
                // TODO precision issue
            }
            return Iter.oneString(Numberer.formatNumber(num, args[1].next().toString(), fmt, context));
        },
        "format-time": function (args) {
            checkTimeFormat("format-time", args);
            if (args[2]) {
                return Iter.oneString(Numberer.formatDateTime("time", args[0].next(), args[1].next().toString(), args[2].next(), args[3].next(), args[4].next()));
            } else {
                return Iter.oneString(Numberer.formatDateTime("time", args[0].next(), args[1].next().toString()));
            }
        },
        "function-available": function (args, context, expr) {
            // There's no real reason for calling this dynamically, so no attempt at efficiency
            var result = false;
            var fname = dynamicEQName(args[0], expr, "XTDE1400", "http://www.w3.org/2005/xpath-functions");
            var arity = (args[1] ? args[1].next().toNumber() : -1);
            //print("f-available " + fname + " # " + arity);
            if (context.fixed.userFunctions[fname + "#" + arity]) {
                //print("Found user function");
                result = true;
            } else {
                var qname = Atomic.QName.fromEQName(fname);
                var content = SaxonJS.getPlatform().readResource("opt/functions.json");
                var data = JSON.parse(content);
                var ns = data[qname.uri];
                //print("seeking: " + parts[0].substring(2) + " found " + ns);
                if (!ns || !ns[qname.local]) {
                    result = false;
                } else {
                    result = (arity >= 0 ? ns[qname.local].indexOf(arity) >= 0 : true);
                }
                //print("f-available? " + result);
            }
            return Iter.oneBoolean(result);
        },
        "generate-id": function (args, context) {
            var node = args[0].next();
            //print("generateId for " + showValue(node));
            if (node === null) {
                return Iter.oneString("");
            }
            var path = Axis.ancestorOrSelf(node).expand().reverse();
            var result = "";
            var i;
            for (i = 0; i < path.length; i++) {
                var sibs;
                if (path[i] instanceof NamespaceNode) {
                    result += "N" + path[i].prefix;
                } else if (path[i].nodeType == DU.ATTRIBUTE_NODE) {
                    result += "A" + DU.nameOfNode(path[i]).local;
                    // TODO: not quite conformant
                } else {
                    sibs = Axis.precedingSibling(path[i]).count() + 1;
                    result += Numberer.formatInteger(sibs, i % 2 === 0 ? "a" : "A");
                }
            }
            result = "d" + DU.documentNumber(path[0], context) + result;
            //print("node" + showValue(node) + " generateId: " + result);
            return Iter.oneString(result);
        },
        "has-children": function (args) {
            return Iter.oneBoolean(Axis.child(args[0].next()).next() !== null);
        },
        head: function (args) {
            return Iter.Singleton(args[0].next());
        },
        "hours-from-dateTime": function (args) {
            return dateComponent(args, "getUTCHours");
        },
        "hours-from-duration": function (args) {
            return durationComponent(args, 3);
        },
        "hours-from-time": function (args) {
            return dateComponent(args, "getUTCHours");
        },
        id: function (args, context) {
            var id = stringZeroLengthIfAbsent(args[0]);
            var doc = args[1] ? args[1].next() : DU.ownerDocument(context.focus.current);
            if (!DU.isNode(doc)) {
                throw new XError("Context item is not a node for fn:id()", "XPTY0004");
            }
            if (doc.nodeType != DomUtils.DOCUMENT_NODE && doc.nodeType != DomUtils.DOCUMENT_FRAGMENT_NODE) {
                doc = DU.ownerDocument(doc);
            }
            return Iter.Singleton(doc.getElementById(id));
        },
        idref: function () {
            // No IDREF information available from XML parser
            return Iter.Empty;
        },
        "implicit-timezone": function (args, context) {
            //print("implicit-timezone");
            return Iter.Singleton(Atomic.dayTimeDuration.fromNumberOfMinutes(-context.fixed.currentDate.getTimezoneOffset()));
        },
        "index-of": function (args, context, expr) {
            var base = Iter.Tracker(args[0]);
            var sought = args[1].next();
            var hasCollation = Compare.hasCollation(expr, args[2]);
            var collationObj = hasCollation ? Compare.getCollation(expr, args[2]) : null;
            return base.mapOneToOne(function (item) {
                try {
                    if (hasCollation) {
                        if (Atomic.string.matches(item) && Atomic.string.matches(sought)) {
                            return collationObj.equals(item.value, sought.value) ? Atomic.integer.fromNumber(base.position) : null;
                        } else {
                            return null;
                        }
                    } else {
                        return item.equals(sought) ? Atomic.integer.fromNumber(base.position) : null;
                    }
                }
                catch (e) {
                    return null;
                }
            });
        },
        innermost: function (args) {
            var result = [];
            args[0].forEachItem(function (item) {
                if (result.length > 0 && Axis.ancestor(item).some(function (anc) {
                        return anc == result[result.length - 1];
                    })) {
                    result.pop();
                }
                result.push(item);
            });
            return Iter.ForArray(result);
        },
        "in-scope-prefixes": function (args) {
            var element = args[0].next();
            return Iter.ForArray(DU.inScopeNamespaces(element).map(function (entry) {
                return Atomic.string.fromString(entry.prefix);
            }));
        },
        "insert-before": function (args) {
            var index = args[1].next().value;
            var insertion = args[2];
            var base = Iter.Tracker(args[0]);
            if (index < 1) {
                return Iter.Join([insertion, base]);
            } else if (index > base.last()) {
                return Iter.Join([base, insertion]);
            } else return base.mapOneToMany(function (item) {
                if (base.position == index) {
                    return Iter.Join([args[2], Iter.Singleton(item)]);
                } else {
                    return Iter.Singleton(item);
                }
            });
        },
        "iri-to-uri": function (args) {
            // The following printable ASCII characters are invalid in an IRI: "<", ">", " " " (double quote),
            // space, "{", "}", "|", "\", "^", and "`". Since these characters should not appear in an IRI,
            // if they do appear in $iri they will be percent-encoded. In addition, characters outside the
            // range x20-x7E will be percent-encoded because they are invalid in a URI.
            return escape(args, function (ch, s) {
                return ch <= 32 || ch > 126 || /[<>"{}|\\\^`]/.test(s);
            });
        },
        "json-doc": function (args, context, expr) {
            var uri = absoluteUri(args, context, expr);
            if (!uri) {
                return Iter.Empty;
            }
            var json = fetchTextDoc(uri, context);
            var options = args[1] ? args[1].next() : null;
            return Iter.Singleton(ConvertJson.parseToMap(json, options));
        },
        "json-to-xml": function (args, context, expr) {
            var inp = args[0].next();
            if (!inp) {
                return Iter.Empty;
            }
            var options = args[1] ? args[1].next() : null;
            var root = ConvertJson.parseToXml(inp.toString(), options, context);
            var doc = context.resultDocument.createDocumentFragment();
            doc.appendChild(root);
            doc._saxonBaseUri = E.staticBaseUri(expr, context);
            return Iter.Singleton(doc);
        },

        key: function (args, context, expr) {
            var keyName = dynamicEQName(args[0], expr, "XTDE1260");
            var keyDecl = context.fixed.keys[keyName];
            if (!keyDecl) {
                throw new XError("Unknown key " + keyName, "XTDE1260", expr);
            }
            var apex, doc;
            if (args[2]) {
                apex = args[2].next();
                doc = DU.ownerDocument(apex);
            } else {
                apex = DU.ownerDocument(context.focus.current);
                doc = apex;
            }
            if (doc === null) {
                throw new XError("No containing document for key()", "XTDE1270", expr);
            }
            if (!("_saxonIndexes" in doc)) {
                doc._saxonIndexes = {};
            }
            var indexes = doc._saxonIndexes;
            var index = indexes[keyName];
            if (!index) {
                //print("Creating index for " + lexi + " in " + apex);
                index = new HashTrie();
                indexes[keyName] = index;
                var matchedNodes;
                var matchSpec = DU.getChildElements(keyDecl)[0];
                if (matchSpec.tagName == "p.nodeSet") {
                    var cc2 = context.newContext(true);
                    cc2.focus = Iter.Tracker(Iter.Singleton(doc));
                    cc2.focus.next();
                    matchedNodes = E.evaluate(DU.getChildElements(matchSpec)[0], cc2);
                } else {
                    var match = makePattern(matchSpec);
                    matchedNodes = Axis.descendantOrSelf(doc).filter(function (item) {
                        //print("testing for match on " + item.tagName + " ? " + match(item, context));
                        return match(item, context);
                    });
                }
                var use = DU.getChildElements(keyDecl)[1];
                var c2 = context.newContext(true);
                var node;
                while ((node = matchedNodes.next()) !== null) {
                    //print("Processing matched node " + showValue(node));
                    c2.focus = Iter.Tracker(Iter.Singleton(node));
                    c2.focus.next();
                    var values = E.evaluate(use, c2);
                    var kVal;
                    while ((kVal = values.next()) !== null) {
                        if (index.containsKey(kVal)) {
                            var entries = index.get(kVal);
                            if (entries.indexOf(node) == -1) {
                                //print("Adding node to entry for " + showValue(kVal));
                                index.get(kVal).push(node);
                            }
                        } else {
                            //print("Creating entry for " + showValue(kVal));
                            index.inSituPut(kVal, [node]);
                        }
                    }
                }
            } else {
                //print("Using existing index for " + keyName);
            }
            var soughtValues = args[1];
            return soughtValues.mapOneToMany(
                function (item) {
                    if (index.containsKey(item)) {
                        //print("Found value " + showValue(item) + " in index");
                        var found = Iter.ForArray(index.get(item));
                        if (doc == apex) {
                            return found;
                        } else {
                            // filter the nodes to select only those beneath the apex
                            return found.filter(function (node) {
                                return Axis.ancestorOrSelf(node).filter(
                                        function (anc) {
                                            return anc == apex;
                                        }).next() !== null;
                            });
                        }
                    } else {
                        //print("Didn't find value " + showValue(item) + " in index");
                        return Iter.Empty;
                    }
                });
        },
        lang: function (args, context) {
            var start = args[1] ? args[1].next() : context.focus.current;
            if (!start) {
                throw new XError("No context item for lang()", "XPDY0002");
            } else if (!DU.isNode(start)) {
                throw new XError("Context item is not a node in lang()", "XPTY0004");
            }
            var sought = stringZeroLengthIfAbsent(args[0]).toLowerCase();
            var langFinder = Axis.ancestorOrSelf(start).filter(
                function (item) {
                    return item.nodeType == DU.ELEMENT_NODE && item.hasAttribute("xml:lang");
                    // Note: hasAttributeNS using the XML namespace does not work on xmldom
                });
            var firstLang = langFinder.next();
            if (!firstLang) {
                return Iter.oneBoolean(false);
            }
            var langVal = firstLang.getAttribute("xml:lang").toLowerCase();
            //print("xml:lang = " + langVal);
            var matches = sought == langVal ||
                (langVal.length > sought.length + 1 &&
                langVal.substring(0, sought.length) == sought &&
                langVal.charAt(sought.length) == "-");
            return Iter.oneBoolean(matches);
        },
        last: function (args, context) {
            if (!context.focus.current) {
                throw new XError("No context item for last()", "XPDY0002");
            }
            return Iter.oneInteger(context.focus.last());
        },
        "load-xquery-module": function () {
            throw new XError("No XQuery processor available", "FOQM0006");
        },
        "local-name": function (args) {
            var nodeName = DU.nameOfNode(args[0].next());
            return Iter.oneString(nodeName ? nodeName.local : "");
        },
        "local-name-from-QName": function (args) {
            var qn = args[0].next();
            return qn === null ? Iter.Empty : Iter.Singleton(Atomic["NCName"].fromString(qn.local));
        },
        "lower-case": function (args) {
            return Iter.oneString(stringZeroLengthIfAbsent(args[0]).toLowerCase());
        },
        matches: function (args) {
            var input = stringZeroLengthIfAbsent(args[0]);
            var regex = args[1].next().toString();
            var flags = args[2] ? args[2].next().toString() : "";
            if (!flags.match(/^[smijxq]*$/)) {
                throw new XError("Illegal flags for regular expression: " + flags, "FORX0001");
            }
            var regexp = Regex.prepareRegex(regex, flags, input);
            //print("Input? " + showValue(E.stringToCodepoints(input)));
            //print("Match? " + (input.search(regexp) >= 0));
            return Iter.oneBoolean(input.search(regexp) >= 0);
        },
        max: minimax("max"),
        min: minimax("min"),
        "minutes-from-dateTime": function (args) {
            return dateComponent(args, "getUTCMinutes");
        },
        "minutes-from-duration": function (args) {
            return durationComponent(args, 4);
        },
        "minutes-from-time": function (args) {
            return dateComponent(args, "getUTCMinutes");
        },
        "month-from-date": function (args) {
            return dateComponent(args, "getUTCMonth");
        },
        "month-from-dateTime": function (args) {
            return dateComponent(args, "getUTCMonth");
        },
        "months-from-duration": function (args) {
            return durationComponent(args, 1);
        },
        name: function (args) {
            var nodeName = DU.nameOfNode(args[0].next());
            return Iter.oneString(nodeName ? nodeName.toString() : "");
        },
        "namespace-uri": function (args) {
            var nodeName = DU.nameOfNode(args[0].next());
            return Iter.Singleton(Atomic.anyURI.fromString(nodeName ? nodeName.uri : ""));
        },
        "namespace-uri-for-prefix": function (args) {
            var prefix = stringZeroLengthIfAbsent(args[0]);
            var element = args[1].next();
            var ns = prefix == "xml" ? "http://www.w3.org/XML/1998/namespace" : element.lookupNamespaceURI(prefix);
            return ns ? Iter.Singleton(Atomic.anyURI.fromString(ns)) : Iter.Empty;
        },
        "namespace-uri-from-QName": function (args) {
            var qn = args[0].next();
            return qn === null ? Iter.Empty : Iter.Singleton(Atomic.anyURI.fromString(qn.uri));
        },
        nilled: function (args) {
            var element = args[0].next();
            return (!element || element.nodeType != DU.ELEMENT_NODE) ? Iter.Empty : Iter.oneBoolean(false);
        },
        "node-name": function (args) {
            return Iter.Singleton(DU.nameOfNode(args[0].next()));
        },
        "normalize-space": function (args) {
            var str = stringZeroLengthIfAbsent(args[0]);
            return Iter.oneString(Expr.wsCollapse(str));
        },
        "normalize-unicode": function (args) {
            // Use the JS platform implementation (ECMAScript 6) if available, else fail
            if (String.normalize) {
                var str = stringZeroLengthIfAbsent(args[0]);
                var form = args[1].next().toString();
                if (form == "NFC" || form == "NFD" || form == "NFKC" || form == "NFKD") {
                    return Iter.oneString(str.normalize(form));
                } else if (form === "") {
                    return Iter.oneString(str);
                }
            }
            throw new XError("normalize-unicode(): not supported on this Javascript platform", "FOCH0003");
        },
        not: function (args) {
            return Iter.oneBoolean(!E.ebv(args[0]));
        },
        number: function (args) {
            var x = args[0].next();
            var t = Atomic.double;
            if (x === null) {
                x = t.fromNumber(Number.NaN);
            } else if (Atomic.boolean.matches(x)) {
                x = Atomic.double.fromNumber(x.toBoolean() ? 1 : 0);
            } else {
                try {
                    x = t.fromString(x.toString());
                }
                catch (e) {
                    x = t.fromNumber(Number.NaN);
                }
            }
            return Iter.Singleton(x);
        },
        "one-or-more": function (args) {
            var ahead = Iter.LookAhead(args[0]);
            if (ahead.peek() === null) {
                throw new XError("Required length >= 1, actual length zero", "FORG0004");
            }
            return ahead;
        },
        outermost: function (args, context, expr) {
            var presorted = E.hasFlag(expr, "p");
            var input = args[0];
            if (!presorted) {
                input = DU.inDocumentOrder(input);
            }
            var prev = null;
            return input.filter(function (node) {
                //print("outermost: " + showValue(node));
                if (prev === null) {
                    print("OK: first");
                    prev = node;
                    return true;
                }
                if (Axis.ancestor(node).filter(function (anc) {
                        return anc === prev;
                    }).next() === null) {
                    //print("OK: prev not ancestor");
                    prev = node;
                    return true;
                } else {
                    return false;
                }
            });
        },
        "parse-ietf-date": function (args) {
            return args[0].mapOneToOne(function (s) {
                var bad = function () {
                    throw new XError("Invalid IETF date/time " + s.toString(), "FORG0010");
                };
                var twoDigits = function (s) {
                    return (s.length == 1 ? "0" + s : s);
                };
                var str = s.toString().trim().toLowerCase();
                str = str.replace(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun),?\s+/, "");
                //print("Prepared str=" + str);
                var re;
                var matches, month, day, year, time, tz;
                if (/^[a-z]/.test(str)) {
                    re = /^([a-z]{3})(?:\s*\-\s*|\s+)(\d\d\d?\d?)\s+([\d:\.]+)\s*([a-z]+|[+\-]\d\d?:?(?:\d\d)?(?:\s*\(\s*[a-z]+\s*\))?)?\s+(\d+)$/;
                    // month -? day time tz? year
                    matches = re.exec(str);
                    if (matches !== null) {
                        month = matches[1];
                        day = matches[2];
                        time = matches[3];
                        tz = matches[4];
                        year = matches[5];
                    } else {
                        bad();
                    }
                } else {
                    re = /^(\d+)(?:\s*\-\s*|\s+)([a-z]{3})(?:\s*\-\s*|\s+)(\d\d\d?\d?)\s+([\d:\.]+)\s*([a-z]+|[+\-]\d\d?:?(?:\d\d)?(?:\s*\(\s*[a-z]+\s*\))?)?$/;
                    // day -? month -? year time tz?
                    matches = re.exec(str);
                    if (matches !== null) {
                        day = matches[1];
                        month = matches[2];
                        year = matches[3];
                        time = matches[4];
                        tz = matches[5];
                    } else {
                        bad();
                    }
                }
                if (year.length == 2) {
                    year = "19" + year;
                }
                var m = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec".indexOf(month);
                if (m < 0) {
                    bad();
                }
                var tzNames = {
                    ut: "Z",
                    utc: "Z",
                    gmt: "Z",
                    est: "-05:00",
                    edt: "-04:00",
                    cst: "-06:00",
                    cdt: "-05:00",
                    mst: "-07:00",
                    mdt: "-06:00",
                    pst: "-08:00",
                    pdt: "-07:00"
                };
                if (/^[0-9]:/.test(time)) {
                    time = "0" + time;
                }
                if (time.length == 5) {
                    time += ":00";
                }
                if (tz) {
                    //print("tz before " + tz);
                    var tzParts = /([a-z]+)|([+\-]\d\d?:?(?:\d\d)?)(?:\s*\(\s*([a-z]+)\s*\))?$/.exec(tz);
                    if ((tzParts[3] && !(tzParts[3] in tzNames)) || (tzParts[1] && !(tzParts[1] in tzNames))) {
                        bad();
                    }
                    tz = tzParts[1] ? tzParts[1] : tzParts[2];
                    if (/^[+\-][0-9]((:|$)|[0-9]{2}$)/.test(tz)) {
                        tz = tz.substring(0, 1) + "0" + tz.substring(1);
                    }
                    //print("tz after " + tz);
                    if (tz in tzNames) {
                        tz = tzNames[tz];
                    } else if (tz.length == 3) {
                        tz = tz + ":00";
                    } else if (tz.length == 4) {
                        tz = tz + "00";
                    } else if (tz.length == 5) {
                        tz = tz.substring(0, 3) + ":" + tz.substring(3);
                    }
                }
                var iso = year + "-" + twoDigits((m / 4 + 1).toString()) + "-" + twoDigits(day) + "T" + time + (tz || "Z");
                //print("ISO: " + iso);
                return Atomic.dateTime.fromString(iso);
            });
        },
        "parse-json": function (args) {
            var inp = args[0].next().toString();
            var options = args[1] ? args[1].next() : null;
            return Iter.Singleton(ConvertJson.parseToMap(inp, options));
        },
        "parse-xml": function (args, context, expr) {
            var xml = args[0].next().toString();
            //print("parse-xml:" + xml);
            try {
                var doc = SaxonJS.getPlatform().parseXmlFromString(xml);
                doc._saxonBaseUri = E.staticBaseUri(expr, context);
                return Iter.Singleton(doc);
            } catch (e) {
                throw  new XError("Misplaced or malformed XML:", "FODC0006");
            }
        },
        "parse-xml-fragment": function (args, context, expr) {
            return args[0].mapOneToOne(function (s) {
                var textDecl = /^<\?xml(?:\s+version\s*=\s*(['"])1.[0-9]+['"])?\s+encoding\s*=\s*(['"][A-Za-z](?:[A-Za-z0-9._\-])*)['"]\s*\?>/;
                var content = s.toString().replace(textDecl, "");
                //print("content: " + content);
                // TextDecl	   ::=   	'<?xml' VersionInfo? EncodingDecl S? '?>'
                // VersionInfo ::= S 'version' S? '=' S? ("'" VersionNum "'" | '"' VersionNum '"')
                // VersionNum :: = '1.' [0-9]+
                // EncodingDecl	   ::=   	S 'encoding' Eq ('"' EncName '"' | "'" EncName "'" )
                // EncName	   ::=   	[A-Za-z] ([A-Za-z0-9._] | '-')*
                var tree = SaxonJS.getPlatform().parseXmlFromString("<z>" + content + "</z>");
                var result = context.resultDocument.createDocumentFragment();
                Axis.child(tree.documentElement).forEachItem(function (child) {
                    result.appendChild(child);
                });
                result._saxonBaseUri = E.staticBaseUri(expr, context);
                return result;
            });
        },
        "path": function (args) {
            return args[0].mapOneToOne(function (n) {
                var path = "";
                Axis.ancestorOrSelf(n).forEachItem(function (a) {
                    var sameKindSibs = function (a) {
                        return Axis.precedingSibling(a).filter(function (p) {
                            return a.nodeType == p.nodeType;
                        });
                    };
                    var sameKindPosn = function (n) {
                        return 1 + sameKindSibs(n).count();
                    };
                    var name;
                    switch (a.nodeType) {
                        case DU.DOCUMENT_NODE:
                        case DU.DOCUMENT_FRAGMENT_NODE:
                            break;
                        default:
                            break;
                        case DU.ELEMENT_NODE:
                            name = DU.nameOfNode(a);
                            path = "/" + name.toEQName() + "[" + (1 + sameKindSibs(a).filter(function (p) {
                                    return DU.nameOfNode(p).equals(name);
                                }).count()) + "]" + path;
                            break;
                        case DU.TEXT_NODE:
                            path = "/text()[" + sameKindPosn(a) + "]";
                            break;
                        case DU.COMMENT_NODE:
                            path = "/comment()[" + sameKindPosn(a) + "]";
                            break;
                        case DU.PROCESSING_INSTRUCTION_NODE:
                            path = "/processing-instruction(" + a.target + ")[" + (1 + sameKindSibs(a).filter(function (p) {
                                    return a.target == p.target;
                                }).count()) + "]";
                            break;
                        case DU.ATTRIBUTE_NODE:
                            path = "/@" + (a.name.indexOf(":") < 0 ? a.name : DU.nameOfNode(a).toEQName());
                            break;
                        case DU.NAMESPACE_NODE:
                            path = "/namespace::" + (a.prefix !== "" ? a.prefix : '*[Q{http://www.w3.org/2005/xpath-functions}local-name()=""]');
                    }
                });
                if (path === "") {
                    path = "/";
                }
                return Atomic.string.fromString(path);
            });
        },
        "prefix-from-QName": function (args) {
            return args[0].mapOneToOne(function (item) {
                if (item.prefix === "") {
                    return null;
                }
                return Atomic.string.fromString(item.prefix);
            });
        },
        position: function (args, context) {
            //print("position() = " + context.focus.position);
            if (!context.focus.current) {
                throw new XError("No context item for position()", "XPDY0002");
            }
            return Iter.oneInteger(context.focus.position);
        },
        QName: function (args) {
            var lexical = args[1].next().value.split(":");
            var prefix = lexical.length == 2 ? lexical[0] : "";
            var uri = stringZeroLengthIfAbsent(args[0]);
            if (prefix !== "" && uri === "") {
                throw new XError("Prefix but no URI for QName()", "FOCA0002");
            } else if (lexical.length == 2 && prefix === "") {
                throw new XError("$paramQName not valid for QName()", "FOCA0002");
            }
            var local = lexical.length == 2 ? lexical[1] : lexical[0];
            return Iter.Singleton(Atomic.QName.fromParts(prefix, uri, local));
        },
        "regex-group": function (args, context) {
            var gp = args[0].next().toNumber();
            try {
                return Iter.oneString(context.focus.regexGroups[gp] || "");
            }
            catch (e) {
                return Iter.oneString("");
            }
        },
        remove: function (args) {
            var drop = args[1].next().toNumber();
            var tracker = Iter.Tracker(args[0]);
            return tracker.filter(function (item) {
                return tracker.position != drop;
            });
        },
        replace: function (args) {
            var input = stringZeroLengthIfAbsent(args[0]);
            var flags = args[3] ? args[3].next().toString() : "";
            if (!flags.match(/^[smijxq]*$/)) {
                throw new XError("Illegal flags for regular expression: " + flags, "FORX0001");
            }
            var regex = Regex.prepareRegex(args[1].next().toString(), flags + "g");
            if (regex.test("")) {
                throw new XError("Regular expression matches zero-length string", "FORX0003");
            }
            var replacement = Regex.convertReplacement(args[2].next().toString(), flags);
            //print("replacement " + replacement);
            return Iter.oneString(input.replace(regex, replacement));
        },
        "resolve-QName": function (args) {
            var elem = args[1].next();
            return args[0].mapOneToOne(function (lex) {
                try {
                    return DU.resolveLexicalQName(elem, lex.toString(), true);
                }
                catch (e) {
                    if (e instanceof XError && e.code == "FORG0001") {
                        e.code = Regex.isQName(lex) ? "FONS0004" : "FOCA0002";
                    }
                    throw e;
                }
            });
        },
        "resolve-uri": function (args, context, expr) {
            var base = args[1] ? args[1].next().toString() : E.staticBaseUri(expr, context);
            var relative = args[0].next();
            if (relative === null) {
                return Iter.Empty;
            }
            //print("resolve-uri " + relative + " against " + base);
            base = base.replace(/^file:\/(?!\/)/, "file:///");
            // pragmatism rules: replace "file:/" by "file:///"

            if (!DomUtils.isAbsoluteURI(relative.toString()) && !DomUtils.isAbsoluteURI(base)) {
                throw new XError("resolve-uri: invalid URI (base=" + base + ", relative=" + relative.toString() + ")", "FORG0002");
            }
            if (!SaxonJS.getPlatform().inBrowser && /#/.test(base)) {
                // Without SaxonJS.getPlatform().inBrowser check, have problems reloading pages from viewer_app - which contain #!
                throw new XError("Base URI " + base + " contains a fragment identifier", "FORG0002");
            }
            var abs;
            try {
                abs = SaxonJS.getPlatform().resolveUri(relative.toString(), base).toString();
            }
            catch (e) {
                throw e;
            }
            //print("resolve-uri result " + abs);
            return Iter.Singleton(Atomic.anyURI.fromString(abs));
        },
        reverse: function (args) {
            return Iter.ForArray(args[0].expand().reverse());
        },
        root: function (args) {
            return args[0].mapOneToMany(function (node) {
                return Axis.ancestorOrSelf(node);
            }).filter(function (node) {
                return DU.xdmParentNode(node) === null;
            });
        },
        round: function (args) {
            return args[0].mapOneToOne(function (x) {
                return x.round(args[1] ? args[1].next().value : 0);
            });
        },
        "round-half-to-even": function (args) {
            return args[0].mapOneToOne(function (x) {
                return x.roundHalfToEven(args[1] ? args[1].next().value : 0);
            });
        },
        "seconds-from-dateTime": function (args) {
            return dateComponent(args, "seconds");
        },
        "seconds-from-duration": function (args) {
            return durationComponent(args, 5);
        },
        "seconds-from-time": function (args) {
            return dateComponent(args, "seconds");
        },
        serialize: function (args) {
           // return Iter.oneString(E.serialize(args[0], args[1] ? args[1].next() : undefined));
            return Iter.oneString(E.serialize(args[0], args[1] ? args[1] : undefined));
        },
        "starts-with": function (args, context, expr) {
            var str = stringZeroLengthIfAbsent(args[0]);
            var substr = stringZeroLengthIfAbsent(args[1]);
            var result = Compare.getCollation(expr, args[2]).startsWith(str, substr);
            return Iter.oneBoolean(result);
        },
        "static-base-uri": function (args, context, expr) {
            return Iter.oneString(E.staticBaseUri(expr, context));
        },
        "stream-available": function () {
            return Iter.oneBoolean(false);
        },
        string: function (args) {
            var item = args[0].next();
            if (!item) {
                return Iter.oneString("");
            }
            if (E.isArray(item) || E.isMap(item)) {
                throw new XError("Input to string() is a function item ", "FOTY0014");
            }
            return E.atomize(item).mapOneToOne(function (item) {
                return Atomic.string.cast(item);
            });
        },
        "string-join": function (args) {
            var result = "";
            var sep = args[1] ? args[1].next().value : "";
            // 1-arg version only in XPath 3.0
            var item;
            var isFirst = true;
            while ((item = args[0].next()) !== null) {
                if (!isFirst) {
                    result += sep;
                }
                result += item.toString();
                isFirst = false;
            }
            return Iter.oneString(result);
        },
        "string-length": function (args) {
            return Iter.oneInteger(toCodepoints(args[0]).length);
        },
        "string-to-codepoints": function (args) {
            return Iter.ForArray(toCodepoints(args[0]).map(Atomic.integer.fromNumber));
        },
        subsequence: function (args) {
            return Iter.ForArray(subSequence(args[0].expand(), args[1], args[2]));
        },
        substring: function (args) {
            var cp = toCodepoints(args[0]);
            return Iter.oneString(E.codepointsToString(subSequence(cp, args[1], args[2])));
        },
        "substring-after": function (args, context, expr) {
            var result = "";
            var str = stringZeroLengthIfAbsent(args[0]);
            var substr = stringZeroLengthIfAbsent(args[1]);
            var collationObj = Compare.getCollation(expr, args[2]);
            var index;
            if ((index = collationObj.indexOf(str, substr)) != -1) {
                result = str.substring(index + substr.length);
            }
            return Iter.oneString(result);
        },
        "substring-before": function (args, context, expr) {
            var result = "";
            var str = stringZeroLengthIfAbsent(args[0]);
            var substr = stringZeroLengthIfAbsent(args[1]);
            var collationObj = Compare.getCollation(expr, args[2]);
            var index;
            if ((index = collationObj.indexOf(str, substr)) != -1) {
                result = str.substring(0, index);
            }
            return Iter.oneString(result);
        },
        sum: function (args) {
            var seq = args[0].mapOneToOne(E.untypedToDouble);
            var first = seq.next();
            if (first === null) {
                return args.length == 1 ? Iter.oneInteger(0) : args[1];
            }
            // In case there is only one argument, check that it is amenable to arithmetic
            Calculate["a+a"](first, first);
            return Iter.Singleton(fold(seq, first, Calculate["a+a"]));
        },
        "system-property": function (args, context, expr) {
            var qname = Atomic.QName.fromEQName(dynamicEQName(args[0], expr, "XTDE1390"));
            var result;
            if (qname.uri == "http://www.w3.org/1999/XSL/Transform") {
                result = {
                    version: "3.0",
                    vendor: "Saxonica",
                    "vendor-url": "http://www.saxonica.com/",
                    "product-name": "Saxon-JS",
                    "product-version": "9.8",
                    "is-schema-aware": "no",
                    "supports-serialization": "no",
                    "supports-backwards-compatibility": "yes",
                    "supports-namespace-axis": "yes",
                    "supports-streaming": "no",
                    "supports-dynamic-evaluation": "no",
                    "supports-higher-order-functions": "no",
                    "xpath-version": "3.1",
                    "xsd-version": "1.1"
                }[qname.local];
            }
            return Iter.oneString(result || "");
        },
        tail: function (args) {
            var tracker = Iter.Tracker(args[0]);
            return tracker.filter(function () {
                return tracker.position != 1;
            });
        },
        "timezone-from-date": function (args) {
            return dateComponent(args, "timezone");
        },
        "timezone-from-dateTime": function (args) {
            return dateComponent(args, "timezone");
        },
        "timezone-from-time": function (args) {
            return dateComponent(args, "timezone");
        },
        tokenize: function (args) {
            var input = stringZeroLengthIfAbsent(args[0]);
            if (!args[1]) {
                input = Expr.wsCollapse(input);
            }
            if (input === "") {
                return Iter.Empty;
            }
            var regex = args[1] ? args[1].next().toString() : "[ \\n\\r\\t]+";
            var details = Expr.analyze(input, regex, args[2] ? args[2].next().toString() : "", false, true);
            var startsWithSeparator = args[1] && details[0].matching;
            var lastMatch = details[details.length - 1];
            var endsWithSeparator = args[1] && lastMatch.matching;
            var filtered = details.filter(function (value) {
                return !value.matching;
            });
            var strings = filtered.map(function (m) {
                return m.string;
            });
            //print("strings "+ strings);
            if (startsWithSeparator) {
                strings.unshift(Atomic.string.fromString(""));
            }
            if (endsWithSeparator) {
                strings.push(Atomic.string.fromString(""));
            }
            return Iter.ForArray(strings);
        },
        trace: function (args) {
            var value = args[0].expand();
            print((args[1] ? args[1].next().toString() + ": " : "") + showValue(value));
            return Iter.ForArray(value);
        },
        transform: function (args) {
            var options = args[0].next();
            var sheetN = Iter.oneString("stylesheet-node");
            var srcN = Iter.oneString("source-node");
            var n;
            var stylesheetNode = new Document();
            n = Iter.ForArray(options.get(sheetN.next())).peek().cloneNode(true);
            if (n instanceof XMLDocument) {
                n = n.documentElement;
            }
            stylesheetNode.appendChild(n);
            var sourceNode = new Document();
            n = Iter.ForArray(options.get(srcN.next())).peek().cloneNode(true);
            if (n instanceof XMLDocument) {
                n = n.documentElement;
            }
            sourceNode.appendChild(n);
            options.stylesheetLocation = "somewhere";
            var r = SaxonJS.internalTransform(stylesheetNode, sourceNode, options);
            // TODO unused var r
            return SaxonJS.U.Iter.Singleton(options.principalResult);
            // throw new XError("No XSLT processor available", "FOXT0001");
        },
        translate: function (args) {
            var inp = toCodepoints(args[0]);
            var s2 = toCodepoints(args[1]);
            var s3 = toCodepoints(args[2]);
            var resultCodes = [];
            inp.forEach(function (cp) {
                var index;
                if ((index = s2.indexOf(cp)) != -1) {
                    if (index < s3.length) {
                        resultCodes.push(s3[index]);
                    }
                } else {
                    resultCodes.push(cp);
                }
            });
            return Iter.oneString(E.codepointsToString(resultCodes));
        },
        "true": function () {
            return Iter.oneBoolean(true);
        },
        "type-available": function (args, context, expr) {
            var parts = dynamicEQName(args[0], expr, "XTDE1428").split("}");
            return (parts[0] == "Q{http://www.w3.org/2001/XMLSchema" && parts[1] in Atomic);
        },
        unordered: function (args) {
            return args[0];
        },
        "unparsed-entity-public-id": function () {
            // Not available from parser
            return Iter.Empty;
        },
        "unparsed-entity-uri": function () {
            // Not available from parser
            return Iter.Empty;
        },
        "unparsed-text": function (args, context, expr) {
            return Iter.oneString(fetchText(args, context, expr));
        },
        "unparsed-text-available": function (args, context, expr) {
            return resourceAvailable(function () {
                fetchText(args, context, expr);
            });
        },
        "unparsed-text-lines": function (args, context, expr) {
            var text = fetchText(args, context, expr);
            return Iter.ForArray(text.split(/\r?\n/)).mapOneToOne(
                function (item) {
                    return Atomic.string.fromString(item);
                });
        },
        "upper-case": function (args) {
            return Iter.oneString(stringZeroLengthIfAbsent(args[0]).toUpperCase());
        },
        "uri-collection": function () {
            return Iter.Empty;
        },
        "xml-to-json": function (args) {
            var options = args[1] ? args[1].next() : new HashTrie();
            return args[0].mapOneToOne(function (x) {
                return Atomic.string.fromString(ConvertJson.xmlToJson(x, options));
            });
        },
        "year-from-date": function (args) {
            return dateComponent(args, "getUTCFullYear");
        },
        "year-from-dateTime": function (args) {
            return dateComponent(args, "getUTCFullYear");
        },
        "years-from-duration": function (args) {
            return durationComponent(args, 0);
        },
        "zero-or-one": function (args) {
            var value = args[0].expand();
            if (value.length > 1) {
                throw new XError("Required length 0-1, actual length " + value.length, "FORG0003");
            }
            return Iter.Singleton(value[0] ? value[0] : null);
        }
    };


    // string value, or if empty sequence then the zero-length string
    function stringZeroLengthIfAbsent(iter) {
        var item = iter.next();
        return item ? item.value : "";
    }

    function toCodepoints(iter) {
        return E.stringToCodepoints(stringZeroLengthIfAbsent(iter));
    }

    /**
     * Subsequence
     * @param seq the input sequence as an array (of anything, not necessarily items)
     * @param start iterator whose next() call returns a numeric item
     * @param len optional iterator whose next() call returns a numeric item
     * @returns a subsequence of the original according to the rules of the substring() and subsequence() functions
     */
    function subSequence(seq, start, len) {
        var a = Math.round(start.next().toNumber());
        var end = len ? a + Math.round(len.next().toNumber()) : seq.length + 1;
        //print("subseq " + a + " to " + end);
        return seq.filter(function (mem, pos) {
            return pos + 1 >= a && pos + 1 < end;
        });
    }

    function fold(base, zero, fn) {
        var value = zero;
        base.forEachItem(function (item) {
            value = fn(item, value);
        });
        return value;
    }

    function minimax(name) {
        var op = name == "max" ? function (a) {
            return a > 0;
        } : function (a) {
            return a < 0;
        };

        function error(message) {
            throw new XError(message, "FORG0006");
        }

        return function (args, context, expr) {
            var iter = args[0];
            if (E.hasFlag(expr, "i")) {
                iter = iter.filter(function (item) {
                    return !Compare.itemIsNaN(item);
                });
            }
            // TODO collation
            var collationObj = Compare.getCollation(expr, args[1]);
            
            var isUA = Atomic.untypedAtomic.matches;
            var isNum = Atomic.numeric.matches;
            var isDbl = Atomic.double.matches;
            var isFlt = Atomic.float.matches;
            var isAnyURI = Atomic.anyURI.matches;
            var isStr = Atomic.string.matches;
            var isDur = Atomic.duration.matches;
            var isYMdur = Atomic.yearMonthDuration.matches;
            var isDTdur = Atomic.dayTimeDuration.matches;
            var isQName = Atomic.QName.matches;
            var toDbl = Atomic.double.cast;
            var toFlt = Atomic.float.cast;
            var toStr = Atomic.string.cast;
            // TODO - implement appropriate casting rules for mixed types.
            iter = iter.mapOneToOne(function (item) {
                return isUA(item) ? toDbl(item) : item;
            });
            var first = iter.next();
            if (first === null) {
                return Iter.Empty;
            }
            if (isQName(first)) {
                error(name + "() not defined over QName");
            }
            if (isDur(first) && !(isYMdur(first) || isDTdur(first))) {
                error(name + "() not defined over mixed duations");
            }
            var gac = Compare.allocateCodedComparer("GAC");
            return Iter.Singleton(fold(iter, first, function (item, value) {
                if ((isStr(item) && isNum(value)) || isStr(value) && isNum(item)) {
                    error("Cannot compare string with numeric");
                }
                if ((isYMdur(item) && !isYMdur(value)) || isDTdur(item) && !isDTdur(value)) {
                    error("Cannot compare mixed duations");
                }
                if (Compare.itemIsNaN(value)) {
                    return isDbl(item) ? toDbl(value) : value;
                }
                if (Compare.itemIsNaN(item)) {
                    return isDbl(value) ? toDbl(item) : item;
                }
                if (isDbl(value) && !isStr(item)) {
                    item = toDbl(item);
                } else if (isDbl(item) && !isStr(value)) {
                    value = toDbl(value);
                } else if (isFlt(value) && !isStr(item)) {
                    item = toFlt(item);
                } else if (isFlt(item) && !isStr(value)) {
                    value = toFlt(value);
                }

                if (isAnyURI(value) && isStr(item)) {
                    value = toStr(value);
                } else if (isAnyURI(item) && isStr(value)) {
                    item = toStr(item);
                }
                return op(gac.compare(item, value)) ? item : value;
            }));
        };
    }

    function dateComponent(args, name) {
        var input = args[0].next();
        if (input === null) {
            return Iter.Empty;
        }
        if (name == "timezone") {
            if (input.timezoneOffset === null) {
                return Iter.Empty;
            }
            return Iter.Singleton(Atomic.dayTimeDuration.fromNumberOfMinutes(input.timezoneOffset));
        } else if (name == "seconds") {
            var date = input.proxy();
            return Iter.oneDecimal(date.getUTCSeconds() + date.getUTCMilliseconds() / 1000);
        } else {
            var val = input.proxy()[name]();
            if (name == "getUTCMonth") {
                val++;
            }
            return Iter.oneInteger(val);
        }
    }

    function durationComponent(args, index) {
        var duration = args[0].next();
        if (duration === null) {
            return Iter.Empty;
        }
        if (index != 5) {
            return Iter.oneInteger(duration.parts()[index] * duration.signum());
        }
        return Iter.oneDecimal(duration.parts()[index] * duration.signum());
    }

    function adjustToTimezone(args, name, context) {
        //print("adjust-"+name+"-to-timezone");
        var arg = args[0].next();
        if (!arg) {
            return Iter.Empty;
        }
        var tzHere = context.fixed.currentDate.getTimezoneOffset();
        var requestedTZ;
        if (!args[1]) {
            //If $timezone is not specified, then the effective value of $timezone is the value of
            // the implicit timezone in the dynamic context.
            requestedTZ = -tzHere;
        } else {
            var tz = args[1].next();
            requestedTZ = tz !== null ? tz.milliseconds / 60000 : null;
            if (requestedTZ !== null && (requestedTZ < -14 * 60 || requestedTZ > 14 * 60)) {
                throw new XError("timezone out of bounds " + tz, "FODT0003");
            }
        }
        var timezoneOfArg = arg.timezoneOffset;
        if (timezoneOfArg === null && requestedTZ === null) {
            //If $arg does not have a timezone component and $timezone is the empty sequence, then the result is $arg
            return Iter.Singleton(arg);
        }
        function adjusted(date, tz) {
            return Iter.Singleton(Atomic[name].fromDate(date, tz));
        }

        if (timezoneOfArg === null && requestedTZ !== null) {
            //If $arg does not have a timezone component and $timezone is not the empty sequence,
            // then the result is $arg with $timezone as the timezone component.
            return adjusted(arg.adjustByMinutes(-tzHere - requestedTZ).UTCdate, requestedTZ);
        }
        if (timezoneOfArg !== null && requestedTZ === null) {
            //If $arg has a timezone component and $timezone is the empty sequence,
            // then the result is the localized value of $arg without its timezone component.
            return adjusted(arg.adjustByMinutes(tzHere + timezoneOfArg).UTCdate, null);
        }
        if (timezoneOfArg !== null && requestedTZ !== null) {
            //If $arg has a timezone component and $timezone is not the empty sequence,
            // then the result is the xs:dateTime value that is equal to $arg and that has a timezone component equal to $timezone.
            return adjusted(arg.UTCdate, requestedTZ);
        }
    }
}
();
var ExtraFn = function () {

    "use strict";

    var mathFunction = function (local, args, context, expr) {

        var empty = false;

        function test(v) {
            if (v === null) {
                empty = true;
                return Number.NaN;
            } else {
                return v.toNumber();
            }
        }

        function arg0() {
            return test(Expr.evalChild1(expr, context).next());
        }

        function arg1() {
            return test(Expr.evalChild2(expr, context).next());
        }

        function m() {
            switch (local) {
                case "pi":
                    return Math.PI;
                case "exp":
                    return Math.exp(arg0());
                case "exp10":
                    return Math.pow(10, arg0());
                case "log":
                    return Math.log(arg0());
                case "log10":
                    return Math.log(arg0()) / Math.LN10;
                case "pow":
                    var a0 = arg0(), a1 = arg1();
                    if ((a0 == -1 && (a1 == Infinity || a1 == -Infinity)) || a0 == 1) {
                        return 1.0;
                    }
                    return Math.pow(a0, a1);
                case "sqrt":
                    return Math.sqrt(arg0());
                case "sin":
                    return Math.sin(arg0());
                case "cos":
                    return Math.cos(arg0());
                case "tan":
                    return Math.tan(arg0());
                case "asin":
                    return Math.asin(arg0());
                case "acos":
                    return Math.acos(arg0());
                case "atan":
                    return Math.atan(arg0());
                case "atan2":
                    return Math.atan2(arg0(), arg1());
                default:
                    throw XError("Unknown math function " + expr.getAttribute("name"), "XPST0017", expr);
            }
        }

        var result = m();
        return empty ? Iter.Empty : Iter.oneDouble(result);
    };

    var mapFunction = function (local, args, context, expr) {
        var f = {
            // TODO: why do we have create, merge, and _new?
            contains: function (args) {
                var m = args[0].next();
                var k = args[1].next();
                return Iter.oneBoolean(m.containsKey(k));
            },
            create: function (args) {
                var m = new HashTrie();
                args[0].forEachItem(function (map) {
                    map.forAllPairs(function (pair) {
                        m.inSituPut(pair.k, pair.v);
                    });
                });
                return Iter.Singleton(m);
            },
            entry: function (args) {
                var m = new HashTrie();
                m.inSituPut(args[0].next(), args[1].expand());
                return Iter.Singleton(m);
            },
            find: function (args) {
                var result = [];
                var k = args[1].next();

                function findInItem(item) {
                    if (Expr.isArray(item)) {
                        item.value.forEach(findInSeq);
                    } else if (Expr.isMap(item)) {
                        if (item.containsKey(k)) {
                            result.push(item.get(k));
                        }
                        item.keys().forEach(function (key) {
                            findInSeq(item.get(key));
                        });
                    }
                }

                function findInSeq(seq) {
                    seq.forEach(findInItem);
                }

                findInSeq(args[0].expand());
                return Iter.Singleton(new Expr.XdmArray(result));
            },
            get: function (args) {
                var m = args[0].next();
                var k = args[1].next();
                return Iter.ForArray(m.get(k));
            },
            keys: function (args) {
                var m = args[0].next();
                return Iter.ForArray(m.keys());
            },
            merge: function (args) {
                var m = new HashTrie();
                var options = args[1] ? args[1].next() : null;
                args[0].forEachItem(function (map) {
                    map.forAllPairs(function (pair) {
                        var dupStr = Atomic.string.fromString("duplicates");
                        var dup = (options && options.containsKey(dupStr)) ? options.get(dupStr).toString() : "use-first";
                        if (!m.containsKey(pair.k) || dup == "use-last" || dup == "unspecified" || dup == "use-any") {
                            m.inSituPut(pair.k, pair.v);
                        } else if (dup == "reject") {
                            var dupErrorStr = Atomic.string.fromString("duplicates-error-code");
                            var dupError = options.containsKey(dupErrorStr) ? options.get(dupErrorStr).toString() : "FOJS0003";
                            throw XError("Duplicate key value '" + pair.k.toString() + "'", dupError, expr);
                        } else if (dup == "combine") {
                            var val = m.get(pair.k);
                            pair.v.forEach(function (x) {
                                val.push(x);
                            });
                            m.inSituPut(pair.k, val);
                        } else {
                            // dep == "use-first" do nothing
                        }
                    });
                });
                return Iter.Singleton(m);
            },
            _new: function (args) {
                // supports map constructors
                var m = new HashTrie();
                if (args[0]) {
                    args[0].forEachItem(function (map) {
                        map.forAllPairs(function (pair) {
                            if (m.containsKey(pair.k)) {
                                throw XError("Duplicate key value '" + pair.k.toString() + "'", "XQDY0137", expr);
                            }
                            m.inSituPut(pair.k, pair.v);
                        });
                    });
                }
                return Iter.Singleton(m);
            },
            put: function (args) {
                var m = args[0].next();
                var k = args[1].next();
                var v = args[2].expand();
                return Iter.Singleton(m.put(k, v));
            },
            remove: function (args) {
                var m = args[0].next();
                args[1].forEachItem(function (k) {
                    m = m.remove(k);
                });
                return Iter.Singleton(m);
            },
            size: function (args) {
                var m = args[0].next();
                var result = 0;
                m.forAllPairs(function () {
                    result++;
                });
                return Iter.oneInteger(result);
            },
            "untyped-contains": function (args) {
                var m = args[0].next();
                var k = args[1].next();
                return Iter.oneBoolean(m.containsKey(k));
            }
        };
        if (!f[local]) {
            throw XError("Unknown map function: " + local, "SXJS0003", expr);
        }
        return f[local](args, context, expr);
    };

    var arrayFunction = function (local, args, context, expr) {

        function aioob(index, max) {
            if (index < 1 || index > max) {
                throw XError("Array index (" + index + ") out of bounds (1 to " + max + ")", "FOAY0001", expr);
            }
        }

        /**
         * Return the value of the first argument, which is assumed to be an iterator delivering a single XDM array.
         * It is returned as a JS array, whose members are JS arrays, each representing one member of the XDM array;
         * the members are in general sequences of items.
         * @param args the arguments to a function, the first argument being an array
         * @returns a JS representation of the array
         */

        function inputArray(args) {
            return args[0].next().value;
        }

        function index(args) {
            return args[1].next().toNumber();
        }

        function oneArray(aray) {
            return Iter.Singleton(new Expr.XdmArray(aray));
        }

        var f = {
            append: function (args) {
                return oneArray(inputArray(args).concat([args[1].expand()]));
            },
            flatten: function (args) {
                return Expr.flatten(args[0]);
            },
            "_from-sequence": function (args) {
                var aa = [];
                args[0].forEachItem(function (item) {
                    aa.push([item]);
                });
                return oneArray(aa);
            },
            get: function (args) {
                var a = inputArray(args);
                var i = index(args);
                aioob(i, a.length);
                //print("array.get(" + showValue(a) + "," + i + ")");
                return Iter.ForArray(a[i - 1]);
            },
            head: function (args) {
                var a = inputArray(args);
                aioob(1, a.length);
                return Iter.ForArray(a[0]);
            },
            "insert-before": function (args) {
                var a = inputArray(args);
                var i = index(args);
                aioob(i, a.length + 1);
                var n = args[2].expand();
                return oneArray(a.slice(0, i - 1).concat([n]).concat(a.slice(i - 1)));
            },
            join: function (args) {
                var result = [];
                args[0].forEachItem(function (a) {
                    // a is an XdmArray
                    a.value.forEach(function (mem) {
                        result.push(mem);
                    });
                });
                return oneArray(result);
            },
            "put": function (args) {
                var a = inputArray(args);
                var i = index(args);
                aioob(i, a.length);
                var n = args[2].expand();
                return oneArray(a.slice(0, i - 1).concat([n]).concat(a.slice(i)));
            },
            remove: function (args) {
                var a = inputArray(args);
                var positions = [];
                args[1].forEachItem(function (i) {
                    var p = i.toNumber();
                    aioob(p, a.length);
                    positions.push(p - 1);
                });
                return oneArray(a.filter(function (m, pos) {
                    return positions.indexOf(pos) < 0;
                }));
            },
            reverse: function (args) {
                return oneArray(inputArray(args).slice().reverse());
            },
            size: function (args) {
                return Iter.oneInteger(inputArray(args).length);
            },
            sort: function (args) {
                var collationObj = Compare.getCollation(expr, args[1]);
                function cmp(a, b) {
                    //print("compare " + showValue(a) + " to " + showValue(b));
                    var ato = function (ay) {
                        return Iter.ForArray(ay).mapOneToMany(Expr.atomize);
                    };
                    if (args[1]) {
                        return Compare.lexicographicCompare(ato(a), ato(b), collationObj);
                    } else {
                        return Compare.lexicographicCompare(ato(a), ato(b));
                    }
                }
                return oneArray(inputArray(args).slice().sort(cmp));
            },
            subarray: function (args) {
                var a = inputArray(args);
                var start = index(args);
                aioob(start, a.length + 1);
                var len = args[2] ? args[2].next().toNumber() : a.length - start + 1;
                XError.test(len < 0, "Length is negative", "FOAY0002");
                aioob(start + len, a.length + 1);
                return oneArray(a.slice(start - 1, start + len - 1));
            },
            tail: function (args) {
                var a = inputArray(args);
                aioob(1, a.length);
                return oneArray(a.slice(1));
            },
            "_to-sequence": function (args) {
                var seq = [];
                inputArray(args).forEach(function (mem) {
                    mem.forEach(function (it) {
                        seq.push(it);
                    });
                });
                return Iter.ForArray(seq);
            }
        };
        if (!f[local]) {
            throw XError("Unknown array function: " + local, "SXJS0003", expr);
        }
        return f[local](args, context, expr);
    };

    var interactiveFunction = function (local, args, context, expr) {
        /**
         * Get a property from a given target and a property name sequence.
         * @param target the target JS object
         * @param props sequence of strings of property names
         * @returns the value (JS object) of the property, or undefined if some property value in the path is undefined
         */
        function getProp(target, props) {
            // target should already be unwrapped
            var v = target;
            for (var count = 0; count < props.length; count++) {
                try {
                    v = v[props[count]];
                }
                catch (e) {
                    if (e.code !== null) {
                        throw e;
                    }
                    throw XError("Failed to get property " + props[count], "SXJS0007", expr);
                }
                if (typeof v == "undefined") { //  || v === ""
                    return undefined;
                }
            }
            return v;
        }

        /**
         * Apply a JavaScript function.
         * @param z the JavaScript function object
         * @param convertedArgs the arguments to the function as a JS array of JS objects
         * @param target the target JS object on which the function is defined (or null if irrelevant)
         * @returns the result of applying the function (iterator containing result converted from JS)
         */
        function applyFn(z, convertedArgs, target) {
            /*if (z.length != convertedArgs.length) {
                // Note: This check is no good when args are optional, e.g. window.prompt() can have 0, 1, or 2 args
                throw XError("ixsl:call: wrong number of args supplied for function " + z.name);
            }*/
            var res;
            try {
                res = z.apply(target, convertedArgs);
            }
            catch (e) {
                if (e.code !== null) {
                    throw e;
                }
                throw XError("Failed to call method " + z, "SXJS0007", expr);
            }
            if (res === null || typeof res == "undefined") {
                //print("ixsl:call returns empty " + z);
                return Iter.Empty;
            } else {
                var out = Expr.convertFromJS(res);
                if (Array.isArray(out)) {
                    return Iter.ForArray(out);
                } else {
                    return Iter.Singleton(out);
                }
            }
        }

        // Unwrap JSValues e.g. window, function objects (alternatively Expr.convertToJS does same unwrapping)
        function unwrap(x) {
            return x instanceof Expr.JSValue ? x.value : x;
        }

        var f = {
            // extension functions

            apply: function (args) {
                var z = unwrap(args[0].next());
                if (typeof z != "function") {
                    throw XError("ixsl:apply: first argument is not a function", "SXJS0007", expr);
                }
                var convertedArgs = Expr.convertToJS(args[1].next());
                return applyFn(z, convertedArgs, null);
            },
            call: function (args) {
                var x = unwrap(args[0].next());
                var y = args[1].next().toString();
                var props = y.split('.');
                var z = getProp(x, props);
                if (typeof z == "undefined") {
                    throw XError("ixsl:call: object method '" + y + "' not found", "SXJS0007", expr);
                }
                if (typeof z != "function") {
                    throw XError("ixsl:call: property '" + y + "' is not a function", "SXJS0007", expr);
                }
                //print("ixsl:call: " + z);
                var convertedArgs = Expr.convertToJS(args[2].next());
                return applyFn(z, convertedArgs, x);
            },
            eval: function (args) {
                var str = args[0].next().toString();
                /*jslint evil: true */
                var fn = new Function('return ' + str);
                return Iter.Singleton(Expr.convertFromJS(fn()));
            },
            event: function (args, context) {
                //print("context.currentEvent, target: " + context.currentEvent + ", " + context.currentEvent.target);
                return Iter.Singleton(Expr.convertFromJS(context.currentEvent)); // wrap Event object
            },
            get: function (args) {
                var x = unwrap(args[0].next());
                var y = args[1].next().toString();
                var props = y.split('.');
                var z = getProp(x, props);
                if (typeof z == "undefined") {
                    print("Warning ixsl:get: object property '" + y + "' not found");
                    return Iter.Empty;
                    //Now returns an empty sequence for undefined (previously zero-length string)
                }
                return Iter.Singleton(Expr.convertFromJS(z));
            },
            location: function () {
                return Iter.Singleton(Expr.convertFromJS(window.location.toString()));
            },
            page: function () {
                return Iter.Singleton(Expr.convertFromJS(window.document));
            },
            // Get the parameters of a URL, i.e. from the query string, which begins with '?', at the end of the URL.
            // The params are returned in a map (HashTrie).
            "query-params": function () {
                var match,
                    pl = /\+/g, // Regex for replacing addition symbol with a space
                    search = /([^&=]+)=?([^&]*)/g,
                    decode = function (s) {
                        return Atomic.string.fromString(decodeURIComponent(s.replace(pl, " ")));
                    },
                    query = window.location.search.substring(1),
                    params = new HashTrie();
                while ((match = search.exec(query)) !== null) {
                    // produce a sequence for multiple values
                    var arr = params.get(decode(match[1]));
                    arr.push(decode(match[2]));
                    params.inSituPut(decode(match[1]), arr);
                }
                return Iter.Singleton(params);
            },
            source: function (args, context) {
                return Iter.Singleton(Expr.convertFromJS(context.fixed.globalContextItem));
            },
            style: function (args) {
                var x = args[0].next();
                var style = window.getComputedStyle(x);
                return Iter.Singleton(Expr.convertFromJS(style));
            },
            window: function () {
                return Iter.Singleton(Expr.convertFromJS(window));
            },

            // extension instructions

            "remove-attribute": function (args, context, expr) {
                var name = args[0].next().toString();
                var qn = Atomic.QName.fromString(name, Expr.stylesheetResolver(expr, false));
                if (!context.focus.current) {
                    throw XError("No context item for ixsl:remove-attribute", "SXJS0007", expr);
                }
                var elem = context.focus.current;
                //print("remove-attribute name, elem: "+ name + ", " + elem);
                if (elem.ownerDocument != window.document) {
                    throw XError("Context item for ixsl:remove-attribute must be an element in the HTML page", "SXJS0007", expr);
                }
                elem.removeAttribute(qn.local);
                return Iter.Empty;
            },
            "schedule-action": function () {
                throw XError("ixsl:schedule-action - shouldn't be here", "SXJS0007", expr);
            },
            "set-attribute": function (args, context, expr) {
                var lexi = args[0].next().toString();
                var value = args[1].next().toString();
                var qn = Atomic.QName.fromString(lexi, Expr.stylesheetResolver(expr, false));
                if (qn === null) {
                    throw XError("Invalid attribute name " + lexi, "XTDE1260");
                }
                if (!context.focus.current) {
                    throw XError("No context item for ixsl:set-attribute", "SXJS0007", expr);
                }
                var elem = context.focus.current;
                //print("set-attribute qn, value, elem: "+ qn + ", " + value + ", " + elem);
                if (elem.ownerDocument != window.document) {
                    throw XError("Context item for ixsl:set-attribute must be an element in the HTML page", "SXJS0007", expr);
                }
                elem.setAttribute(qn.local, value);
                return Iter.Empty;
            },
            "set-property": function (args, context, expr) {
                var name = args[0].next().toString();
                var value = Expr.convertToJS(args[1].next());
                var object = unwrap(args[2].next());
                //print("set-property name, value, object: " + name + ", " + value + ", " + object);
                var props = name.split('.');
                var last = props.pop();
                var z = getProp(object, props);
                if (typeof z == "undefined" || z === "") {
                    print("Warning ixsl:set-property: '" + name + "' not found for supplied object");
                    return Iter.Empty;
                }
                z[last] = value;
                return Iter.Empty;
            },
            "set-style": function (args, context, expr) {
                var name = args[0].next().toString();
                var value = Expr.convertToJS(args[1].next());
                var elem = args[2] ? args[2].next() : context.focus.current;
                if (!elem) {
                    throw XError("No context item for ixsl:set-style", "SXJS0007", expr);
                }
                //print("set-style name, value, elem: " + name + ", " + value + ", " + elem);
                elem.style[name] = value;
                return Iter.Empty;
            }
        };
        if (!f[local]) {
            throw XError("Unknown ixsl function: " + local, "SXJS0003", expr);
        }
        return f[local](args, context, expr);
    };

    var saxonFunction = function (local, args, context, expr) {
        var f = {
            apply: CoreFn.apply,
            "compile-XPath": function (args) {
                var xpath = args[0].next().toString();
                var opts, params;
                if (args.length > 1) {
                    opts = args[1];
                }
                if (args.length > 2) {
                    params = args[2];
                    // Leave it as an iterator
                }
                var z = SaxonJS.XPath.compile(xpath, opts, params,expr);
                return z;
            },
            "dynamic-error-info": function (args) {
                var err = context.currentError;
                if (err === null) {
                    //print("No current error");
                    return Iter.Empty;
                }
                var field = args[0].next().toString();
                switch (field) {
                    case "description":
                        return Iter.oneString(err.message);
                    case "code":
                        return Iter.Singleton(Atomic.QName.fromParts("err", "http://www.w3.org/2005/xqt-errors", err.code));
                    case "value":
                        return Iter.Empty; // TODO what should this return really?
                    case "module":
                        return Iter.oneString(err.xsltModule);
                    case "line-number":
                        return Iter.oneInteger(err.xsltLineNr);
                    case "column-number":
                        return Iter.oneInteger(-1);
                    default:
                        throw XError("unknown error info field " + field, "SXJS0003");
                }
            },
            "parse-XPath": function (args) {
                var xpath = args[0].next().toString();
                var opts = "parse";
                var params;
                if (args.length > 1) {
                    opts = args[1].next().toString();
                }
                if (args.length > 2) {
                    params = args[2];
                    // Leave it as an iterator
                }
                var z = SaxonJS.XPath.parse(xpath, opts, params);
                return z;
            }
        };
        if (!f[local]) {
            throw XError("Unknown saxon function: " + local, "SXJS0003", expr);
        }
        return f[local](args, context, expr);
    };


    return function (uri, local, args, context, expr) {
        switch (uri) {
            case "http://www.w3.org/2005/xpath-functions/math":
                return mathFunction(local, args, context, expr);
            case "http://www.w3.org/2005/xpath-functions/map":
                return mapFunction(local, args, context, expr);
            case "http://www.w3.org/2005/xpath-functions/array":
                return arrayFunction(local, args, context, expr);
            case "http://saxonica.com/ns/interactiveXSLT":
                return interactiveFunction(local, args, context, expr);
            case "http://saxon.sf.net/":
                return saxonFunction(local, args, context, expr);
            default:
                throw XError("Unknown namespace " + uri, "SXJS0003", expr);
        }
    };
}
();
var Calculate = function () {

    "use strict";

    function isSafeInteger(num) {
        return Math.abs(num) < Math.pow(2, 52);
        // leave a bit of margin
    }

    var DBL = Atomic.double,
        DEC = Atomic.decimal,
        INT = Atomic.integer,
        FLT = Atomic.float;

    function intOrDec(lhs, rhs) {
        return INT.matches(lhs) && INT.matches(rhs) ? INT : DEC;
    }

    function divByZeroErr(code) {
        // default error code is FOAR0001
        throw new XError("Division by zero", code ? code : "FOAR0001");
    }

    function arithOpErr(lhs, rhs, op) {
        throw new XError("Arithmetic operation '" + op +
            "' not available for operands " + lhs.type + " and " + rhs.type, "XPTY0004");
    }

    /**
     * Calculator object containing a mapping from calculator codes
     * to (JS) functions providing the implementation. The arguments to each binary
     * JS function are XDM type objects.
     * The function returns an atomic item
     */

    var calculator = {
        "d+d": function (lhs, rhs) {
            var a = lhs.toNumber(), b = rhs.toNumber();
            return DBL.fromNumber(a + b);
        },
        "d-d": function (lhs, rhs) {
            var a = lhs.toNumber(), b = rhs.toNumber();
            return DBL.fromNumber(a - b);
        },
        "d*d": function (lhs, rhs) {
            var a = lhs.toNumber(), b = rhs.toNumber();
            return DBL.fromNumber(a * b);
        },
        "d/d": function (lhs, rhs) {
            var a = lhs.toNumber(), b = rhs.toNumber();
            return DBL.fromNumber(a / b);
        },
        "d%d": function (lhs, rhs) {
            var a = lhs.toNumber(), b = rhs.toNumber();
            if (isNaN(a) || isNaN(b) || a == Infinity || a == -Infinity || b === 0) {
                return DBL.fromNumber(NaN);
            }
            if (b == Infinity || b == -Infinity || a === 0) {
                return lhs;
            }
            return DBL.fromNumber(a % b);
        },
        "d~d": function (lhs, rhs) {
            try {
                var a = lhs.toNumber(), b = rhs.toNumber();
                var x = DBL.fromNumber(Math.trunc(a / b));
                if (x == Infinity || x == -Infinity || isNaN(x)) {
                    divByZeroErr();
                }
                return isSafeInteger(x) ? INT.fromNumber(x) : x;
            }
            catch (e) {
                divByZeroErr();
            }
        },
        "f+f": function (lhs, rhs) {
            var a = lhs.toNumber(), b = rhs.toNumber();
            return FLT.fromNumber(a + b);
        },
        "f-f": function (lhs, rhs) {
            var a = lhs.toNumber(), b = rhs.toNumber();
            return FLT.fromNumber(a - b);
        },
        "f*f": function (lhs, rhs) {
            var a = lhs.toNumber(), b = rhs.toNumber();
            return FLT.fromNumber(a * b);
        },
        "f/f": function (lhs, rhs) {
            var a = lhs.toNumber(), b = rhs.toNumber();
            return FLT.fromNumber(a / b);
        },
        "f%f": function (lhs, rhs) {
            var a = lhs.toNumber(), b = rhs.toNumber();
            if (isNaN(a) || isNaN(b) || a == Infinity || a == -Infinity || b === 0) {
                return FLT.fromNumber(NaN);
            }
            if (b == Infinity || b == -Infinity || a === 0) {
                return lhs;
            }
            var x = FLT.fromNumber(a % b);
            if (x == Infinity || x == -Infinity || isNaN(x)) {
                divByZeroErr();
            }
            return x;
        },
        "f~f": function (lhs, rhs) {
            try {
                var a = lhs.toNumber(), b = rhs.toNumber();
                var x = FLT.fromNumber(Math.trunc(a / b));
                if (x == Infinity || x == -Infinity || isNaN(x)) {
                    divByZeroErr();
                }
                return isSafeInteger(x) ? INT.fromNumber(x) : x;
            }
            catch (e) {
                divByZeroErr();
            }
        },
        "i+i": function (lhs, rhs) {
            var x = lhs.toNumber() + rhs.toNumber();
            return isSafeInteger(x) ? INT.fromNumber(x) : INT.fromBig(Big(lhs.toBig().plus(rhs.toBig())));
        },
        "i-i": function (lhs, rhs) {
            var x = lhs.toNumber() - rhs.toNumber();
            return isSafeInteger(x) ? INT.fromNumber(x) : INT.fromBig(Big(lhs.toBig().minus(rhs.toBig())));
        },
        "i*i": function (lhs, rhs) {
            var x = lhs.toNumber() * rhs.toNumber();
            return isSafeInteger(x) ? INT.fromNumber(x) : INT.fromBig(Big(lhs.toBig().times(rhs.toBig())));
        },
        "i/i": function (lhs, rhs) {
            try {
                var a = lhs.toBig(), b = rhs.toBig();
                return DEC.fromBig(a.div(b));
            }
            catch (e) {
                divByZeroErr();
            }
        },
        "i%i": function (lhs, rhs) {
            var a = lhs.toNumber(), b = rhs.toNumber();
            if (isNaN(a) || isNaN(b) || a == Infinity || a == -Infinity || b === 0) {
                return INT.fromNumber(NaN);
            }
            if (b == Infinity || b == -Infinity || a === 0) {
                return lhs;
            }
            var x = lhs.toNumber() % rhs.toNumber();
            if (x == Infinity || x == -Infinity || isNaN(x)) {
                divByZeroErr();
            }
            return isSafeInteger(x) ? INT.fromNumber(x) : INT.fromBig(Big(lhs.toBig().mod(rhs.toBig())));
        },
        "i~i": function (lhs, rhs) {
            var x = lhs.toNumber() / rhs.toNumber();
            if (x == Infinity || x == -Infinity || isNaN(x)) {
                divByZeroErr();
            }
            return isSafeInteger(x) ? INT.fromNumber(Math.trunc(x)) : INT.fromBig(Big(lhs.toBig().div(rhs.toBig())).round(0, 0));
        },
        "c+c": function (lhs, rhs) {
            var a = lhs.toBig(), b = rhs.toBig();
            return intOrDec(lhs, rhs).fromBig(a.plus(b));
        },
        "c-c": function (lhs, rhs) {
            var a = lhs.toBig(), b = rhs.toBig();
            return intOrDec(lhs, rhs).fromBig(a.minus(b));
        },
        "c*c": function (lhs, rhs) {
            var a = lhs.toBig(), b = rhs.toBig();
            return intOrDec(lhs, rhs).fromBig(a.times(b));
        },
        "c/c": function (lhs, rhs) {
            try {
                var a = lhs.toBig(), b = rhs.toBig();
                return DEC.fromBig(a.div(b));
            }
            catch (e) {
                divByZeroErr();
            }
        },
        "c%c": function (lhs, rhs) {
            try {
                var a = lhs.toBig(), b = rhs.toBig();
                return DEC.fromBig(a.mod(b));
            }
            catch (e) {
                divByZeroErr();
            }
        },
        "c~c": function (lhs, rhs) {
            try {
                var a = lhs.toBig(), b = rhs.toBig();
                var x = a.div(b).round(0, 0);
                return isSafeInteger(x) ? INT.fromNumber(x) : DEC.fromBig(x);
            }
            catch (e) {
                divByZeroErr();
            }
        },
        "a+a": function (lhs, rhs) {
            return anyOpAny(lhs, rhs, "+");
        },
        "a-a": function (lhs, rhs) {
            return anyOpAny(lhs, rhs, "-");
        },
        "a*a": function (lhs, rhs) {
            return anyOpAny(lhs, rhs, "*");
        },
        "a/a": function (lhs, rhs) {
            return anyOpAny(lhs, rhs, "/");
        },
        "a%a": function (lhs, rhs) {
            return anyOpAny(lhs, rhs, "%");
        },
        "a~a": function (lhs, rhs) {
            return anyOpAny(lhs, rhs, "~");
        },
        "u+u": function (lhs, rhs) {
            var DTD = Atomic.dayTimeDuration, YMD = Atomic.yearMonthDuration;
            if (!((DTD.matches(lhs) && DTD.matches(rhs)) ||
                (YMD.matches(lhs) && YMD.matches(rhs)))) {
                arithOpErr(lhs, rhs, "+");
            }
            return YMD.matches(lhs) ? YMD.fromMonthsMilliseconds(lhs.months + rhs.months, 0) :
                DTD.fromMonthsMilliseconds(0, lhs.milliseconds + rhs.milliseconds);
        },
        "u-u": function (lhs, rhs) {
            var DTD = Atomic.dayTimeDuration, YMD = Atomic.yearMonthDuration;
            if (!((DTD.matches(lhs) && DTD.matches(rhs)) ||
                (YMD.matches(lhs) && YMD.matches(rhs)))) {
                arithOpErr(lhs, rhs, "-");
            }
            return YMD.matches(lhs) ? YMD.fromMonthsMilliseconds(lhs.months - rhs.months, 0) :
                DTD.fromMonthsMilliseconds(0, lhs.milliseconds - rhs.milliseconds);
        },
        "u*n": function (lhs, rhs) {
            var DTD = Atomic.dayTimeDuration, YMD = Atomic.yearMonthDuration;
            if (!(DTD.matches(lhs) || YMD.matches(lhs))) {
                arithOpErr(lhs, rhs, "*");
            }
            var x = rhs.toNumber();
            if (x == Infinity || x == -Infinity) {
                throw new XError("Cannot multiply duration by +/-INF", "FODT0002");
            }
            if (isNaN(x)) {
                throw new XError("Cannot multiply duration by NaN", "FOCA0005");
            }
            return YMD.matches(lhs) ? YMD.fromMonthsMilliseconds(Math.round(lhs.months * x), 0) :
                DTD.fromMonthsMilliseconds(0, Math.round(lhs.milliseconds * x));
        },
        "n*u": function (lhs, rhs) {
            return Calculate["u*n"](rhs, lhs);
        },
        "u/n": function (lhs, rhs) {
            var DTD = Atomic.dayTimeDuration, YMD = Atomic.yearMonthDuration;
            if (!(DTD.matches(lhs) || YMD.matches(lhs))) {
                arithOpErr(lhs, rhs, "/");
            }
            var x = YMD.matches(lhs) ? lhs.months / rhs.toNumber() : lhs.milliseconds / rhs.toNumber();
            if (x == Infinity || x == -Infinity || isNaN(x)) {
                divByZeroErr("FODT0002");
            }
            return YMD.matches(lhs) ? YMD.fromMonthsMilliseconds(Math.round(x), 0) :
                DTD.fromMonthsMilliseconds(0, Math.round(x));
        },
        "u/u": function (lhs, rhs) {
            var DTD = Atomic.dayTimeDuration, YMD = Atomic.yearMonthDuration;
            if (!((DTD.matches(lhs) && DTD.matches(rhs)) ||
                (YMD.matches(lhs) && YMD.matches(rhs)))) {
                arithOpErr(lhs, rhs, "/");
            }
            var a = new Big(YMD.matches(lhs) ? lhs.months : lhs.milliseconds);
            var b = new Big(YMD.matches(rhs) ? rhs.months : rhs.milliseconds);
            try {
                return DEC.fromBig(a.div(b));
            }
            catch (e) {
                divByZeroErr();
            }
        },
        "t+u": function (lhs, rhs) {
            var DTD = Atomic.dayTimeDuration, YMD = Atomic.yearMonthDuration;
            if (!(DTD.matches(rhs) || YMD.matches(rhs))) {
                arithOpErr(lhs, rhs, "+");
            }
            return DTD.matches(rhs) ? Atomic[lhs.type].fromDate(new Date(lhs.UTCdate.getTime() + rhs.milliseconds), lhs.timezoneOffset) :
                lhs.addMonths(rhs.months);
        },
        "u+t": function (lhs, rhs) {
            return Calculate["t+u"](rhs, lhs);
        },
        "t-u": function (lhs, rhs) {
            var DTD = Atomic.dayTimeDuration, YMD = Atomic.yearMonthDuration;
            if (!(DTD.matches(rhs) || YMD.matches(rhs))) {
                arithOpErr(lhs, rhs, "-");
            }
            return DTD.matches(rhs) ? Atomic[lhs.type].fromDate(new Date(lhs.UTCdate.getTime() - rhs.milliseconds), lhs.timezoneOffset) :
                lhs.addMonths(-rhs.months);
        },
        "t-t": function (lhs, rhs) {
            return Atomic.dayTimeDuration.fromMonthsMilliseconds(0, lhs.UTCdate.getTime() - rhs.UTCdate.getTime());
        }
    };

    function anyOpAny(lhs, rhs, op) {
        //print(showValue(lhs) + op + showValue(rhs));

        function isDateOrTime(value) {
            return Atomic.dateTime.matches(value) || Atomic.date.matches(value) || Atomic.time.matches(value);
        }

        var targetTypeL, targetTypeR;
        var calc;
        var DTD = Atomic.dayTimeDuration, YMD = Atomic.yearMonthDuration;

        if ((DTD.matches(lhs) || YMD.matches(lhs)) && Atomic.numeric.matches(rhs)) {
            calc = "u" + op + "n";
            targetTypeL = lhs.type;
            targetTypeR = rhs.type;
        } else if ((DTD.matches(rhs) || YMD.matches(rhs)) && Atomic.numeric.matches(lhs)) {
            calc = "n" + op + "u";
            targetTypeL = lhs.type;
            targetTypeR = rhs.type;
        } else if (INT.matches(lhs) && INT.matches(rhs)) {
            calc = "i" + op + "i";
            targetTypeL = targetTypeR = "integer";
        } else if (DBL.matches(lhs) || DBL.matches(rhs)) {
            calc = "d" + op + "d";
            targetTypeL = targetTypeR = "double";
        } else if (FLT.matches(lhs) || FLT.matches(rhs)) {
            calc = "f" + op + "f";
            targetTypeL = targetTypeR = "float";
        } else if (DEC.matches(lhs) || DEC.matches(rhs)) {
            calc = "c" + op + "c";
            targetTypeL = targetTypeR = "decimal";
        } else if (isDateOrTime(lhs) && isDateOrTime(rhs)) {
            calc = "t" + op + "t";
            targetTypeL = lhs.type;
            targetTypeR = rhs.type;
        } else if (isDateOrTime(lhs) && (DTD.matches(rhs) || YMD.matches(rhs))) {
            calc = "t" + op + "u";
            targetTypeL = lhs.type;
            targetTypeR = rhs.type;
        } else if ((DTD.matches(lhs) || YMD.matches(lhs)) && isDateOrTime(rhs)) {
            calc = "u" + op + "t";
            targetTypeL = lhs.type;
            targetTypeR = rhs.type;
        } else if ((DTD.matches(lhs) && DTD.matches(rhs)) ||
            (YMD.matches(lhs) && YMD.matches(rhs))) {
            calc = "u" + op + "u";
            targetTypeL = targetTypeR = lhs.type;
        } else {
            arithOpErr(op, lhs, rhs);
        }
        //print("Using " + calc);
        if (!calculator[calc]) {
            arithOpErr(op, lhs, rhs);
        }
        return calculator[calc](Expr.promote(lhs, targetTypeL), Expr.promote(rhs, targetTypeR));
    }

    return calculator;
}
();
var Numberer = (function () {

    "use strict";

    var E = Expr;
    var DU = DomUtils;


    /* Implements the node numbering parts of xsl:number, and returns an Iterator over the sequence of integers representing
     the node number. */

    function nodeNum(expr, context) {
        var level = expr.getAttribute("level");
        var selectExpr = E.argRole(expr, "select");
        var countPat = E.argRole(expr, "count");
        var fromPat = E.argRole(expr, "from");
        return nodeNumber(level, selectExpr, countPat, fromPat, context);
    }

    function nodeNumber(level, selectExpr, countPat, fromPat, context) {
        var origin;
        if (selectExpr) {
            origin = E.evaluate(selectExpr, context).next();
        } else {
            if (!context.focus.current) {
                throw XError("No context item in Numberer", "SXJS0004", selectExpr);
            }
            origin = context.focus.current;
        }
        var originName = DU.nameOfNode(origin);
        var matchRoot = function (node) {
            //print("testing matchRoot against " + showValue(node) + " returning " + (xdmParentNode(node) == null));
            return DU.xdmParentNode(node) === null;
        };
        var matchOrigin = function (node) {
            return node.nodeType == origin.nodeType && (originName === null ? true : DU.nameOfNode(node).equals(originName));
        };
        var matchesCount = matchOrigin;
        if (countPat !== null) {
            var pat = makePattern(countPat);
            matchesCount = function (node) {
                //print("Matches count? " + showValue(node) + " = " + pat(node, context));
                return pat(node, context);
            };
        }
        var matchesFrom;
        if (fromPat === null) {
            matchesFrom = matchRoot;
        } else {
            var fromPattern = makePattern(fromPat);
            matchesFrom = function (node) {
                return matchRoot(node) || fromPattern(node, context);
            };
        }
        var consider;
        var A, AF, F;
        switch (level) {
            case "simple":
                consider = Axis.precedingSibling(origin).filter(matchOrigin);
                return Iter.oneInteger(consider.count() + 1);
            case "single":
                A = Axis.ancestorOrSelf(origin).filter(matchesCount).next();
                F = Axis.ancestorOrSelf(origin).filter(matchesFrom).next();
                AF = A === null ? null : (Axis.ancestorOrSelf(A).filter(
                    function (node) {
                        return DU.isSameNode(node, F);
                    }).next() !== null ? A : null);
                //print("A = " + showValue(A));
                //print("F = " + showValue(F));
                if (AF === null) {
                    return Iter.Empty;
                } else {
                    //print("Found AF = " + showValue(AF));
                    consider = Axis.precedingSibling(AF).filter(matchesCount);
                    return Iter.oneInteger(consider.count() + 1);
                }
                break;
            case "multi":
                A = Iter.ForArray(Axis.ancestorOrSelf(origin).filter(matchesCount).expand().reverse());
                F = Axis.ancestorOrSelf(origin).filter(matchesFrom).next();
                AF = A.filter(function (item) {
                    var f = Axis.ancestorOrSelf(item).filter(
                        function (node) {
                            return DU.isSameNode(node, F);
                        });
                    return f.next() !== null;
                });
                var toInt = Atomic.integer.fromNumber;
                return AF.mapOneToOne(function (item, index) {
                    return toInt(Axis.precedingSibling(item).filter(matchesCount).count() + 1);
                });
            case "any":
                // Use UnionIterator to combine two sequences in reverse document order
                var reverseDocOrder = function (a, b) {
                    return DU.compareDocumentOrder(b, a);
                };
                A = Iter.Union(
                    Axis.preceding(origin).filter(matchesCount),
                    Axis.ancestorOrSelf(origin).filter(matchesCount),
                    reverseDocOrder);
                //A = Iter.trace("A", A);
                F = Iter.Union(
                    Axis.preceding(origin).filter(matchesFrom),
                    Axis.ancestorOrSelf(origin).filter(matchesFrom),
                    reverseDocOrder).next();
                if (F === null) {
                    Expr.internalError("from pattern selected empty");
                }
                AF = A.filter(function (node) {
                    return DU.compareDocumentOrder(node, F) >= 0;
                });
                //AF = Iter.trace("AF", AF);
                var n = AF.count();
                return n === 0 ? Iter.Empty : Iter.oneInteger(n);
            default:
                Expr.internalError("unknown xsl:number/@level " + level);
        }
    }


    /* Implements the number formatting parts of xsl:number, and returns an Iterator over the sequence of formatted numbers. */

    function numSeqFmt(expr, context) {
        var valueExp = E.argRole(expr, "value");
        var formatExpr = E.argRole(expr, "format");
        var groupSep = E.evaluateIfPresent(E.argRole(expr, "gpSep"), context).next();
        var groupSize = E.evaluateIfPresent(E.argRole(expr, "gpSize"), context).next();
        var ordinal = E.evaluateIfPresent(E.argRole(expr, "ordinal"), context).next();
        var lang = E.evaluateIfPresent(E.argRole(expr, "lang"), context).next();

        var flags = expr.getAttribute("flags") || "";
        var startExp = E.argRole(expr, "startAt");
        var backwards = /1/.test(flags);
        var val = E.evaluate(valueExp, context);
        var adjustedVal = evaluateValueExp(val, backwards, startExp, true, context);
        
        return adjustedVal === null ? Iter.oneString("NaN") : formatNumberSeq(adjustedVal, formatExpr, groupSep, groupSize, ordinal, lang, context);
    }

    function formatNumberSeq(adjustedVal, formatExpr, groupSep, groupSize, ordinal, lang, context) {

        function formatTokens(format) {
            var tokens;
            var isFormatToken;
            if (format === "") {
                format = "1";
            }
            if (/^[\x01-\x7f]*$/.test(format)) {
                // format is all-ascii
                tokens = format.split(/\b/);
                isFormatToken = function (str, i) {
                    return /\w+/.test(str);
                };
            } else if (format.length != E.stringToCodepoints(format).length) {
                throw XError("Cannot handle non-BMP characters in format-number picture", "SXJS0002");
            } else {
                var analysis = E.analyze(format, "[\\p{Nd}\\p{Nl}\\p{No}\\p{Lu}\\p{Ll}\\p{Lt}\\p{Lm}\\p{Lo}]+", "", true, false);
                isFormatToken = function (str, i) {
                    return analysis[i].matching;
                };
                tokens = analysis.map(function (entry) {
                    return entry.string.toString();
                });
                //analysis.forEach(function(entry) {
                //    print("entry: " + entry.matching + ":" + entry.string);
                //})
            }

            var result = {
                prefix: "", fTokens: [], suffix: ""
            };
            var i;
            var separator = ".";
            for (i = 0; i < tokens.length; i++) {
                var token = tokens[i];
                if (isFormatToken(token, i)) {
                    //print("isFormatToken " + token);
                    result.fTokens.push({
                        chars: token, sep: separator
                    });
                    separator = ".";
                } else {
                    //print("isNotFormatToken " + token);
                    if (i === 0) {
                        result.prefix = token;
                    }
                    if (i == tokens.length - 1) {
                        result.suffix = token;
                    } else if (i !== 0) {
                        separator = token;
                    }
                }
            }
            if (result.fTokens.length === 0) {
                result.fTokens.push({
                    chars: "1", sep: "."
                });
                result.suffix = result.prefix;
            }
            return result;
        }

        /* Formats a sequence, supplied as an Array of numbers. */
        function formatSequence(val) {
            //print("formatSequence: supplied " + val);
            var format = formatExpr === null ? "1" : E.evaluate(formatExpr, context).next().toString();
            var ft = formatTokens(format);
            var result = ft.prefix;
            val.forEach(function (num, pos) {
                var fTok = pos >= ft.fTokens.length ? ft.fTokens[ft.fTokens.length - 1] : ft.fTokens[pos];
                if (pos !== 0) {
                    result += fTok.sep;
                }
                var format = fTok.chars;
                if (ordinal == "yes") {
                    // TODO: other values of @ordinal
                    format += ";o";
                }
                var str = Numberer.formatInteger(num, format);
                if (groupSep !== null && groupSize !== null) {
                    str = Numberer.addGroupingSeparators(str, groupSep, groupSize);
                }
                result += str;
            });
            result += ft.suffix;
            return Iter.oneString(result);
        }

        if (lang !== null) {
            try {
                Atomic.language.cast(lang);
            }
            catch (e) {
                throw XError("@lang=" + lang + ": invalid language code", "XTDE0030");
            }
        }

        return formatSequence(adjustedVal.expand());
    }
    
    /* Returns null when val is NaN, so should then return Iter.oneString("NaN"); */
    
    function evaluateValueExp (val, backwards, startExp, valExp, context) {
        var startAt =[1];
        if (startExp !== null) {
            startAt = E.evaluate(startExp, context).next().toString().split(/\s+/).map(function (s) {
                return parseInt(s, 10);
            });
        }
        //print("val " + showValue(val));
        if (backwards && valExp) {
            // 1.0 compatibility
            var v = val.next();
            if (v === null) {
                return null;
            }
            try {
                v = Atomic.integer.cast(v.round(0));
            }
            catch (e) {
                return null;
            }
            val = Iter.ForArray([v]);
        }
        var mf = function (item, index) {
            //print("raw value " + item);
            if (Atomic.numeric.matches(item)) {
                item = item.toDouble();
            } else {
                item = Atomic.double.fromStringUnfailing(item.toString());
            }
            if (item.toNumber() < 0) {
                throw XError("xsl:number/@value is less than zero", "XTDE0980");
            }
            try {
                item = Atomic.integer.cast(item.round(0));
            }
            catch (e /*if e instanceof XError*/) {
                e.code = "XTDE0980";
                throw e;
            }
            //print("rounded value " + item);
            var inc = index >= startAt.length ? startAt[startAt.length - 1] : startAt[index];

            //print("Adjust " + index + " by " + inc);
            if (inc != 1) {
                item = Atomic.integer.fromNumber(item.toNumber() + (inc - 1));
            }
            return item;
        };
        return val.mapOneToOne(mf);
    }
    
    /* Implements the 9.7 SEF version of xsl:number. */

    function xslNumber(expr, context) {
        var valueExp = E.argRole(expr, "value");
        var formatExpr = E.argRole(expr, "format");
        var groupSep = E.evaluateIfPresent(E.argRole(expr, "gpSep"), context).next();
        var groupSize = E.evaluateIfPresent(E.argRole(expr, "gpSize"), context).next();
        var ordinal = E.evaluateIfPresent(E.argRole(expr, "ordinal"), context).next();
        var lang = E.evaluateIfPresent(E.argRole(expr, "lang"), context).next();
        var flags = expr.getAttribute("flags") || "";
        var backwards = /1/.test(flags);
        var startExp = E.argRole(expr, "startAt");

        var val, adjustedVal;
        if (!valueExp) {
            var level = expr.getAttribute("level");
            var selectExpr = E.argRole(expr, "select");
            var countPat = E.argRole(expr, "count");
            var fromPat = E.argRole(expr, "from");
            val = nodeNumber(level, selectExpr, countPat, fromPat, context);
            adjustedVal = evaluateValueExp(val, backwards, startExp, false, context);
        } else {
            val = E.evaluate(valueExp, context);
            adjustedVal = evaluateValueExp(val, backwards, startExp, true, context);
        }
        return adjustedVal === null ? Iter.oneString("NaN") : formatNumberSeq(adjustedVal, formatExpr, groupSep, groupSize, ordinal, lang, context);

        
    }

    function toRoman(num) {
        //print("toRoman " + num);
        if (num < 1 || num > 4999) {
            return num.toString();
        }

        var result = '';
        var ref = ['m', 'cm', 'd', 'cd', 'c', 'xc', 'l', 'xl', 'x', 'ix', 'v', 'iv', 'i'];
        var xis = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];

        var x;
        for (x = 0; x < ref.length; x++) {
            while (num >= xis[x]) {
                result += ref[x];
                //print("temp result " + result);
                num -= xis[x];
            }
        }
        return result;
    }

    function toAlpha(num, alphabet) {
        if (num < 1) {
            return num.toString();
        }
        var limit = alphabet.length;

        function a(num) {
            return (num > limit ? a(Math.floor((num - 1) / limit)) : "") + alphabet.charAt((num - 1) % limit);
        }

        return a(num);
    }

    function toSymbols(num, symbols) {
        //print("toSymbol " + num + " from " + symbols);
        return num < symbols.length ? symbols[num] : num.toString();
    }

    // Produces string representation of integer, of width at least that supplied as the minimum (i.e. possible padding with zeroes)
    function toDecimalWidth(num, width) {
        //print("toDecimal " + num + ", " + width);
        var abs = Math.abs(num);
        var str = abs < 999999 ? abs.toString() : Big(abs).toFixed();
        // avoid exponential notation
        while (str.length < width) {
            str = "0" + str;
        }
        if (num < 0) {
            str = "-" + str;
        }
        return str;
    }

    /**
     * Normalize mandatory-digit-signs in a format picture string to ASCII (i.e. always "0").
     * (Note that if the picture contains non-ASCII grouping separators, then these are not affected.)
     * @param format the original format picture string (which contains some non-ASCII characters)
     * @returns an object containing the properties:
     *      format - the format picture string in normalized form;
     *      diff - the codepoint difference between 48 (ASCII zero digit) and the zero digit of the digit range
     *          used in the original format picture string;
     *      isDecimalDigitPattern - a boolean, true if the format contains some digit i.e. in regex category Nd
     *          (if this is false, then the non-ASCII characters in the original format picture string must be
     *          grouping separators).
     */
    function normalizeDigits(format) {
        //print("Picture string contains non-ASCII characters: " + format);

        var E = Expr;
        var formatCodepoints = E.stringToCodepoints(format);
        var details = {};
        var isDecimalDigitPattern = true, diff = 0;
        var zeroDigit, i;

        var regexpNd = Regex.prepareRegex("\\p{Nd}", null);
        var mandDigitIndex = format.search(regexpNd);
        if (mandDigitIndex < 0) {
            isDecimalDigitPattern = false;
        } else {
            // Check each nonASCII char is a mandatory-digit-sign (in Nd), or grouping separator (not in categories N or L)
            var list = Regex.obtainCategoryEscapes().Nd;
            for (i = 0; i < list.length; i++) {
                var digitRange = list[i];
                zeroDigit = parseInt(digitRange[0], 16);
                if (zeroDigit <= formatCodepoints[mandDigitIndex] && formatCodepoints[mandDigitIndex] <= zeroDigit + 10) {
                    break;
                }
            }
            for (i = 0; i < formatCodepoints.length; i++) {
                if (formatCodepoints[i] >= 128) {
                    var iChar = String.fromCharCode(formatCodepoints[i]);
                    if (regexpNd.test(iChar)) {
                        // Check that digit iChar is in the same digit family
                        if (zeroDigit > formatCodepoints[i] || formatCodepoints[i] > zeroDigit + 10) {
                            throw XError("Picture string mixes digits from different digit families: " + format, "FODF1310");
                        }
                    } else {
                        // Check that iChar is not alphanumeric - i.e. it is a valid grouping-separator
                        var regexpNL = Regex.prepareRegex("\\p{N}\\p{L}", null);
                        if (regexpNL.test(iChar)) {
                            throw XError("Picture string is invalid: " + format, "FODF1310");
                        }
                    }
                }
            }
            // Normalize any digits in digitRange to digit 0, i.e. codepoint 48
            var normalizedFormat = [];
            diff = zeroDigit - 48;
            formatCodepoints.forEach(function (value) {
                if (zeroDigit <= value && value <= zeroDigit + 10) {
                    normalizedFormat.push(48);
                } else {
                    normalizedFormat.push(value);
                }
            });
            format = E.codepointsToString(normalizedFormat);
        }
        details.isDecimalDigitPattern = isDecimalDigitPattern;
        details.format = format;
        details.diff = diff;
        details.zeroDigit = zeroDigit;
        return details;
    }

    // For a string representation of a number, translate the digits to characters in the right (nonASCII) digit range.
    function translateDigits(numStr, diff) {
        var translated = [];
        Expr.stringToCodepoints(numStr).forEach(function (value) {
            if (48 <= value && value <= 57) {
                translated.push(value + diff);
            } else {
                translated.push(value);
            }
        });
        return Expr.codepointsToString(translated);
    }

    function addIrregularGroupingSeparators(numStr, sepPositions, groupSepArray, singleGroupSep, fromLeft) {
        // sepPositions are from the right
        // If we are adding from the left, then there is a singleGroupSep
        var p, j = 0;
        var result = numStr;
        for (p = 0; p < result.length; p++) {
            // format.length??
            if (p == sepPositions[j]) {
                //var ins = result.length - p;
                var ins = fromLeft ? p + 1 : result.length - p;
                if (ins > 0) {
                    result = result.substring(0, ins) +
                        (groupSepArray ? groupSepArray[fromLeft ? j : groupSepArray.length - j - 1] : singleGroupSep) + result.substring(ins);
                }
                j++;
            }
        }
        return result;
    }

    // Method toDecimal formats an integer using the provided format picture string (which may contain non-ASCII digits,
    // and/or grouping separators).
    // [NB. The name toDecimal may be misleading. The num input must be an integer (positive or negative).
    // Decimal refers to the decimal digits, rather than decimal number notation.]
    function toDecimal(num, format) {

        /* Method formatWithNormalizedPicture formats a number: the main purpose of the method is to add the
         grouping separators to the result.
         The format picture string should already have been normalized so that all mandatory-digit-signs used are
         in the range [0-9] (i.e. ASCII). At this point, the format is definitely a decimal digit pattern
         (i.e. contains at least one mandatory-digit-sign).
         Note that the format picture string may still contain non-ASCII characters to be used for grouping separators,
         but these just get processed in the same way as ASCII grouping separators.
         */
        function formatWithNormalizedPicture(num, format) {
            // Grouping separators (ASCII or non-ASCII) must match [^A-Za-z0-9]
            // Non-ASCII grouping separators have already been checked to be valid i.e. char whose Unicode category is other
            // than N or L.
            if (!/^(([0-9]|#|[^A-Za-z0-9])+?)$/.test(format)) {
                throw XError("The decimal digit pattern in the picture string is invalid: " + format, "FODF1310");
            }
            var format0 = format, groupSep, hasSameGS = true, i;

            // Normalize grouping separators in format0, collecting the originals in groupSep to be used later
            if (/[^0-9A-Za-z#]/.test(format0)) {
                groupSep = format0.match(/[^0-9A-Za-z#]/g);
                if (groupSep.length > 1) {
                    for (i = 1; i < groupSep.length; i++) {
                        if (groupSep[0] != groupSep[i]) {
                            hasSameGS = false;
                            break;
                        }
                    }
                }
                //print("hasSameGS " + hasSameGS);
                format0 = format0.replace(/[^0-9A-Za-z#]/g, ",");
            }
            if (/^,|,,|,$/.test(format0)) {
                throw XError("Grouping in picture string is invalid: " + format, "FODF1310");
            } else if (/[0-9].*#/.test(format0)) {
                throw XError("Picture string is invalid: " + format, "FODF1310");
            }
            var width = format0.replace(/[#,]/g, "").length;
            var result = toDecimalWidth(num, width);

            // Insert grouping separators
            if (groupSep) {
                var formatArrayR = Expr.stringToCodepoints(format0).reverse();
                var sepPositions = [];
                for (i = 0; i < formatArrayR.length; i++) {
                    if (formatArrayR[i] == 44) {
                        // 44 is the codepoint for ','
                        sepPositions.push(i);
                    }
                }
                //print("sepPositions " + sepPositions);
                var spacingIsRegular = true;
                if (formatArrayR.length - sepPositions[sepPositions.length - 1] - 1 > sepPositions[0]) {
                    spacingIsRegular = false; // e.g. catch 000,00,00
                }
                if (spacingIsRegular) {
                    for (i = 1; i < sepPositions.length; i++) {
                        if ((sepPositions[i] + 1) % (sepPositions[0] + 1) !== 0) {
                            spacingIsRegular = false;
                            break;
                        }
                    }
                }
                //print("spacingIsRegular " + spacingIsRegular);
                if (spacingIsRegular && hasSameGS) {
                    result = Numberer.addGroupingSeparators(result, groupSep[0], sepPositions[0]);
                } else {
                    result = addIrregularGroupingSeparators(result, sepPositions, groupSep);
                }
            }
            return result;
        }

        //print("toDecimal " + num + ", " + format);
        var formatCodepoints = Expr.stringToCodepoints(format);
        var allASCII = true, isDecimalDigitPattern = true, diff = 0;
        if (formatCodepoints.length != format.length) {
            throw XError("Cannot handle non-BMP characters in format-integer picture", "SXJS0002");
        } else if (!/^[\x01-\x7f]*$/.test(format)) {
            allASCII = false;
        }
        if (allASCII) {
            isDecimalDigitPattern = /[0-9]/.test(format);
        } else {
            var details = normalizeDigits(format);
            format = details.format;
            isDecimalDigitPattern = details.isDecimalDigitPattern;
            diff = details.diff;
        }

        // If format is NOT a decimal digit pattern - i.e. does not have at least one mandatory digit sign, then default to "1"
        if (!isDecimalDigitPattern) {
            //print("Not a recognised decimal digit pattern");
            format = "1";
        }
        var result = formatWithNormalizedPicture(num, format);

        if (!allASCII) {
            result = translateDigits(result, diff);
        }
        //print("result of toDecimal : " + result);
        return result;
    }

    // For the following 'words' and 'ordinals' methods, input num should be non-negative.

    function toEnglishWords(num) {
        var units = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
            "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
        var tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
        if (num < 20) {
            return units[num];
        } else if (num < 100) {
            return tens[Math.floor(num / 10)] + (num % 10 === 0 ? "" : (" " + units[num % 10]));
        } else if (num < 1000) {
            return toEnglishWords(Math.floor(num / 100)) + " Hundred" + (num % 100 === 0 ? "" : " and " + toEnglishWords(num % 100));
        } else if (num < 1000000) {
            return toEnglishWords(Math.floor(num / 1000)) + " Thousand" + (num % 1000 === 0 ? "" : (num % 1000 < 100 ? " and " : " ") + toEnglishWords(num % 1000));
        } else if (num < 1000000000) {
            return toEnglishWords(Math.floor(num / 1000000)) + " Million" + (num % 1000 === 0 ? "" : (num % 1000 < 100 ? " and " : " ") + toEnglishWords(num % 1000000));
        } else {
            return num.toString();
        }
    }

    function toEnglishOrdinalWords(num) {
        var units = ["Zeroth", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth",
            "Eleventh", "Twelfth", "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth", "Eighteenth", "Nineteenth"];
        var tens = ["", "", "Twent", "Thirt", "Fort", "Fift", "Sixt", "Sevent", "Eight", "Ninet"];
        if (num < 20) {
            return units[num];
        } else if (num < 100) {
            return tens[Math.floor(num / 10)] + (num % 10 === 0 ? "ieth" : ("y " + units[num % 10]));
        } else if (num < 1000) {
            return toEnglishWords(Math.floor(num / 100)) + " Hundred" + (num % 100 === 0 ? "th" : " and " + toEnglishOrdinalWords(num % 100));
        } else if (num < 1000000) {
            return toEnglishWords(Math.floor(num / 1000)) + " Thousand" + (num % 1000 === 0 ? "th" : (num % 1000 < 100 ? " and " : " ") + toEnglishOrdinalWords(num % 1000));
        } else if (num < 1000000000) {
            return toEnglishWords(Math.floor(num / 1000000)) + " Million" + (num % 1000 === 0 ? "th" : (num % 1000 < 100 ? " and " : " ") + toEnglishOrdinalWords(num % 1000000));
        } else {
            return num.toString();
        }
    }

    function toEnglishOrdinalSuffix(num) {
        if (num % 10 == 1 && num % 100 != 11) {
            return "st";
        } else if (num % 10 == 2 && num % 100 != 12) {
            return "nd";
        } else if (num % 10 == 3 && num % 100 != 13) {
            return "rd";
        } else {
            return "th";
        }
    }

    /* Entry method for formatting an integer, used by:
     *   Numberer.xslNumber (via formatSequence)
     *   CoreFn.functions["format-integer"]
     *   CoreFn.functions["generate-id"]
     *   Numberer.formatComponent (used by Numberer.formatDateTime, itself used by CoreFn.functions["format-dateTime"], etc.)
     *   */

    function formatInteger(num, format) {
        var semicolon, formatMod = null;
        if ((semicolon = format.lastIndexOf(";")) != -1) {
            formatMod = format.substring(semicolon + 1);
            if (!/^([co](\(.+\))?)?[at]?$/.test(formatMod)) {
                throw XError("Invalid format modifier in picture string: " + formatMod, "FODF1310");
            }
            // For English (the default), any parenthetical (between the parentheses) is ignored (e.g. o(-en));
            // format modifiers 'c', 'o' are recognised, while 'a', 't' are ignored
            formatMod = formatMod.charAt(0);
            format = format.substring(0, semicolon);
        }
        if (format === "") {
            throw XError("In the picture string, the picture cannot be empty", "FODF1310");
        }
        var sign = num < 0 ? "-" : "";
        if (formatMod == 'o') {
            // If formatMod = 'o' not supported for combination, return as if 'c'
            switch (format.toString()) {
                case 'a':
                case 'A':
                case 'i':
                case 'I':
                    break;
                case 'Ww':
                    return sign + toEnglishOrdinalWords(Math.abs(num));
                case 'W':
                    return sign + toEnglishOrdinalWords(Math.abs(num)).toUpperCase();
                case 'w':
                    return sign + toEnglishOrdinalWords(Math.abs(num)).toLowerCase();
                default:
                    return toDecimal(num, format) + toEnglishOrdinalSuffix(Math.abs(num));
            }
        }
        // If formatMod is other than 'o' (or 'o' not supported for combination & returning as if 'c')
        function alphabet(first, length) {
            var a = "";
            for (var i = first.charCodeAt(0), j = 0; j < length; i++, j++) {
                a += String.fromCharCode(i);
            }
            return a;
        }

        switch (format.toString()) {
            case 'a':
                return toAlpha(num, alphabet("a", 26));
            case 'A':
                return toAlpha(num, alphabet("A", 26));
            case "\u03b1": // lower-case Greek
                return toAlpha(num, alphabet("\u03b1", 25));
            case "\u0391": // upper-case Greek
                return toAlpha(num, alphabet("\u0391", 25));
            case 'i':
                return toRoman(num);
            case 'I':
                return toRoman(num).toUpperCase();
            case 'Ww':
                return sign + toEnglishWords(Math.abs(num));
            case 'W':
                return sign + toEnglishWords(Math.abs(num)).toUpperCase();
            case 'w':
                return sign + toEnglishWords(Math.abs(num)).toLowerCase();
            case '\u2460': // circled numbers
                return toSymbols(num, "\u24EA" + alphabet("\u2460", 20) + alphabet("\u3251", 15) + alphabet("\u32B1", 15));
            case '\u2474': // parenthesized numbers
                return toSymbols(num, "0" + alphabet("\u2474", 20));
            case '\u2488': // dotted numbers
                return toSymbols(num, "0" + alphabet("\u2488", 20));
            default:
                return toDecimal(num, format);
        }
    }

    // Implements the XPath translate function

    function translate(input, from, to) {
        var result = "";
        var i;
        for (i = 0; i < input.length; i++) {
            var c = input.charAt(i);
            var index = from.indexOf(c);
            if (index < 0) {
                result += c;
            } else if (index < to.length) {
                result += to.charAt(index);
            }
        }
        return result;
    }

    var decimalFormatDefaults = {
        "decimal-separator": "46",
        "grouping-separator": "44",
        "digit": "35",
        "minus-sign": "45",
        "percent": "37",
        "per-mille": "8240",
        "zero-digit": "48",
        "exponent-separator": "101",
        "pattern-separator": "59",
        "infinity": "Infinity",
        "NaN": "NaN"
    };

    function singleChar(elem, attName) {
        var code = DU.getAttribute(elem, attName, decimalFormatDefaults[attName]);
        return String.fromCharCode(parseInt(code, 10));
    }

    function analyzeSubPicture(pic, spec) {
        function error(str) {
            var array = [["$gs", 'grouping separator'], ["$es", 'exponent separator'], ["$ds", 'decimal separator'], ["$pc", 'non-prefix passive character'], ["$pp", 'percent|permille'], ["$od", 'optional digit'], ["$md", 'mandatory digit'], ["$ip", 'integer part'], ["$fp", 'fractional part']];
            array.forEach(function (value) {
                str = str.replace(value[0], value[1]);
            });

            throw XError("Invalid picture: " + str, "FODF1310");
        }

        var details = {};
        var decimalSepPos = pic.indexOf(spec.decimalSeparator);
        var picContainsDecSep = decimalSepPos >= 0;

        var z = spec.zeroDigit.charCodeAt(0);
        var minIntPartSize = 0;
        var picIntPartSize = 0;
        var intGpPos = [];
        var prefix = [], suffix = [];
        var firstDigit = -1;
        var firstPassiveAfterDigit = -1;
        var picContainsExpSep = false;
        var picIntPartContainsOptDigit = false;
        var expSepPos = -1;
        var expPartSize = 0;
        // Integer part, if no dec sep then process exp part here
        var i, j, c;
        var n = picContainsDecSep ? decimalSepPos : pic.length;
        for (i = 0; i < n; i++) {
            c = pic.charCodeAt(i);
            //print("Int part c " + c);
            if (c >= z && c < z + 10) {
                if (firstPassiveAfterDigit > 0) {
                    error("digit follows $pc");
                }
                if (picContainsExpSep) {
                    expPartSize++;
                } else {
                    if (minIntPartSize < 1) {
                        if (firstDigit < 0) {
                            firstDigit = i;
                        }
                    }
                    minIntPartSize++;
                    picIntPartSize++;
                }
            } else if (c == spec.digit.charCodeAt(0)) {
                if (firstPassiveAfterDigit > 0) {
                    error("digit follows $pc");
                }
                if (picContainsExpSep) {
                    error("$od follows $es");
                }
                if (minIntPartSize > 0) {
                    error("$od follows $md in $ip");
                }
                if (firstDigit < 0) {
                    firstDigit = i;
                    picIntPartContainsOptDigit = true;
                }
                picIntPartSize++;
            } else if (c == spec.groupingSeparator.charCodeAt(0)) {
                if (firstDigit < 0) {
                    error("$gs before any digit");
                }
                if (suffix.length > 0) {
                    error("$gs follows $pc");
                }
                if (picContainsExpSep) {
                    error("$gs follows $es");
                }
                intGpPos.push(i);
            } else if (c == spec.percent.charCodeAt(0) || c == spec.permille.charCodeAt(0)) {
                if (picContainsDecSep) {
                    error("$pp before $ds");
                } else {
                    if (firstDigit < 0) {
                        error("$pp before any digit");
                    }
                    if (firstPassiveAfterDigit > 0) {
                        error("$pp follows $pc");
                    }
                    if (picContainsExpSep) {
                        error("$pp follows $es");
                    }
                    suffix.push(c);
                    if (firstPassiveAfterDigit < 0) {
                        firstPassiveAfterDigit = i;
                    }
                    if (c == spec.percent.charCodeAt(0)) {
                        details.percent = true;
                    } else {
                        details.permille = true;
                    }
                }
            } else {
                if (!picContainsDecSep && firstDigit >= 0 && c == spec.exponentSeparator.charCodeAt(0) && firstPassiveAfterDigit < 0) {
                    if (!picContainsExpSep) {
                        picContainsExpSep = true;
                        expSepPos = i;
                    } else {
                        suffix.push(c);
                        if (expPartSize > 0) {
                            if (firstPassiveAfterDigit < 0) {
                                firstPassiveAfterDigit = i;
                            }
                        } else {
                            // previous 'e' wasn't really an ExpSep
                            suffix.push(c);
                            picContainsExpSep = false;
                            expSepPos = -1;
                            if (firstPassiveAfterDigit < 0) {
                                firstPassiveAfterDigit = i - 1;
                            }
                        }
                    }
                } else if (firstDigit >= 0 && picContainsDecSep) {
                    error("$pc before $ds");
                } else if (picContainsExpSep && expPartSize === 0) {
                    // previous 'e' wasn't really an ExpSep
                    picContainsExpSep = false;
                    expSepPos = -1;
                    suffix.push(spec.exponentSeparator.charCodeAt(0));
                    suffix.push(c);
                    if (firstPassiveAfterDigit < 0) {
                        firstPassiveAfterDigit = i - 1;
                    }
                } else if (firstDigit >= 0) {
                    suffix.push(c);
                    if (firstPassiveAfterDigit < 0) {
                        firstPassiveAfterDigit = i;
                    }
                } else {
                    prefix.push(c);
                }
            }
        }
        // intGpPos is built as indices from left, including possible prefix; but translate it
        // to be indices from right i.e. starting at decimal sep (or exp sep, or passive char, or pic length).
        if (intGpPos.length > 0) {
            var l = picContainsDecSep ? decimalSepPos : picContainsExpSep ? expSepPos :
                firstPassiveAfterDigit > 0 ? firstPassiveAfterDigit : pic.length;
            var translated = intGpPos.map(function (value) {
                return l - value - 1;
            });
            intGpPos = translated.reverse();
        }
        if (intGpPos.length !== 0) {
            if (intGpPos[0] === 0) {
                error("$gs at end of $ip");
            }
            for (j = 0; j < intGpPos.length - 1; j++) {
                if (intGpPos[j] + 1 == intGpPos[j + 1]) {
                    error("consecutive $gs in $ip");
                }
            }
        }

        // Fractional part (if there is one); in that case, includes processing of exp part
        var minFracPartSize = 0;
        var maxFracPartSize = 0;
        var fracGpPos = [];
        if (picContainsDecSep) {
            var firstFracOptDigit = -1;
            var fracPart = pic.substring(decimalSepPos + 1);
            for (i = 0; i < fracPart.length; i++) {
                c = fracPart.charCodeAt(i);
                //print("Frac part c " + c);
                if (c >= z && c < z + 10) {
                    if (picContainsExpSep && firstPassiveAfterDigit < 0) {
                        expPartSize++;
                    } else if (firstFracOptDigit >= 0 || firstPassiveAfterDigit >= 0) {
                        error("$md follows $od or $pc in $fp");
                    } else {
                        minFracPartSize++;
                        maxFracPartSize++;
                    }
                } else if (c == spec.digit.charCodeAt(0)) {
                    if (firstPassiveAfterDigit >= 0 || picContainsExpSep) {
                        error("$od follows $pc or $es");
                    }
                    if (firstFracOptDigit < 0) {
                        firstFracOptDigit = i;
                    }
                    maxFracPartSize++;
                } else if (c == spec.groupingSeparator.charCodeAt(0)) {
                    if (firstPassiveAfterDigit >= 0 || picContainsExpSep) {
                        error("$gs follows $pc or $es");
                    }
                    fracGpPos.push(i - decimalSepPos + 1);
                } else if (c == spec.decimalSeparator.charCodeAt(0)) {
                    error("more than one $ds");
                } else if (c == spec.percent.charCodeAt(0) || c == spec.permille.charCodeAt(0)) {
                    if (firstPassiveAfterDigit >= 0 || picContainsExpSep) {
                        error("$pp follows $pc or $es");
                    }
                    suffix.push(c);
                    firstPassiveAfterDigit = i;
                    if (c == spec.percent.charCodeAt(0)) {
                        details.percent = true;
                    } else {
                        details.permille = true;
                    }
                } else {
                    if (c == spec.exponentSeparator.charCodeAt(0) && firstPassiveAfterDigit < 0) {
                        if (!picContainsExpSep) {
                            picContainsExpSep = true;
                            expSepPos = i;
                        } else {
                            suffix.push(c);
                            if (expPartSize > 0) {
                                if (firstPassiveAfterDigit < 0) {
                                    firstPassiveAfterDigit = i;
                                }
                            } else {
                                // previous 'e' wasn't really an ExpSep
                                suffix.push(c);
                                picContainsExpSep = false;
                                expSepPos = -1;
                                if (firstPassiveAfterDigit < 0) {
                                    firstPassiveAfterDigit = i - 1;
                                }
                            }
                        }
                    } else {
                        if (picContainsExpSep && expPartSize === 0) {
                            // previous 'e' wasn't really an ExpSep
                            picContainsExpSep = false;
                            expSepPos = -1;
                            suffix.push(spec.exponentSeparator.charCodeAt(0));
                            suffix.push(c);
                            if (firstPassiveAfterDigit < 0) {
                                firstPassiveAfterDigit = i - 1;
                            }
                        } else {
                            suffix.push(c);
                            if (firstPassiveAfterDigit < 0) {
                                firstPassiveAfterDigit = i;
                            }
                        }
                    }
                }
            }
        }
        if (firstDigit < 0 && maxFracPartSize === 0) {
            error("mantissa contains no digits");
        }
        if (fracGpPos.length !== 0) {
            if (fracGpPos[0] === 0) {
                error("$gs at beginning of $fp");
            }
            for (j = 0; j < fracGpPos.length - 1; j++) {
                if (fracGpPos[j] + 1 == fracGpPos[j + 1]) {
                    error("consecutive $gs in $fp");
                }
            }
        }
        if (minIntPartSize === 0 && maxFracPartSize === 0) {
            if (picContainsExpSep) {
                minFracPartSize = 1;
                maxFracPartSize = 1;
            } else {
                minIntPartSize = 1;
            }
        }
        // Do the following correction at this stage, but retain picIntPartContainsOptDigit to adjust again later :
        if (picContainsExpSep && minIntPartSize === 0 && picIntPartContainsOptDigit) {
            minIntPartSize = 1;
        }
        if (minIntPartSize === 0 && minFracPartSize === 0) {
            minFracPartSize = 1;
        }
        /*print("minIntPartSize " + minIntPartSize);
         print("minFracPartSize " + minFracPartSize);
         print("maxFracPartSize " + maxFracPartSize);
         print("expPartSize " + expPartSize);*/

        details.minimumIntegerPartSize = minIntPartSize;
        details.prefix = prefix;
        details.intGpPos = intGpPos;
        details.picIntPartContainsOptDigit = picIntPartContainsOptDigit;
        details.picIntPartSize = picIntPartSize;

        details.minimumFractionalPartSize = minFracPartSize;
        details.maximumFractionalPartSize = maxFracPartSize;
        details.fracGpPos = fracGpPos;
        details.expPartSize = expPartSize;
        details.suffix = suffix;
        return details;
    }


    // Used by format-date

    function toEnglishName(val, comp) {
        var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
            "November", "December"];
        var days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        if (comp == "M") {
            return months[val - 1];
        } else if (comp == "F") {
            return days[val - 1];
        } else {
            return val; // this is right for "P" which is already a string
        }
    }

    // To ensure the following are right with regards to timezone/ current timezone,
    // always use new Date(Date.UTC(....)) constructor (rather than just new Date(....))
    // if supplying more than one argument.

    function getDayInYear(date) {
        var jan1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.floor((date.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    }

    // ISO week numbers. Specifically, in the ISO calendar the days of the week are numbered from 1 (Monday)
    // to 7 (Sunday), and week 1 in any [calendar year|month] is the week (from Monday to Sunday) that includes the
    // first Thursday of that [year|month]. Days before the start of the first week of the [year|month] lie in the last
    // week of the previous [year|month].
    function getWeek(date, InYear) {
        var d = InYear ? getDayInYear(date) : date.getUTCDate();
        var first = new Date(Date.UTC(date.getUTCFullYear(), InYear ? 0 : date.getUTCMonth(), 1));
        var firstDay = first.getUTCDay();
        if (firstDay === 0) {
            firstDay = 7;
        }
        if (firstDay > 4 && (firstDay + d) <= 8) {
            // days before week one are part of the last week of the previous [year|month] [52 or 53 | 4 or 5]
            return getWeek(new Date(first.getTime() - 24 * 60 * 60 * 1000), InYear);
        }
        var inc = (firstDay < 5 ? 1 : 0);
        // implements the First Thursday rule
        return (Math.floor((d + firstDay - 2) / 7)) + inc;
    }

    function getWeekInYear(date) {
        return getWeek(date, true);
    }

    function getWeekInMonth(date) {
        return getWeek(date, false);
    }

    function getHourInHalfDay(date) {
        return date.getUTCHours() < 13 ? (date.getUTCHours() === 0 ? 12 : date.getUTCHours()) : date.getUTCHours() - 12;
    }

    function getAMPM(date) {
        return date.getUTCHours() < 12 ? "Am" : "Pm";
    }

    var dateMethod = {
        "Y": "getUTCFullYear",
        "M": "getUTCMonth",
        "D": "getUTCDate",
        "F": "getUTCDay",
        "H": "getUTCHours",
        "m": "getUTCMinutes",
        "s": "getUTCSeconds",
        "f": "getUTCMilliseconds"
    };
    var dateFn = {
        "d": getDayInYear,
        "W": getWeekInYear,
        "w": getWeekInMonth,
        "h": getHourInHalfDay,
        "P": getAMPM,
        "E": function () {
            return "AD";
        }
    };
    // TODO "C" and "E"

    // Formats a timezone string (from a DateTime object)
    function formatTimezone(tzStr, specifier, format1, format2, minWidth, maxWidth, allASCII) {
        // TODO should also use width modifiers
        if (tzStr === "") {
            return format1 == "Z" ? "J" : "";
        }

        var prefix = specifier == "z" ? "GMT" : ""; // TODO localized equivalent?

        if (format2 == "t" && tzStr == "+00:00" && format1 != "Z" && format1 != "N") {
            //ascii digits or /[0-9]+/.test(format1)
            return "Z"; // TODO width mod?
        } else if (format1 === "") {
            return prefix + tzStr;
        }

        var result, tzparts = tzStr.match(/^([+\-])([0-9])([0-9]):([0-9]{2})$/);
        if (format1 == "Z" || format1 == "N") {
            // TODO also allow n|Nn ?
            if (format1 == "Z") {
                // military timezone formatting
                var hr = parseInt(tzparts[1] + tzparts[2] + tzparts[3], 10);
                result = (hr < -12 || hr > 12 || tzparts[4] != "00") ? tzStr : "YXWVUTSRQPONZABCDEFGHIKLM".charAt(hr + 12);
            } else if (format1 == "N") {
                // TODO implement timezone names
                throw XError("Timezone names not implemented", "SXJS0002");
                // at least implement fallback:
                // If no timezone name can be identified, the timezone offset is output using the fallback format +01:01.
            }
        } else {
            if (allASCII && !/[0-9]+/.test(format1)) {
                format1 = "00:00";
                // if format is something other than digits, n or Z (i.e. iIwW), then use digits as default
            }
            var f1 = function (format, tzparts) {
                return (tzparts[2] == "0" && format.length == 1) ? tzparts[3] : tzparts[2] + tzparts[3];
            };
            var f2 = function (format, tzparts) {
                var h = (tzparts[2] == "0" && (format.length == 1 || format.length == 3)) ? tzparts[3] : tzparts[2] + tzparts[3];
                var m = format.length > 2 ? tzparts[4] : tzparts[4] != "00" ? ":" + tzparts[4] : "";
                return h + m;
            };
            var diff = 0;
            if (!allASCII) {
                // normalize digits in format1, then later translate result to use correct digit family
                var details = normalizeDigits(format1);
                format1 = details.format;
                diff = details.diff;
            }
            var fparts;
            if (/[^0-9A-Za-z]/.test(format1)) {
                fparts = format1.match(/^([0-9]+)([^0-9A-Za-z])([0-9]+)$/);
                result = tzparts[1] + f1(fparts[1], tzparts) + fparts[2] + tzparts[4];
            } else {
                fparts = format1.match(/^[0-9]+$/);
                result = tzparts[1] + f2(fparts[0], tzparts);
            }
            if (!allASCII) {
                result = translateDigits(result, diff);
            }
        }
        return prefix + result;
    }

    // Format the DateTime component indicated by the variable marker
    function formatComponent(type, date, marker, language, calendar, place) {
        // language, calendar, place currently just ignored

        /**
         * Format the fractional seconds component of a date/time.
         * If format is anything other than digits (e.g. [iIwWnN]), then just use digits as default (format "1").
         * May still have issues if width modifiers (minWidth or maxWidth) defined, and format has grouping separators.
         * @param val an integer number of milliseconds
         * @param format the format picture string
         * @param minWidth refers to the min number of decimal places in a representation of val/1000
         * @param maxWidth refers to the max number of decimal places in a representation of val/1000
         * @param allASCII true if all characters in the format picture string are ASCII
         * @returns a formatted string representation of the fractional seconds value.
         */
        function formatFractionalSeconds(val, format, minWidth, maxWidth, allASCII) {
            // Use the algorithm in F&O 9.8.4.5: reverse the order of val.toString() and format, and use formatInteger

            var diff = 0, fs;
            if (!allASCII) {
                var details = normalizeDigits(format);
                format = details.format;
                diff = details.diff;
            }

            var valStr = val.toString();
            while (valStr.length < 3) {
                valStr = "0" + valStr;
            }
            var valCP = Expr.stringToCodepoints(valStr);
            var valR = parseInt(Expr.codepointsToString(valCP.reverse()), 10);

            if (!minWidth && !maxWidth && /^[0-9]$/.test(format)) {
                while (valCP.length > format.length) {
                    format += "#";
                }
            }
            // TODO The following adjustments assume no grouping separators...
            // probably issues if minWidth or maxWidth is defined, but grouping separators also present
            if (minWidth && minWidth != "*") {
                //print("minWidth " + minWidth + ", format " + format);
                var mandOpt = /^([0-9]*)(#*)$/.exec(format);
                var mandDigits = mandOpt[1] ? mandOpt[1] : "";
                var optDigits = mandOpt[2] ? mandOpt[2] : "";
                while (minWidth > mandDigits.length) {
                    mandDigits += "0";
                    optDigits = optDigits.slice(0, -1);
                }
                format = mandDigits + optDigits;
            }
            if (maxWidth) {
                if (maxWidth == "*") {
                    maxWidth = valCP.length;
                }
                while (format.length < maxWidth) {
                    format += "#";
                }
            }

            var formatR = Expr.codepointsToString(Expr.stringToCodepoints(format).reverse());
            var fsR = formatInteger(valR, formatR);
            fs = Expr.codepointsToString(Expr.stringToCodepoints(fsR).reverse());

            while (fs.length > format.length) {
                fs = fs.slice(0, -1);
            }
            if ((!minWidth || minWidth == "*") && parseInt(fs, 10) === 0) {
                fs = "0";
            }

            if (!allASCII) {
                fs = translateDigits(fs, diff);
            }
            return fs;
        }

        var result;
        var pic = marker.match(/^([YMDdWwFHhmsfZzPCE])(.*)$/);
        if (pic === null) {
            throw XError("Date/time component [" + marker + "] not recognised", "FOFD1340");
        }
        var specifier = pic[1], modifiers = pic[2] || "";
        //print("component specifier " + specifier);
        //print("modifiers " + modifiers);

        if ((type == "date" && /[HhPmsf]/.test(specifier)) || (type == "time" && /[YMDdFWwCE]/.test(specifier))) {
            throw XError("Date/time component [" + marker + "] not available in " + type, "FOFD1350");
        }


        var comma, minWidth, maxWidth;
        if ((comma = modifiers.lastIndexOf(",")) != -1) {
            var widths = modifiers.substring(comma + 1).split("-");
            modifiers = modifiers.substring(0, comma);
            minWidth = widths[0];
            maxWidth = widths[1] || "*";
            //print("minWidth " + minWidth);
            //print("maxWidth " + maxWidth);
            if ((minWidth != "*" && minWidth < 1) || (maxWidth != "*" && maxWidth < 1) ||
                (minWidth != "*" && maxWidth != "*" && minWidth > maxWidth)) {
                throw XError("Invalid width modifier in date/time formatting picture", "FOFD1340");
            }
        }
        // split modifiers into first and second presentation modifiers (both optional) - format tokens
        var format1, format2 = null;
        if (modifiers.length > 1 && /[atco]/.test(modifiers.charAt(modifiers.length - 1))) {
            format1 = modifiers.substring(0, modifiers.length - 1);
            format2 = modifiers.charAt(modifiers.length - 1);
        } else {
            format1 = modifiers; // format1 default is empty string
        }

        var allASCII = true;
        if (/^[\x01-\x7f]*$/.test(format1)) {
            //print("format1 is all-ascii");
        } else if (format1.length != Expr.stringToCodepoints(format1).length) {
            throw XError("Cannot handle non-BMP characters in date/time formatting picture", "SXJS0002");
        } else {
            allASCII = false;
            //print("format1 contains non-ascii chars");
        }

        if (/[Zz]/.test(specifier)) {
            var tz = date.tzOffsetToString() == "Z" ? "+00:00" : date.tzOffsetToString();
            //print("have timezone string " + tz);
            return formatTimezone(tz, specifier, format1, format2, minWidth, maxWidth, allASCII);
        }

        // Use proxy date (rather than date.UTCdate) to get the components right
        var proxy = date.proxy();

        var val = dateMethod[specifier] ? proxy[dateMethod[specifier]]() : dateFn[specifier] ? dateFn[specifier](proxy) : null;
        if (val === null) {
            throw XError("Component specifier not implemented: [" + specifier + "]", "SXJS0002");
        } else if (specifier == "M") {
            val++;
        } else if (specifier == "F" && val === 0) {
            // ISO Sunday is 7 not 0
            val = 7;
        }


        // If the implementation does not support the use of the requested format token,
        // it must use the default presentation modifier for that component.
        // TODO so should format1 be checked more carefully? - more use of defaults
        // e.g. N format only works with certain specifiers.

        if (format1 === "") {
            // F default says 'n', but Saxon uses 'Nn'
            format1 = /[FPCE]/.test(specifier) ? "n" : /[ms]/.test(specifier) ? "01" : "1";
        }
        if (specifier == "f") {
            //print("format fractional seconds value " + val + " with picture string " + format1);
            // it appears format2='o' is ignored in Java so do same here, i.e. ignore format2
            return formatFractionalSeconds(val, format1, minWidth, maxWidth, allASCII);
        } else if (/[nN]/.test(format1)) {
            //print("first modifier n,N,Nn");
            result = toEnglishName(val, specifier);
            if (format1 == "n") {
                result = result.toLowerCase();
            } else if (format1 == "N") {
                result = result.toUpperCase();
            }
            // Width modifiers e.g. [FN,*-4], [MN,3-3]
            // TODO For all specifiers??
            if (maxWidth && maxWidth != "*") {
                if (result.length > maxWidth) {
                    result = result.substring(0, maxWidth);
                }
            }
        } else {
            // if format1 uses ';' as a grouping separator, then fix so that formatInteger works (by adding another ; at the end)
            var format = /;/.test(format1) ? format1 + ';' : format1;
            // also use format2 modifier [atco]
            if (format2) {
                format += (format.charAt(format.length - 1) == ";" ? '' : ';') + format2;
            }
            //print("format integer " + val + " with picture string " + format);
            result = formatInteger(val, format);
            // formatInteger can deal with nonASCII format
            // TODO would be useful to get the zero digit out here, rather than possibly repeating the format processing
            // later with normalizeDigits

            //print("format integer result " + result);

            // Width modification, e.g. [Y01] [Y1,2-2]
            // Note: formatInteger already does main width modification, and the result may contain grouping separators
            // or an ordinal suffix which affects the result length.
            // Only modify width now if width modifiers are specified, or in special cases e.g. [Y01]

            // Only truncation of decimal numeric is for "Y" e.g. [Y01] [Y1,2-2]; no modification for [Y1]
            if (specifier == "Y" && /[^iIwWnN]/.test(format1.charAt(format1.length - 1))) {
                if ((!minWidth && format1.length == 2) || maxWidth == 2) {
                    while (result.length > 2) {
                        result = result.substring(1);
                    }
                }
            }
            // Padding when minWidth is set
            if (minWidth) {
                var min = (minWidth == "*") ? 0 : parseInt(minWidth, 10);
                if (min > 0 && result.length < min) {
                    if (/[YMDdWwHhms]/.test(specifier) && /[^iIwWnN]/.test(format1.charAt(format1.length - 1))) {
                        var z = "0";
                        if (!allASCII) {
                            z = String.fromCharCode(normalizeDigits(format).zeroDigit);
                            // TODO can the repetition of normalizeDigits processing be avoided?
                        }
                        while (result.length < min) {
                            result = z + result;
                        }
                    } else if (specifier == "Y" && /[iIwWnN]/.test(format1.charAt(format1.length - 1))) {
                        while (result.length < min) {
                            result = result + " ";
                        }
                    } else {
                        throw XError("Not implemented min width modification with specifier " + specifier + " and format " + format1, "SXJS0002");
                    }
                }
            }
        }
        return result;
    }

    function formatNumber(num, picture, format, context) {
        //print("formatNumber " + showValue(num) + " with " + picture);
        var numIsNegative = num < 0 ? true : num === 0 ? (1 / num < 0) : false;
        var decimalFormat = context.fixed.decimalFormats[format !== null ? format : "Q{}"];
        if (!decimalFormat) {
            throw XError("Unknown decimal format " + format, "FODF1280");
        }
        // decimal-separator="46" grouping-separator="44" digit="35" minus-sign="45" percent="37"
        // per-mille="8240" zero-digit="48" exponent-separator="101" pattern-separator="59" infinity="Infinity" NaN="NaN"/>

        var formatSpec = {
            decimalSeparator: singleChar(decimalFormat, "decimal-separator"),
            groupingSeparator: singleChar(decimalFormat, "grouping-separator"),
            digit: singleChar(decimalFormat, "digit"),
            minusSign: singleChar(decimalFormat, "minus-sign"),
            percent: singleChar(decimalFormat, "percent"),
            permille: singleChar(decimalFormat, "per-mille"),
            zeroDigit: singleChar(decimalFormat, "zero-digit"),
            exponentSeparator: singleChar(decimalFormat, "exponent-separator"),
            patternSeparator: singleChar(decimalFormat, "pattern-separator"),
            infinity: DU.getAttribute(decimalFormat, "infinity", decimalFormatDefaults.infinity),
            nan: DU.getAttribute(decimalFormat, "NaN", decimalFormatDefaults.NaN)
        };

        if (isNaN(num)) {
            return formatSpec.nan;
        }

        var subPictures = picture.includes(formatSpec.patternSeparator) ? picture.split(formatSpec.patternSeparator) : [picture];
        if (subPictures.length > 2) {
            throw XError("Invalid picture: multiple pattern separators", "FODF1310");
        }
        var subPic = (subPictures.length > 1 && num < 0) ? subPictures[1] : subPictures[0];

        var details = analyzeSubPicture(subPic, formatSpec);

        var result, fracPart;
        if (!isFinite(num)) {
            result = formatSpec.infinity;
        } else {
            var decimal;
            if (details.expPartSize > 0) {
                decimal = toExponentialString(num, details);
            } else {
                var abs = Math.abs(num);
                //print("abs " + abs);
                if (details.percent) {
                    abs = Math.abs(num * 100);
                }
                if (details.permille) {
                    abs = Math.abs(num * 1000);
                    // TODO problem with precision?
                }
                if (abs + '' == "Infinity") {
                    decimal = abs + '';
                } else {
                    decimal = abs < 999999 ? abs.toString() : Big(abs).toFixed();
                    // avoid exponential notation
                    //decimal = Big(abs).toFixed();
                }

                //print("decimal " + decimal);

                var integerPartSize = decimal.indexOf(".");
                if (integerPartSize < 0) {
                    integerPartSize = decimal.length;
                    if (details.minimumFractionalPartSize > 0) {
                        decimal = decimal + ".";
                    }
                }
                if (details.maximumFractionalPartSize >= 0 && decimal.substring(integerPartSize) != "." && integerPartSize != decimal.length) {
                    if (details.maximumFractionalPartSize > 0) {
                        fracPart = Big(decimal.substring(integerPartSize)).round(details.maximumFractionalPartSize, 1);
                        decimal = decimal.substring(0, integerPartSize) + fracPart.toString().substring(1);
                    } else {
                        decimal = Big(decimal).round(0, 1).toString();
                    }
                    //print("decimal after rounding to maximumFractionalPartSize "+ decimal);
                }
                var fractionalPartSize = decimal.length - 1 - integerPartSize;
                //print("fractionalPartSize " + fractionalPartSize);
                if (details.minimumFractionalPartSize > 0) {
                    while (fractionalPartSize < details.minimumFractionalPartSize) {
                        decimal += "0";
                        fractionalPartSize++;
                    }
                }
                while (integerPartSize < details.minimumIntegerPartSize) {
                    decimal = "0" + decimal;
                    integerPartSize++;
                }
                if (fractionalPartSize > 0 && details.minimumIntegerPartSize === 0 && decimal.substring(0, integerPartSize) == "0") {
                    decimal = decimal.substring(integerPartSize);
                }
                if (decimal == "0" && details.minimumIntegerPartSize === 0 && details.minimumFractionalPartSize === 0 && details.maximumFractionalPartSize > 0) {
                    decimal = ".0"; // HACK
                }
            }

            var map = "";
            var i;
            for (i = 0; i < 10; i++) {
                map += String.fromCharCode(formatSpec.zeroDigit.charCodeAt(0) + i);
            }
            map += formatSpec.decimalSeparator;

            result = translate(decimal, "0123456789.", map);

            //print("formatNumber result pre-separators = " + result);
            // Insert grouping separators
            if (details.intGpPos.length > 0 || details.fracGpPos.length > 0) {
                var numPoint = result.indexOf(formatSpec.decimalSeparator);
                if (numPoint < 0) {
                    numPoint = result.length;
                }
                var intPart = result.substring(0, numPoint);
                fracPart = result.substring(numPoint);
                if (details.intGpPos.length > 0) {
                    var spacingIsRegular = true;
                    for (var j = 1; j < details.intGpPos.length; j++) {
                        if ((details.intGpPos[j] + 1) % (details.intGpPos[0] + 1) !== 0) {
                            spacingIsRegular = false;
                            break;
                        }
                    }
                    if (spacingIsRegular &&
                        (details.picIntPartSize + details.intGpPos.length - details.intGpPos[details.intGpPos.length - 1] - 1 > details.intGpPos[0])) {
                        spacingIsRegular = false;
                    }
                    //print("spacingIsRegular " + spacingIsRegular);
                    if (spacingIsRegular) {
                        intPart = Numberer.addGroupingSeparators(intPart, formatSpec.groupingSeparator, details.intGpPos[0]);
                        //print("intPart " + intPart);
                    } else {
                        intPart = addIrregularGroupingSeparators(intPart, details.intGpPos, null, formatSpec.groupingSeparator);
                    }
                }
                if (details.fracGpPos.length > 0) {
                    fracPart = addIrregularGroupingSeparators(fracPart, details.fracGpPos, null, formatSpec.groupingSeparator, true);
                }
                result = intPart + fracPart;
            }
        }

        if (details.prefix.length > 0) {
            result = Expr.codepointsToString(details.prefix) + result;
        }
        if (details.suffix.length > 0) {
            result += Expr.codepointsToString(details.suffix);
        }
        if (numIsNegative && subPictures.length == 1) {
            result = formatSpec.minusSign + result;
        }
        return result;
    }

    /*
     * Return a string representing the value of number num in exponential notation,
     * with details from analyzing a picture string:
     * specified sizes for the integer and fractional parts of the mantissa,
     * and the specified minimum size for the exponent part.
     */

    function toExponentialString(num, details) {
        var intPartSize = details.minimumIntegerPartSize;
        var minFracPartSize = details.minimumFractionalPartSize;
        var maxFracPartSize = details.maximumFractionalPartSize;
        // Adjustment so that fn(0.1, '.0e0')='.1e0' while fn(0.1, '#.0e0')='0.1e0'
        if (intPartSize == 1 && details.picIntPartContainsOptDigit) {
            intPartSize = 0;
            if (minFracPartSize === 0) {
                minFracPartSize = 1;
                if (maxFracPartSize === 0) {
                    maxFracPartSize = 1;
                }
            }
        }
        var expSize = details.expPartSize;

        var x = Big(num);
        var c = x.c;

        // Round to the correct number of significant digits first
        var minSD = intPartSize !== 0 ? intPartSize + minFracPartSize : minFracPartSize;
        var maxSD = intPartSize !== 0 ? intPartSize + maxFracPartSize : maxFracPartSize;
        if (c.length > maxSD) {
            x = Big(x.toPrecision(maxSD));
        }

        // Manipulate to get the exponent value correct.
        if (intPartSize > 1) {
            x = x.div(Big(10).pow(intPartSize - 1));
        } else if (intPartSize === 0) {
            x = x.times(Big(10));
        }
        c = x.c;
        while (c.length < minSD) {
            c.push(0);
        }

        var mantissa = "";
        if (c.length > 0) {
            if (intPartSize === 0 && details.picIntPartContainsOptDigit) {
                mantissa += "0";
            } else {
                for (var j = 0; j < intPartSize; j++) {
                    mantissa += c[j];
                }
            }
            if (maxFracPartSize > 0 && c.length > intPartSize) {
                mantissa += "." + c.join("").slice(intPartSize);
            }
        } else {
            throw XError("Empty mantissa", "SXJS0004");
        }
        return mantissa + 'e' + toDecimalWidth(x.e, expSize);
    }


    return {
        xslNumber: xslNumber,
        nodeNum: nodeNum,
        numSeqFmt: numSeqFmt,

        formatInteger: formatInteger,

        addGroupingSeparators: function (str, sep, size) {
            var result = "";
            var i;
            for (i = 0; i < str.length; i++) {
                result += str.charAt(i);
                if ((size == 1 || (str.length - i) % size == 1) && i < str.length - 1) {
                    result += sep;
                }
            }
            return result;
        },

        formatNumber: formatNumber,

        formatDateTime: function (type, date, picture, language, calendar, place) {
            //print("format " + type + " " + date + " with " + picture);
            // TODO language, calendar, place - for now, just ignore any specified

            function replacer(match) {
                return match == "[[" ? "[" : match == "]]" ? "]" :
                    formatComponent(type, date, match.substring(1, match.length - 1).replace(/\s+/g, ""), language, calendar, place);
            }

            if (!/\[(\[|[^\]]*\])|\]\]/g.test(picture)) {
                throw XError("Date format picture doesn't match required syntax", "FOFD1340");
            }
            return picture.replace(/\[(\[|[^\]]*\])|\]\]/g, replacer);
        }
    };
}
());
/* big.js v3.1.3 https://github.com/MikeMcl/big.js/LICENCE */
// Library supporting Decimal numbers. Downloaded from github 2016-01-11
;
(function (global) {
    'use strict';

    /*
     big.js v3.1.3
     A small, fast, easy-to-use library for arbitrary-precision decimal arithmetic.
     https://github.com/MikeMcl/big.js/
     Copyright (c) 2014 Michael Mclaughlin <M8ch88l@gmail.com>
     MIT Expat Licence
     */

    /***************************** EDITABLE DEFAULTS ******************************/

    // The default values below must be integers within the stated ranges.

    /*
     * The maximum number of decimal places of the results of operations
     * involving division: div and sqrt, and pow with negative exponents.
     */
    var DP = 20,                           // 0 to MAX_DP

    /*
     * The rounding mode used when rounding to the above decimal places.
     *
     * 0 Towards zero (i.e. truncate, no rounding).       (ROUND_DOWN)
     * 1 To nearest neighbour. If equidistant, round up.  (ROUND_HALF_UP)
     * 2 To nearest neighbour. If equidistant, to even.   (ROUND_HALF_EVEN)
     * 3 Away from zero.                                  (ROUND_UP)
     */
        RM = 1,                            // 0, 1, 2 or 3

    // The maximum value of DP and Big.DP.
        MAX_DP = 1E6,                      // 0 to 1000000

    // The maximum magnitude of the exponent argument to the pow method.
        MAX_POWER = 1E6,                   // 1 to 1000000

    /*
     * The exponent value at and beneath which toString returns exponential
     * notation.
     * JavaScript's Number type: -7
     * -1000000 is the minimum recommended exponent value of a Big.
     */
        E_NEG = -7,                   // 0 to -1000000

    /*
     * The exponent value at and above which toString returns exponential
     * notation.
     * JavaScript's Number type: 21
     * 1000000 is the maximum recommended exponent value of a Big.
     * (This limit is not enforced or checked.)
     */
        E_POS = 21,                   // 0 to 1000000

    /******************************************************************************/

    // The shared prototype object.
        P = {},
        isValid = /^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,
        Big;


    /*
     * Create and return a Big constructor.
     *
     */
    function bigFactory() {

        /*
         * The Big constructor and exported function.
         * Create and return a new instance of a Big number object.
         *
         * n {number|string|Big} A numeric value.
         */
        function Big(n) {
            var x = this;

            // Enable constructor usage without new.
            if (!(x instanceof Big)) {
                return n === void 0 ? bigFactory() : new Big(n);
            }

            // Duplicate.
            if (n instanceof Big) {
                x.s = n.s;
                x.e = n.e;
                x.c = n.c.slice();
            } else {
                parse(x, n);
            }

            /*
             * Retain a reference to this Big constructor, and shadow
             * Big.prototype.constructor which points to Object.
             */
            x.constructor = Big;
        }

        Big.prototype = P;
        Big.DP = DP;
        Big.RM = RM;
        Big.E_NEG = E_NEG;
        Big.E_POS = E_POS;

        return Big;
    }


    // Private functions


    /*
     * Return a string representing the value of Big x in normal or exponential
     * notation to dp fixed decimal places or significant digits.
     *
     * x {Big} The Big to format.
     * dp {number} Integer, 0 to MAX_DP inclusive.
     * toE {number} 1 (toExponential), 2 (toPrecision) or undefined (toFixed).
     */
    function format(x, dp, toE) {
        var Big = x.constructor,

        // The index (normal notation) of the digit that may be rounded up.
            i = dp - (x = new Big(x)).e,
            c = x.c;

        // Round?
        if (c.length > ++dp) {
            rnd(x, i, Big.RM);
        }

        if (!c[0]) {
            ++i;
        } else if (toE) {
            i = dp;

            // toFixed
        } else {
            c = x.c;

            // Recalculate i as x.e may have changed if value rounded up.
            i = x.e + i + 1;
        }

        // Append zeros?
        for (; c.length < i; c.push(0)) {
        }
        i = x.e;

        /*
         * toPrecision returns exponential notation if the number of
         * significant digits specified is less than the number of digits
         * necessary to represent the integer part of the value in normal
         * notation.
         */
        return toE === 1 || toE && (dp <= i || i <= Big.E_NEG) ?

            // Exponential notation.
        (x.s < 0 && c[0] ? '-' : '') +
        (c.length > 1 ? c[0] + '.' + c.join('').slice(1) : c[0]) +
        (i < 0 ? 'e' : 'e+') + i

            // Normal notation.
            : x.toString();
    }


    /*
     * Parse the number or string value passed to a Big constructor.
     *
     * x {Big} A Big number instance.
     * n {number|string} A numeric value.
     */
    function parse(x, n) {
        var e, i, nL;

        // Minus zero?
        if (n === 0 && 1 / n < 0) {
            n = '-0';

            // Ensure n is string and check validity.
        } else if (!isValid.test(n += '')) {
            throwErr(NaN);
        }

        // Determine sign.
        x.s = n.charAt(0) == '-' ? (n = n.slice(1), -1) : 1;

        // Decimal point?
        if ((e = n.indexOf('.')) > -1) {
            n = n.replace('.', '');
        }

        // Exponential form?
        if ((i = n.search(/e/i)) > 0) {

            // Determine exponent.
            if (e < 0) {
                e = i;
            }
            e += +n.slice(i + 1);
            n = n.substring(0, i);

        } else if (e < 0) {

            // Integer.
            e = n.length;
        }

        // Determine leading zeros.
        for (i = 0; n.charAt(i) == '0'; i++) {
        }

        if (i == (nL = n.length)) {

            // Zero.
            x.c = [x.e = 0];
        } else {

            // Determine trailing zeros.
            for (; n.charAt(--nL) == '0';) {
            }

            x.e = e - i - 1;
            x.c = [];

            // Convert string to array of digits without leading/trailing zeros.
            for (e = 0; i <= nL; x.c[e++] = +n.charAt(i++)) {
            }
        }

        return x;
    }


    /*
     * Round Big x to a maximum of dp decimal places using rounding mode rm.
     * Called by div, sqrt and round.
     *
     * x {Big} The Big to round.
     * dp {number} Integer, 0 to MAX_DP inclusive.
     * rm {number} 0, 1, 2 or 3 (DOWN, HALF_UP, HALF_EVEN, UP)
     * [more] {boolean} Whether the result of division was truncated.
     */
    function rnd(x, dp, rm, more) {
        var u,
            xc = x.c,
            i = x.e + dp + 1;

        if (rm === 1) {

            // xc[i] is the digit after the digit that may be rounded up.
            more = xc[i] >= 5;
        } else if (rm === 2) {
            more = xc[i] > 5 || xc[i] == 5 &&
                (more || i < 0 || xc[i + 1] !== u || xc[i - 1] & 1);
        } else if (rm === 3) {
            more = more || xc[i] !== u || i < 0;
        } else {
            more = false;

            if (rm !== 0) {
                throwErr('!Big.RM!');
            }
        }

        if (i < 1 || !xc[0]) {

            if (more) {

                // 1, 0.1, 0.01, 0.001, 0.0001 etc.
                x.e = -dp;
                x.c = [1];
            } else {

                // Zero.
                x.c = [x.e = 0];
            }
        } else {

            // Remove any digits after the required decimal places.
            xc.length = i--;

            // Round up?
            if (more) {

                // Rounding up may mean the previous digit has to be rounded up.
                for (; ++xc[i] > 9;) {
                    xc[i] = 0;

                    if (!i--) {
                        ++x.e;
                        xc.unshift(1);
                    }
                }
            }

            // Remove trailing zeros.
            for (i = xc.length; !xc[--i]; xc.pop()) {
            }
        }

        return x;
    }


    /*
     * Throw a BigError.
     *
     * message {string} The error message.
     */
    function throwErr(message) {
        var err = new Error(message);
        err.name = 'BigError';

        throw err;
    }


    // Prototype/instance methods


    /*
     * Return a new Big whose value is the absolute value of this Big.
     */
    P.abs = function () {
        var x = new this.constructor(this);
        x.s = 1;

        return x;
    };


    /*
     * Return
     * 1 if the value of this Big is greater than the value of Big y,
     * -1 if the value of this Big is less than the value of Big y, or
     * 0 if they have the same value.
     */
    P.cmp = function (y) {
        var xNeg,
            x = this,
            xc = x.c,
            yc = (y = new x.constructor(y)).c,
            i = x.s,
            j = y.s,
            k = x.e,
            l = y.e;

        // Either zero?
        if (!xc[0] || !yc[0]) {
            return !xc[0] ? !yc[0] ? 0 : -j : i;
        }

        // Signs differ?
        if (i != j) {
            return i;
        }
        xNeg = i < 0;

        // Compare exponents.
        if (k != l) {
            return k > l ^ xNeg ? 1 : -1;
        }

        i = -1;
        j = (k = xc.length) < (l = yc.length) ? k : l;

        // Compare digit by digit.
        for (; ++i < j;) {

            if (xc[i] != yc[i]) {
                return xc[i] > yc[i] ^ xNeg ? 1 : -1;
            }
        }

        // Compare lengths.
        return k == l ? 0 : k > l ^ xNeg ? 1 : -1;
    };


    /*
     * Return a new Big whose value is the value of this Big divided by the
     * value of Big y, rounded, if necessary, to a maximum of Big.DP decimal
     * places using rounding mode Big.RM.
     */
    P.div = function (y) {
        var x = this,
            Big = x.constructor,
        // dividend
            dvd = x.c,
        //divisor
            dvs = (y = new Big(y)).c,
            s = x.s == y.s ? 1 : -1,
            dp = Big.DP;

        if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
            throwErr('!Big.DP!');
        }

        // Either 0?
        if (!dvd[0] || !dvs[0]) {

            // If both are 0, throw NaN
            if (dvd[0] == dvs[0]) {
                throwErr(NaN);
            }

            // If dvs is 0, throw +-Infinity.
            if (!dvs[0]) {
                throwErr(s / 0);
            }

            // dvd is 0, return +-0.
            return new Big(s * 0);
        }

        var dvsL, dvsT, next, cmp, remI, u,
            dvsZ = dvs.slice(),
            dvdI = dvsL = dvs.length,
            dvdL = dvd.length,
        // remainder
            rem = dvd.slice(0, dvsL),
            remL = rem.length,
        // quotient
            q = y,
            qc = q.c = [],
            qi = 0,
            digits = dp + (q.e = x.e - y.e) + 1;

        q.s = s;
        s = digits < 0 ? 0 : digits;

        // Create version of divisor with leading zero.
        dvsZ.unshift(0);

        // Add zeros to make remainder as long as divisor.
        for (; remL++ < dvsL; rem.push(0)) {
        }

        do {

            // 'next' is how many times the divisor goes into current remainder.
            for (next = 0; next < 10; next++) {

                // Compare divisor and remainder.
                if (dvsL != (remL = rem.length)) {
                    cmp = dvsL > remL ? 1 : -1;
                } else {

                    for (remI = -1, cmp = 0; ++remI < dvsL;) {

                        if (dvs[remI] != rem[remI]) {
                            cmp = dvs[remI] > rem[remI] ? 1 : -1;
                            break;
                        }
                    }
                }

                // If divisor < remainder, subtract divisor from remainder.
                if (cmp < 0) {

                    // Remainder can't be more than 1 digit longer than divisor.
                    // Equalise lengths using divisor with extra leading zero?
                    for (dvsT = remL == dvsL ? dvs : dvsZ; remL;) {

                        if (rem[--remL] < dvsT[remL]) {
                            remI = remL;

                            for (; remI && !rem[--remI]; rem[remI] = 9) {
                            }
                            --rem[remI];
                            rem[remL] += 10;
                        }
                        rem[remL] -= dvsT[remL];
                    }
                    for (; !rem[0]; rem.shift()) {
                    }
                } else {
                    break;
                }
            }

            // Add the 'next' digit to the result array.
            qc[qi++] = cmp ? next : ++next;

            // Update the remainder.
            if (rem[0] && cmp) {
                rem[remL] = dvd[dvdI] || 0;
            } else {
                rem = [dvd[dvdI]];
            }

        } while ((dvdI++ < dvdL || rem[0] !== u) && s--);

        // Leading zero? Do not remove if result is simply zero (qi == 1).
        if (!qc[0] && qi != 1) {

            // There can't be more than one zero.
            qc.shift();
            q.e--;
        }

        // Round?
        if (qi > digits) {
            rnd(q, dp, Big.RM, rem[0] !== u);
        }

        return q;
    };


    /*
     * Return true if the value of this Big is equal to the value of Big y,
     * otherwise returns false.
     */
    P.eq = function (y) {
        return !this.cmp(y);
    };


    /*
     * Return true if the value of this Big is greater than the value of Big y,
     * otherwise returns false.
     */
    P.gt = function (y) {
        return this.cmp(y) > 0;
    };


    /*
     * Return true if the value of this Big is greater than or equal to the
     * value of Big y, otherwise returns false.
     */
    P.gte = function (y) {
        return this.cmp(y) > -1;
    };


    /*
     * Return true if the value of this Big is less than the value of Big y,
     * otherwise returns false.
     */
    P.lt = function (y) {
        return this.cmp(y) < 0;
    };


    /*
     * Return true if the value of this Big is less than or equal to the value
     * of Big y, otherwise returns false.
     */
    P.lte = function (y) {
        return this.cmp(y) < 1;
    };


    /*
     * Return a new Big whose value is the value of this Big minus the value
     * of Big y.
     */
    P.sub = P.minus = function (y) {
        var i, j, t, xLTy,
            x = this,
            Big = x.constructor,
            a = x.s,
            b = (y = new Big(y)).s;

        // Signs differ?
        if (a != b) {
            y.s = -b;
            return x.plus(y);
        }

        var xc = x.c.slice(),
            xe = x.e,
            yc = y.c,
            ye = y.e;

        // Either zero?
        if (!xc[0] || !yc[0]) {

            // y is non-zero? x is non-zero? Or both are zero.
            return yc[0] ? (y.s = -b, y) : new Big(xc[0] ? x : 0);
        }

        // Determine which is the bigger number.
        // Prepend zeros to equalise exponents.
        if (a = xe - ye) {

            if (xLTy = a < 0) {
                a = -a;
                t = xc;
            } else {
                ye = xe;
                t = yc;
            }

            t.reverse();
            for (b = a; b--; t.push(0)) {
            }
            t.reverse();
        } else {

            // Exponents equal. Check digit by digit.
            j = ((xLTy = xc.length < yc.length) ? xc : yc).length;

            for (a = b = 0; b < j; b++) {

                if (xc[b] != yc[b]) {
                    xLTy = xc[b] < yc[b];
                    break;
                }
            }
        }

        // x < y? Point xc to the array of the bigger number.
        if (xLTy) {
            t = xc;
            xc = yc;
            yc = t;
            y.s = -y.s;
        }

        /*
         * Append zeros to xc if shorter. No need to add zeros to yc if shorter
         * as subtraction only needs to start at yc.length.
         */
        if (( b = (j = yc.length) - (i = xc.length) ) > 0) {

            for (; b--; xc[i++] = 0) {
            }
        }

        // Subtract yc from xc.
        for (b = i; j > a;) {

            if (xc[--j] < yc[j]) {

                for (i = j; i && !xc[--i]; xc[i] = 9) {
                }
                --xc[i];
                xc[j] += 10;
            }
            xc[j] -= yc[j];
        }

        // Remove trailing zeros.
        for (; xc[--b] === 0; xc.pop()) {
        }

        // Remove leading zeros and adjust exponent accordingly.
        for (; xc[0] === 0;) {
            xc.shift();
            --ye;
        }

        if (!xc[0]) {

            // n - n = +0
            y.s = 1;

            // Result must be zero.
            xc = [ye = 0];
        }

        y.c = xc;
        y.e = ye;

        return y;
    };


    /*
     * Return a new Big whose value is the value of this Big modulo the
     * value of Big y.
     */
    P.mod = function (y) {
        var yGTx,
            x = this,
            Big = x.constructor,
            a = x.s,
            b = (y = new Big(y)).s;

        if (!y.c[0]) {
            throwErr(NaN);
        }

        x.s = y.s = 1;
        yGTx = y.cmp(x) == 1;
        x.s = a;
        y.s = b;

        if (yGTx) {
            return new Big(x);
        }

        a = Big.DP;
        b = Big.RM;
        Big.DP = Big.RM = 0;
        x = x.div(y);
        Big.DP = a;
        Big.RM = b;

        return this.minus(x.times(y));
    };


    /*
     * Return a new Big whose value is the value of this Big plus the value
     * of Big y.
     */
    P.add = P.plus = function (y) {
        var t,
            x = this,
            Big = x.constructor,
            a = x.s,
            b = (y = new Big(y)).s;

        // Signs differ?
        if (a != b) {
            y.s = -b;
            return x.minus(y);
        }

        var xe = x.e,
            xc = x.c,
            ye = y.e,
            yc = y.c;

        // Either zero?
        if (!xc[0] || !yc[0]) {

            // y is non-zero? x is non-zero? Or both are zero.
            return yc[0] ? y : new Big(xc[0] ? x : a * 0);
        }
        xc = xc.slice();

        // Prepend zeros to equalise exponents.
        // Note: Faster to use reverse then do unshifts.
        if (a = xe - ye) {

            if (a > 0) {
                ye = xe;
                t = yc;
            } else {
                a = -a;
                t = xc;
            }

            t.reverse();
            for (; a--; t.push(0)) {
            }
            t.reverse();
        }

        // Point xc to the longer array.
        if (xc.length - yc.length < 0) {
            t = yc;
            yc = xc;
            xc = t;
        }
        a = yc.length;

        /*
         * Only start adding at yc.length - 1 as the further digits of xc can be
         * left as they are.
         */
        for (b = 0; a;) {
            b = (xc[--a] = xc[a] + yc[a] + b) / 10 | 0;
            xc[a] %= 10;
        }

        // No need to check for zero, as +x + +y != 0 && -x + -y != 0

        if (b) {
            xc.unshift(b);
            ++ye;
        }

        // Remove trailing zeros.
        for (a = xc.length; xc[--a] === 0; xc.pop()) {
        }

        y.c = xc;
        y.e = ye;

        return y;
    };


    /*
     * Return a Big whose value is the value of this Big raised to the power n.
     * If n is negative, round, if necessary, to a maximum of Big.DP decimal
     * places using rounding mode Big.RM.
     *
     * n {number} Integer, -MAX_POWER to MAX_POWER inclusive.
     */
    P.pow = function (n) {
        var x = this,
            one = new x.constructor(1),
            y = one,
            isNeg = n < 0;

        if (n !== ~~n || n < -MAX_POWER || n > MAX_POWER) {
            throwErr('!pow!');
        }

        n = isNeg ? -n : n;

        for (; ;) {

            if (n & 1) {
                y = y.times(x);
            }
            n >>= 1;

            if (!n) {
                break;
            }
            x = x.times(x);
        }

        return isNeg ? one.div(y) : y;
    };


    /*
     * Return a new Big whose value is the value of this Big rounded to a
     * maximum of dp decimal places using rounding mode rm.
     * If dp is not specified, round to 0 decimal places.
     * If rm is not specified, use Big.RM.
     *
     * [dp] {number} Integer, 0 to MAX_DP inclusive.
     * [rm] 0, 1, 2 or 3 (ROUND_DOWN, ROUND_HALF_UP, ROUND_HALF_EVEN, ROUND_UP)
     */
    P.round = function (dp, rm) {
        var x = this,
            Big = x.constructor;

        if (dp == null) {
            dp = 0;
        } else if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
            throwErr('!round!');
        }
        rnd(x = new Big(x), dp, rm == null ? Big.RM : rm);

        return x;
    };


    /*
     * Return a new Big whose value is the square root of the value of this Big,
     * rounded, if necessary, to a maximum of Big.DP decimal places using
     * rounding mode Big.RM.
     */
    P.sqrt = function () {
        var estimate, r, approx,
            x = this,
            Big = x.constructor,
            xc = x.c,
            i = x.s,
            e = x.e,
            half = new Big('0.5');

        // Zero?
        if (!xc[0]) {
            return new Big(x);
        }

        // If negative, throw NaN.
        if (i < 0) {
            throwErr(NaN);
        }

        // Estimate.
        i = Math.sqrt(x.toString());

        // Math.sqrt underflow/overflow?
        // Pass x to Math.sqrt as integer, then adjust the result exponent.
        if (i === 0 || i === 1 / 0) {
            estimate = xc.join('');

            if (!(estimate.length + e & 1)) {
                estimate += '0';
            }

            r = new Big(Math.sqrt(estimate).toString());
            r.e = ((e + 1) / 2 | 0) - (e < 0 || e & 1);
        } else {
            r = new Big(i.toString());
        }

        i = r.e + (Big.DP += 4);

        // Newton-Raphson iteration.
        do {
            approx = r;
            r = half.times(approx.plus(x.div(approx)));
        } while (approx.c.slice(0, i).join('') !==
        r.c.slice(0, i).join(''));

        rnd(r, Big.DP -= 4, Big.RM);

        return r;
    };


    /*
     * Return a new Big whose value is the value of this Big times the value of
     * Big y.
     */
    P.mul = P.times = function (y) {
        var c,
            x = this,
            Big = x.constructor,
            xc = x.c,
            yc = (y = new Big(y)).c,
            a = xc.length,
            b = yc.length,
            i = x.e,
            j = y.e;

        // Determine sign of result.
        y.s = x.s == y.s ? 1 : -1;

        // Return signed 0 if either 0.
        if (!xc[0] || !yc[0]) {
            return new Big(y.s * 0);
        }

        // Initialise exponent of result as x.e + y.e.
        y.e = i + j;

        // If array xc has fewer digits than yc, swap xc and yc, and lengths.
        if (a < b) {
            c = xc;
            xc = yc;
            yc = c;
            j = a;
            a = b;
            b = j;
        }

        // Initialise coefficient array of result with zeros.
        for (c = new Array(j = a + b); j--; c[j] = 0) {
        }

        // Multiply.

        // i is initially xc.length.
        for (i = b; i--;) {
            b = 0;

            // a is yc.length.
            for (j = a + i; j > i;) {

                // Current sum of products at this digit position, plus carry.
                b = c[j] + yc[i] * xc[j - i - 1] + b;
                c[j--] = b % 10;

                // carry
                b = b / 10 | 0;
            }
            c[j] = (c[j] + b) % 10;
        }

        // Increment result exponent if there is a final carry.
        if (b) {
            ++y.e;
        }

        // Remove any leading zero.
        if (!c[0]) {
            c.shift();
        }

        // Remove trailing zeros.
        for (i = c.length; !c[--i]; c.pop()) {
        }
        y.c = c;

        return y;
    };


    /*
     * Return a string representing the value of this Big.
     * Return exponential notation if this Big has a positive exponent equal to
     * or greater than Big.E_POS, or a negative exponent equal to or less than
     * Big.E_NEG.
     */
    P.toString = P.valueOf = P.toJSON = function () {
        var x = this,
            Big = x.constructor,
            e = x.e,
            str = x.c.join(''),
            strL = str.length;

        // Exponential notation?
        if (e <= Big.E_NEG || e >= Big.E_POS) {
            str = str.charAt(0) + (strL > 1 ? '.' + str.slice(1) : '') +
                (e < 0 ? 'e' : 'e+') + e;

            // Negative exponent?
        } else if (e < 0) {

            // Prepend zeros.
            for (; ++e; str = '0' + str) {
            }
            str = '0.' + str;

            // Positive exponent?
        } else if (e > 0) {

            if (++e > strL) {

                // Append zeros.
                for (e -= strL; e--; str += '0') {
                }
            } else if (e < strL) {
                str = str.slice(0, e) + '.' + str.slice(e);
            }

            // Exponent zero.
        } else if (strL > 1) {
            str = str.charAt(0) + '.' + str.slice(1);
        }

        // Avoid '-0'
        return x.s < 0 && x.c[0] ? '-' + str : str;
    };


    /*
     ***************************************************************************
     * If toExponential, toFixed, toPrecision and format are not required they
     * can safely be commented-out or deleted. No redundant code will be left.
     * format is used only by toExponential, toFixed and toPrecision.
     ***************************************************************************
     */


    /*
     * Return a string representing the value of this Big in exponential
     * notation to dp fixed decimal places and rounded, if necessary, using
     * Big.RM.
     *
     * [dp] {number} Integer, 0 to MAX_DP inclusive.
     */
    P.toExponential = function (dp) {

        if (dp == null) {
            dp = this.c.length - 1;
        } else if (dp !== ~~dp || dp < 0 || dp > MAX_DP) {
            throwErr('!toExp!');
        }

        return format(this, dp, 1);
    };


    /*
     * Return a string representing the value of this Big in normal notation
     * to dp fixed decimal places and rounded, if necessary, using Big.RM.
     *
     * [dp] {number} Integer, 0 to MAX_DP inclusive.
     */
    P.toFixed = function (dp) {
        var str,
            x = this,
            Big = x.constructor,
            neg = Big.E_NEG,
            pos = Big.E_POS;

        // Prevent the possibility of exponential notation.
        Big.E_NEG = -(Big.E_POS = 1 / 0);

        if (dp == null) {
            str = x.toString();
        } else if (dp === ~~dp && dp >= 0 && dp <= MAX_DP) {
            str = format(x, x.e + dp);

            // (-0).toFixed() is '0', but (-0.1).toFixed() is '-0'.
            // (-0).toFixed(1) is '0.0', but (-0.01).toFixed(1) is '-0.0'.
            if (x.s < 0 && x.c[0] && str.indexOf('-') < 0) {
                //E.g. -0.5 if rounded to -0 will cause toString to omit the minus sign.
                str = '-' + str;
            }
        }
        Big.E_NEG = neg;
        Big.E_POS = pos;

        if (!str) {
            throwErr('!toFix!');
        }

        return str;
    };


    /*
     * Return a string representing the value of this Big rounded to sd
     * significant digits using Big.RM. Use exponential notation if sd is less
     * than the number of digits necessary to represent the integer part of the
     * value in normal notation.
     *
     * sd {number} Integer, 1 to MAX_DP inclusive.
     */
    P.toPrecision = function (sd) {

        if (sd == null) {
            return this.toString();
        } else if (sd !== ~~sd || sd < 1 || sd > MAX_DP) {
            throwErr('!toPre!');
        }

        return format(this, sd - 1, 2);
    };


    // Export


    Big = bigFactory();

    //AMD.
    if (typeof define === 'function' && define.amd) {
        define(function () {
            return Big;
        });

        // Node and other CommonJS-like environments that support module.exports.
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = Big;

        //Browser.
    } else {
        global.Big = Big;
    }
})(this);
var ConvertJson = function() {

    "use strict";

    var NS = "http://www.w3.org/2005/xpath-functions";

    function checkOption(options, opt, type, dflt, allowed) {
        var key = Atomic.string.fromString(opt);
        if (options && options.containsKey(key)) {
            var val = options.get(key);
            if (type == "function") {
                throw XError("Option " + key + " must be a function", "XPTY0004");
            }
            if (val.length == 1 && Atomic[type].matches(val[0])) {
                if (allowed && allowed.indexOf(val[0].value) < 0) {
                    throw XError("Invalid value " + key + "=" + val[0], "FOJS0005");
                }
                return val[0].value;
            } else {
                throw XError("Invalid option: " + opt + ": must be " + type, "XPTY0004");
            }
        } else {
            return dflt;
        }
    }


    function parse(input, options, handler) {
        //print("parse JSON: " + input);
        var position = 0, currentTok = nextToken();

        function error(m) {
            throw XError(m, "FOJS0001");
        }

        function nextToken() {
            currentTok = readToken();
            return currentTok;
        }

        function readToken() {
            var c, ch;
            currentTok = "";
            while (true) {
                if (position >= input.length) {
                    return ["eof"];
                }
                ch = input.charAt(position++);
                if (!/[ \n\r\t]/.test(ch)) {
                    break;
                }
            }

            switch (ch) {
                case '[':
                case '{':
                case ']':
                case '}':
                case ':':
                case ',':
                    return [ch];
                case '"':
                    var afterBackslash = false;
                    while (true) {
                        c = input.charAt(position++);
                        if (c == '"' && !afterBackslash) {
                            return ["string", currentTok];
                        } else {
                            currentTok += c;
                            afterBackslash = c == '\\' && !afterBackslash;
                        }
                        if (position >= input.length) {
                            error("Unclosed quotes in string literal");
                        }
                    }
                    return ["string", currentTok];

                case '-':
                case '0':
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                case '6':
                case '7':
                case '8':
                case '9':
                    currentTok += ch;
                    while (position < input.length) {
                        c = input.charAt(position++);
                        if (/[0-9\-+\.eE]/.test(c)) {
                            currentTok += c;
                        } else {
                            position--;
                            break;
                        }
                    }
                    return ["number", validNumber(currentTok)];
                case 't':
                case 'f':
                case 'n':
                    currentTok += ch;
                    while (true) {
                        c = input.charAt(position);
                        if (c >= 'a' && c <= 'z') {
                            currentTok += c;
                            if (++position >= input.length) {
                                break;
                            }
                        } else {
                            break;
                        }
                    }
                    if (/^(true|false|null)$/.test(currentTok)) {
                        return [currentTok];
                    } else {
                        error("Unknown constant " + currentTok);
                    }
                    break;
                default:
                    error("Unexpected character '" + ch + "' (" +
                        Expr.stringToCodepoints(ch) + ") at position " + position);
                    return -1;
            }
        }

        function validNumber(num) {
            return /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(num) ? num : error("Invalid JSON number " + num);
        }

        function expect(tok) {
            if (currentTok[0] !== tok) {
                error("Expected " + tok + ", found " + currentTok[0]);
            }
        }

        function at(tok) {
            if (currentTok[0] === tok) {
                nextToken();
                return true;
            } else {
                return false;
            }
        }

        function testEnd(closer) {
            if (currentTok[0] === closer) {
                nextToken();
                return true;
            }
            if (currentTok[0] === ",") {
                nextToken();
                return false;
            }
            error("Expected ',' or '" + closer + "', found '" + currentTok[0] + "'");
        }

        function parseConstruct() {
            switch (currentTok[0]) {
                case "[":
                    nextToken();
                    parseArray();
                    break;
                case "{":
                    nextToken();
                    parseObject();
                    break;
                case "string":
                    handler.emitString(currentTok[1]);
                    nextToken();
                    break;
                case "number":
                    handler.emitNumber(currentTok[1]);
                    nextToken();
                    break;
                case "true":
                case "false":
                    handler.emitBoolean(currentTok[0]);
                    nextToken();
                    break;
                case "null":
                    handler.emitNull();
                    nextToken();
                    break;
                default:
                    error("Unexpected token " + currentTok[0]);
            }
        }

        function parseArray() {
            handler.startArray();
            if (!at("]")) {
                do {
                    parseConstruct();
                } while (!testEnd("]"));
            }
            handler.endArray();
        }

        function parseObject() {
            handler.startMap();
            if (!at("}")) {
                do {
                    expect("string");
                    handler.emitKey(currentTok[1]);
                    nextToken();
                    expect(":");
                    nextToken();
                    parseConstruct();
                } while (!testEnd("}"));
            }
            handler.endMap();
        }

        parseConstruct();
        expect("eof");
        //print("result: " + showValue(handler.result()));
        return handler.result();
    }

    function unEscape(str) {
        try {
            return JSON.parse('"' + str + '"');
        } catch (e) {
            throw XError(e.toString(), "FOJS0001");
        }
    }

    var badChars = /[\x00-\x08\x0B\x0C\x0E-\x0F\x80-\x9F]/;  // TODO: and others

    function removeBadChars(str) {
        return str.replace(badChars, "\uFFFD").replace(/[\uD800-\uDFFF]+/g, function(s) {
            // s is a sequence of surrogates. If a high surrogate appears at an even position, or a low surrogate
            // at an odd position, leave it alone; otherwise replace it with a substitute character
            var t = "";
            for (var i = 0; i < s.length; i++) {
                var c = s.charAt(i);
                t += (i % 2 == (c < "\uDC00")) || (i == s.length - 1 && c < "\uDC00") ? "\uFFFD" : c;
            }
            return t;
        });
    }

    function escapeCharToUnicode(char) {
        var code = char.charCodeAt(0).toString(16);
        while (code.length < 4) {
            code = "0" + code;
        }
        return "\\u" + code.toUpperCase();
    }

    function MapHandler(options) {
        this._valStack = [];
        this._keyStack = [];
        checkOption(options, "liberal", "boolean", false);
        this._escape = checkOption(options, "escape", "boolean", false);
        this._duplicates = checkOption(options, "duplicates", "string", "use-first", ["reject", "use-first", "use-last"]);
    }

    MapHandler.prototype = {
        _valStack: [],
        _keyStack: [],
        _optionsMap: {},
        //_options: null,
        _escape: false,
        _duplicates: "use-first", // or use-last or reject

        reEscape: function(str) {
            //print("reEscape " + str + " escaping " + this._escape);
            if (this._escape) {
                return JSON.stringify(str).replace(/^"|"$/g, "").replace(/\\"/g, "\"").replace(/[\uD800-\uDFFF]/g, escapeCharToUnicode);
            } else {
                return removeBadChars(str);
            }
        },

        peek: function() {
            return this._valStack[this._valStack.length - 1];
        },

        writeItem: function(val) {
            if (this._valStack.length === 0) {
                this._valStack.push(val);
            } else if (this.peek() instanceof Expr.XdmArray) {
                this.peek().value.push(val);
            } else {
                var map = this.peek();
                var key = Atomic.string.fromString(this._keyStack.pop());
                if (map.containsKey(key)) {
                    //print("duplicate key, duplicates = " + this._duplicates);
                    switch (this._duplicates) {
                        case "reject":
                            throw XError("json-to-xml: duplicate key '" + key.toString() + "'", "FOJS0003");
                        case "use-first":
                            return; // no action
                    }
                }
                // not a duplicate, or duplicates=use-last
                map.inSituPut(key, val);
            }
        },

        emitNull: function() {
            this.writeItem([]);
        },

        emitBoolean: function(bool) {
            this.writeItem([Atomic.boolean.fromString(bool)]);
        },

        emitNumber: function(num) {
            this.writeItem([Atomic.double.fromNumber(parseFloat(num))]);
        },

        emitString: function(str) {
            this.writeItem([Atomic.string.fromString(this.reEscape(unEscape(str)))]);
        },

        emitKey: function(str) {
            this._keyStack.push(this.reEscape(unEscape(str)));
        },

        startArray: function() {
            this._valStack.push(new Expr.XdmArray([]));
        },

        endArray: function() {
            this.writeItem([this._valStack.pop()]);
        },

        startMap: function() {
            this._valStack.push(new HashTrie());
        },

        endMap: function () {
            this.writeItem([this._valStack.pop()]);
        },

        result: function () {
            //print("result: " + showValue(this.peek()[0]));
            return this.peek()[0] !== undefined ? this.peek()[0]: null;
        }


    };

    function XmlHandler(options, context) {
        this._valStack = [];
        this._keyStack = [];
        this._mapStack = [];
        this._context = context;
        checkOption(options, "liberal", "boolean", false);
        checkOption(options, "validate", "boolean", false);
        checkOption(options, "fallback", "function");
        this._escape = checkOption(options, "escape", "boolean", false);
        this._duplicates = checkOption(options, "duplicates", "string", "use-first", ["reject", "use-first", "retain"]);
    }

    XmlHandler.prototype = {
        _valStack: [],
        _keyStack: [{}],
        _mapStack: [],
        _context: null,
        _optionsMap: {},
        //_options: null,
        _escape: false,
        _duplicates: "use-first", // or use-last or reject

        reEscape: function (str) {
            //print("reEscape " + str + " escaping " + this._escape);
            if (this._escape) {
                return JSON.stringify(str).replace(/^"|"$/g, "").replace(/\\"/g, "\"").replace(/[\uD800-\uDFFF]/g, escapeCharToUnicode);
            } else {
                return removeBadChars(str);
            }
        },

        peek: function () {
            return this._valStack[this._valStack.length - 1];
        },

        writeItem: function (val) {
            if (this._valStack.length === 0) {
                val.setAttributeNS("", "xmlns", NS);
                this._valStack.push(val);
            } else {
                var parent = this.peek();
                if (parent.tagName == "map") {
                    var key = this._keyStack.pop();
                    //print("pop key " + key + " level=" + this._keyStack.length);
                    var map = this._mapStack[this._mapStack.length - 1];
                    //print("look in map level " + this._mapStack.length);
                    if (key in map) {
                        //print("duplicate key " + key + ", duplicates = " + this._duplicates);
                        switch (this._duplicates) {
                            case "reject":
                                throw XError("parse-json: duplicate key '" + key.toString() + "'", "FOJS0003");
                            case "use-first":
                                return; // no action
                        }
                    }
                    // not a duplicate, or duplicates=retain
                    map[key] = val;
                    val.setAttribute("key", key);
                    if (this._escape && /\\/.test(key.toString())) {
                        val.setAttribute("escaped-key", "true");
                    }
                }
                parent.appendChild(val);
            }
        },

        emitNull: function () {
            var elemNode = this._context.resultDocument.createElementNS(NS, "null");
            this.writeItem(elemNode);
        },

        emitBoolean: function (bool) {
            var elemNode = this._context.resultDocument.createElementNS(NS, "boolean");
            var child = this._context.resultDocument.createTextNode(bool.toString());
            elemNode.appendChild(child);
            this.writeItem(elemNode);
        },

        emitNumber: function (num) {
            var elemNode = this._context.resultDocument.createElementNS(NS, "number");
            var child = this._context.resultDocument.createTextNode(num.toString());
            elemNode.appendChild(child);
            this.writeItem(elemNode);
        },

        emitString: function (str) {
            var elemNode = this._context.resultDocument.createElementNS(NS, "string");
            if (str !== "") {
                var strE = this.reEscape(unEscape(str));
                var child = this._context.resultDocument.createTextNode(strE);
                if (this._escape  && /\\/.test(strE)) {
                    elemNode.setAttribute("escaped", "true");
                }
                elemNode.appendChild(child);
            }
            this.writeItem(elemNode);
        },

        emitKey: function (str) {
            //print("push key " + str);
            this._keyStack.push(this.reEscape(unEscape(str)));
        },

        startArray: function () {
            var elemNode = this._context.resultDocument.createElementNS(NS, "array");
            this._valStack.push(elemNode);
        },

        endArray: function () {
            this.writeItem(this._valStack.pop());
        },

        startMap: function () {
            var elemNode = this._context.resultDocument.createElementNS(NS, "map");
            this._valStack.push(elemNode);
            this._mapStack.push({});
            //print("push map");
        },

        endMap: function () {
            this._mapStack.pop();
            //print("pop map");
            this.writeItem(this._valStack.pop());
        },

        result: function () {
            //print("result: " + showValue(this.peek()[0]));
            return this.peek();
        }

    };

    function xmlToJson(node, options) {
        var DU = DomUtils;

        checkOption(options, "indent", "boolean", false);

        function bad(reason) {
            throw new XError("Invalid input to xml-to-json(): " + reason, "FOJS0006");
        }

        function checkLeaf(node) {
            if (DU.getChildElements(node).length !== 0) {
                bad("node " + node.tagName + " must have no element children");
            }
        }

        function checkNoText(node) {
            if (Axis.child(node).filter(function (c) {
                    return c.nodeType == DU.TEXT_NODE && c.nodeValue && Regex.trim(c.nodeValue) !== "";
                }).next()) {
                bad("node " + node.tagName + " must have no text content");
            }
        }

        function checkBoolean(str) {
            try {
                return Atomic.boolean.fromString(str).toBoolean();
            } catch (e) {
                bad("invalid boolean: '" + str + "'");
            }
        }

        function checkEscaping(str) {
            try {
                JSON.parse('"' + str + '"');
            } catch (e) {
                throw XError("invalid escape sequence: " + e.toString(), "FOJS0007");
            }
        }

        function j(node) {
            //print("xml-to-json: " + showValue(node));
            if (node.nodeType == DU.DOCUMENT_NODE || node.nodeType == DU.DOCUMENT_FRAGMENT_NODE) {
                var kids = DU.getChildElements(node);
                if (kids.length != 1) {
                    bad("document node has " + kids.length + " element children");
                }
                return j(kids[0]);
            } else if (node.nodeType == DU.ELEMENT_NODE) {
                var escaped = false;
                if (node.namespaceURI == NS) {
                    Axis.attribute(node).forEachItem(function (a) {
                        if (a.name.indexOf(":") < 0 || a.namespaceURI == NS) {
                            if (a.name == "key" || a.name == "escaped-key") {
                                if (!DU.xdmParentNode(node) || DU.xdmParentNode(node).localName != "map") {
                                    bad("@key/@escaped-key are allowed only on children of map");
                                }
                                if (a.name == "escaped-key") {
                                    var escapedKey = checkBoolean(a.value);
                                    if (escapedKey) {
                                        checkEscaping(node.getAttribute("key"));
                                    }
                                }
                            } else if (a.name == "escaped") {
                                if (node.localName != "string") {
                                    bad("@escaped is allowed only on string");
                                }
                                escaped = checkBoolean(a.value);
                            } else {
                                bad("invalid attribute " + a.name);
                            }
                        }
                    });
                    if ((node.hasAttribute("key") || node.hasAttribute("escaped-key")) &&
                        (!DU.xdmParentNode || DU.xdmParentNode.localName == "map")) {
                        bad("key/escaped-key are allowed only on children of map");
                    }
                    switch (node.localName) {
                        case "null":
                            if (Axis.child(node).filter(function (c) {
                                    return c.nodeType != DU.COMMENT_NODE && c.nodeType != DU.PROCESSING_INSTRUCTION_NODE;
                                }).next()) {
                                bad("null element must have no content");
                            }
                            return "null";
                        case "string":
                            checkLeaf(node);
                            var str = node.textContent;
                            //print("str/escaped: " + escaped);
                            if (escaped) {
                                // "any unescaped occurrence of quotation mark, backspace, form-feed, newline, carriage
                                // return, tab, or solidus is replaced by ..."
                                // Note that in JS, \b matches a word boundary, instead [\b] should be used to match a backspace
                                str = str.replace(/^"/g, "\\\"")
                                    .replace(/^[\b]/g, "\\b")
                                    .replace(/^\f/g, "\\f")
                                    .replace(/^\n/g, "\\n")
                                    .replace(/^\r/g, "\\r")
                                    .replace(/^\t/g, "\\t")
                                    .replace(/^\//g, "\\/")
                                    .replace(/([^\\])"/g, "$1\\\"")
                                    .replace(/([^\\])[\b]/g, "$1\\b")
                                    .replace(/([^\\])\f/g, "$1\\f")
                                    .replace(/([^\\])\n/g, "$1\\n")
                                    .replace(/([^\\])\r/g, "$1\\r")
                                    .replace(/([^\\])\t/g, "$1\\t")
                                    .replace(/([^\\])\//g, "$1\\/")
                                    .replace(/[\u0001-\u001F\u007F-\u009F]/g, escapeCharToUnicode);
                                checkEscaping(str);
                            } else {
                                // Apparently stringify does most of the right escaping...
                                //print("str=" + str + "stringify=" + JSON.stringify(str));
                                return JSON.stringify(str).replace(/\//g, "\\/");
                            }
                            return '"' + str + '"';
                        case "number":
                            checkLeaf(node);
                            var d;
                            try {
                                d = Atomic.double.fromString(node.textContent);
                            } catch (e) {
                                bad("invalid number");
                            }
                            if (!isFinite(d.toNumber())) {
                                bad("NaN and INF not allowed");
                            }
                            return d.toString();
                        case "boolean":
                            checkLeaf(node);
                            checkBoolean(node.textContent);
                            return Atomic.boolean.fromString(node.textContent).toString();
                        case "array":
                            checkNoText(node);
                            var aout = "[";
                            var asep = "";
                            DU.getChildElements(node).forEach(function (e) {
                                aout += (asep + j(e));
                                asep = ",";
                            });
                            return aout + "]";
                        case "map":
                            checkNoText(node);
                            var mout = "{";
                            var msep = "";
                            var keys = {};
                            DU.getChildElements(node).forEach(function (e) {
                                if (!e.hasAttribute("key")) {
                                    bad("child element of map must have a key");
                                }
                                var k = DU.getAttribute(e, "key"); 
                                var kNorm = k;
                                var esck = DU.getAttribute(e, "escaped-key");
                                var esc = false;
                                if (esck && checkBoolean(esck)) {
                                    esc = true;
                                    kNorm = unEscape(k);
                                }
                                if (keys[kNorm]) {
                                    bad("duplicate key '" + k + "'");
                                }
                                // put the normalized key in keys
                                keys[kNorm] = true;
                                // if escaped-key=true, put the original key in mout, else the key escaped (as defined in spec)
                                mout += msep + (esc ? '"' + k + '"' : JSON.stringify(k).replace(/\//g, "\\/")) + ':' + j(e);
                                msep = ",";
                            });
                            return mout + "}";
                        default:
                            bad("unknown local name " + node.localName);
                    }
                } else {
                    bad("wrong namespace " + node.namespaceURI);
                }
            } else {
                if (!DU.isNode(node)) {
                    print("Not a node " + showValue(node));
                    bad("not a node");
                }
                Error.dumpStack();
                bad("wrong node kind " + node.nodeType);
            }
        }

        return j(node);

    }

    return {
        parseToMap: function(str, options) {
            return parse(str, options, new MapHandler(options));
        },
        parseToXml: function(str, options, context) {
            return parse(str, options, new XmlHandler(options, context));
        },
        xmlToJson: xmlToJson
    };

}();
    
    //# include lib/xpath/XPath.js


    var platform = {
    };

    var inBrowser = typeof window !== "undefined";

    /* Sets the platform and calls its initialize method - which loads polyfill methods, and calls Atomic._init. */
    function initialize() {
        "use strict";
        if (inBrowser) {
            console.log("Saxon-JS " + getProcessorInfo().productVersion + " in browser");
            setPlatform(BrowserPlatform.platform);
        } else {
            // TODO how is Nashorn distinguished from Node case ?
            // Nashorn JSTestDriver
            print("Saxon-JS " + getProcessorInfo().productVersion + " in Nashorn");
            setPlatform(JSTestDriver.platform);

            // node NodePlatform
        }

        if (typeof platform.initialize === "function") {
            platform.initialize();
        }
    }

    function setPlatform(caller) {
        "use strict";
        platform = caller;
    }

    var saxonVersion = null;

    /* Gets the version of Saxon-EE used to produce the SEF (as called by the SaxonJS.transform method).
     * Value is taken from the metadata (on the package element) if present, else defaults to "9.7.0.7".
     * Remains null if using Saxon-JS without an SEF. */
    function getSaxonVersion() {
        return saxonVersion;
    }

    var spaceStripper = null;
    var relocatable;
    
    /* The spaceStripper modifies the source tree, to remove whitespace text nodes as defined by the xsl:strip-space
     * declaration (parameter decl), and also to replace CDATA nodes by text nodes. */
    
    function makeSpaceStripper(decl) {
        "use strict";
        /*jslint evil: true */
        var isStripped = new Function ('uri', 'local', decl ? decl.getAttribute("test"): "return false");
        
        function stripSpaces(node) {
            switch (node.nodeType) {
                case DomUtils.DOCUMENT_NODE: {
                    stripSpaces(node.documentElement);
                    break;
                }
                case DomUtils.DOCUMENT_FRAGMENT_NODE:
                case DomUtils.ELEMENT_NODE: {
                    var name = DomUtils.nameOfNode(node);
                    var xmlsp = DomUtils.getInheritedAttribute(node, "xml:space");
                    var strip = isStripped(name.uri, name.local) && !(xmlsp && xmlsp == "preserve");
                    var children = node.childNodes;
                    var i = 0;
                    while (i < children.length) {
                        var child = children[i];
                        if (child.nodeType == DomUtils.CDATA_SECTION) {
                            var newChild = DomUtils.ownerDocument(node).createTextNode(child.nodeValue);
                            node.replaceChild(newChild, child);
                            child = newChild;
                        }
                        if (child.nodeType == DomUtils.TEXT_NODE) {
                            if (strip && Regex.trim(child.nodeValue) === "") {
                                /* removing a child reduces the childNodes array length - hence we don't change the index */
                                node.removeChild(child);
                            } else {
                                i++;
                            }
                        } else {
                            stripSpaces(child);
                            i++;
                        }
                    }
                    break;
                }
            }
        }
        
        return function (doc) {
            stripSpaces(doc);
            return doc;
        };
    }
    
    function applyStylesheet(stylesheet, sourceDoc, options) {
        "use strict";
        // See if there are any space-stripping rules
        
        var stripDecl = Axis.child(stylesheet.documentElement).filter(
        function (node) {
            return node.tagName == "stripJS";
        }).next();
        spaceStripper = makeSpaceStripper(stripDecl);
        
        if (sourceDoc && spaceStripper) {
            sourceDoc = spaceStripper(sourceDoc);
        }
        // WIP
        options.saxonVersion = getSaxonVersion();
        
        var context = initializeContext(stylesheet, sourceDoc, options);
        if (sourceDoc) {
            DomUtils.obtainDocumentNumber(sourceDoc);
            var sourceUri = sourceDoc._saxonDocumentUri;
            //print("Adding " + sourceUri + " to doc pool (doc " + sourceDoc._saxonDocumentNumber + ")");
            context.fixed.documentPool[sourceUri] = sourceDoc;
            sourceDoc._saxonBaseUri = sourceUri;
        }

        var destination = options.destination;
        if (destination && ! /^(appendToBody|prependToBody|replaceBody|application)$/.test(destination)) {
            print("Warning: supplied transformation option not recognised - destination: " + destination);
        }
        if (inBrowser && destination && /^(appendToBody|prependToBody|replaceBody)$/.test(destination)) {
            context.resultDocument = window.document;
        }
        // else for destination = application (the default), this is not set.
        // What happens to the principal result in this case?
        // TODO Does this cause problems for secondary result documents?
        //print("destination: " + destination);
        
        var output;
        
        // initial-template : the initial template name as an EQName
        var initialTemplate = options.initialTemplate;
        if (initialTemplate && initialTemplate.indexOf("Q{") < 0) {
            initialTemplate = "Q{}" + initialTemplate;
        }
        
        // initial-mode : the initial mode name as an EQName
        var initialMode = options.initialMode;
        if (!initialMode) {
            initialMode = "";
        } else if (initialMode !== "" && initialMode.substring(0, 2) != ("Q{")) {
            initialMode = "Q{}" + initialMode;
        }
        //print("Initial mode = " + initialMode);
        
        
        if (initialTemplate) {
            var template = context.fixed.namedTemplates[initialTemplate];
            if (! template) {
                throw XError("Unknown initial template " + initialTemplate, "XTDE0040");
            }
            if (context.fixed.globalContextItem) {
                //print("Initial context " + showValue(sourceDoc));
                context.focus = Iter.Tracker(Iter.Singleton(sourceDoc));
                context.focus.next();
            } else {
                context.focus = Iter.Tracker(Iter.Empty);
                context.focus.next();
                //print("No initial context");
            }
            output = Expr.evalChild1(template, context);
        } else {
            
            var entryMode = context.fixed.modes[initialMode];
            if (! entryMode) {
                throw XError("Unknown initial mode " + initialMode, "XTDE0045");
            }
            if (! sourceDoc) {
                throw XError("No source document, initial template, or initial mode supplied", "SXJS0006");
            }
            //print(entryMode.printRules());
            context.focus = Iter.Tracker(Iter.Singleton(sourceDoc));
            output = entryMode.applyTemplates(context);
        }

        //output = Iter.trace("Transform Output: ", output, true);
        Expr.makeComplexContent(context.resultRoot, output, context);

        var principal = Axis.child(context.resultRoot);
        if (principal) {
            if (inBrowser) {
                var body = window.document.body;
                if (destination == "appendToBody") {
                    principal.forEachItem(function (item) {
                        body.appendChild(item);
                    });
                } else if (destination == "prependToBody") {
                    var bodyFirst = body.firstChild;
                    principal.forEachItem(function (item) {
                        body.insertBefore(item, bodyFirst);
                    });
                } else if (destination == "replaceBody") {
                    while (body.childNodes.length > 0) {
                        body.removeChild(body.childNodes[0]);
                    }
                    principal.forEachItem(function (item) {
                        body.appendChild(item);
                    });
                } else {
                    options.principalResult = context.resultRoot;
                }
            } else {
                options.principalResult = context.resultRoot;
            }
        }
        
        if (inBrowser) {
            registerEventListeners(context);
        }
    }
    
    function transform(options, callback) {
        "use strict";

        function listProps(options) {
            var result = "";
            for (var i in options) {
                if (options.hasOwnProperty(i)){
                    result += i + ", ";
                }
            }
            return result;
        }
        print("Transform options supplied: " + listProps(options));
        
        // Options is an object (map) that can include:
        //
        // stylesheetNode - the stylesheet as a document node
        // stylesheetText - the stylesheet as lexical XML
        // stylesheetLocation - the URI of the stylesheet
        // stylesheetFileName - the file name of the stylesheet
        // stylesheetParams - object containing values of global stylesheet parameters

        // sourceNode - the source document as a document node
        // sourceText - the source document as lexical XML
        // sourceLocation - the URI of the source document
        // sourceFileName - the file name of the source document

        // initialTemplate - the initial template name as an EQName
        // initialMode - the initial mode name as an EQName
        
        // destination - determines what happens to the principal result tree from the transformation
        //    possible values: "replaceBody" | "appendToBody" | "prependToBody" | "application"

        // deliverMessage - a JavaScript function to process messages written using xsl:message
        
        if (! options.stylesheetParams) {
            options.stylesheetParams = {
            };
        }
        if (typeof platform.deliverMessage === "function") {
            platform.deliverMessage(options);
        }
        
        var stylesheet, sourceDoc;
        function go(style, source) {
            if (style === null) {
                throw XError("No stylesheet supplied", "SXJS0006");
            }
            checksum(style);
            applyStylesheet(style, source, options);
            if (callback) {
                callback(options.principalResult);
            }
        }
        
        if (inBrowser) {
            var arrayOfUris = [];
            if (options.stylesheetLocation) {
                arrayOfUris.push(options.stylesheetLocation);
            }
            if (options.sourceLocation) {
                arrayOfUris.push(options.sourceLocation);
            }
            stylesheet = options.stylesheetNode ? options.stylesheetNode : null;
            sourceDoc = options.sourceNode ? options.sourceNode :
                options.sourceText ? platform.parseXmlFromString(options.sourceText) : null;
            if (arrayOfUris.length === 0) {
                go(stylesheet, sourceDoc);
            } else {
                platform.asyncGetMultipleXml(arrayOfUris, function (docs) {
                    stylesheet = options.stylesheetLocation ? docs[options.stylesheetLocation] : stylesheet;
                    sourceDoc = options.sourceLocation ? docs[options.sourceLocation] : sourceDoc;
                    go(stylesheet, sourceDoc);
                });
            }
        } else {
            stylesheet = options.stylesheetNode;
            if (! stylesheet) {
                var stylesheetText = options.stylesheetText;
                if (! stylesheetText) {
                    var stylesheetFileName = options.stylesheetFileName;
                    if (! stylesheetFileName) {
                        throw XError("No stylesheet supplied", "SXJS0006");
                    }
                    stylesheetText = platform.readFile(stylesheetFileName);
                }
                stylesheet = platform.parseXmlFromString(stylesheetText);
            }
            sourceDoc = options.sourceNode;
            if (! sourceDoc) {
                var sourceText = options.sourceText;
                if (! sourceText) {
                    var sourceFileName = options.sourceFileName;
                    if (sourceFileName) {
                        sourceText = platform.readFile(sourceFileName);
                    }
                }
                if (sourceText) {
                    sourceDoc = platform.parseXmlFromString(sourceText);
                    sourceDoc._saxonDocumentUri = options.sourceLocation ? options.sourceLocation: options.sourceFileName;
                }
            }
            go(stylesheet, sourceDoc);
        }
    }

    function checksum(stylesheet) {
        "use strict";
        var checksum = 0;
        var seq = 0;

        function hashStr(s, seq) {
            var h = seq << 8;
            for (var i = 0; i < s.length; i++) {
                h = (h << 1) + s.charCodeAt(i);
            }
            return h;
        }

        function hashName(name, seq) {
            return hashStr(name.local, seq) ^ hashStr(name.uri, seq);
        }

        function doElem(node) {
            checksum ^= hashName(DomUtils.nameOfNode(node), seq++);
            //print("after start " + DomUtils.nameOfNode(node).local + " : " + checksum);
            Axis.attribute(node).forEachItem(function (att) {
                checksum ^= hashName(DomUtils.nameOfNode(att), seq);
                checksum ^= hashStr(att.value, seq);
                //print("after attribute " + DomUtils.nameOfNode(att).local + " : " + checksum);

            });
            Axis.child(node).filter(function (child) {
                return child.nodeType == DomUtils.ELEMENT_NODE;
            }).forEachItem(function (c) {
                doElem(c);
            });
            checksum ^= 1;
            //print("after end element: " + checksum);

        }
        var verified = false;
        Axis.child(stylesheet).forEachItem(function (child) {
            if (child.nodeType == DomUtils.ELEMENT_NODE) {
                // Check that SEF was generated with target JS
                if (DomUtils.nameOfNode(child).local == "package") {
                    var target = DomUtils.getAttribute(child, "target", "not specified");
                    saxonVersion = DomUtils.getAttribute(child, "saxonVersion", "9.7.0.7");
                    relocatable = DomUtils.getAttribute(child, "relocatable", "false");
                    print("SEF generated by Saxon-EE version " + saxonVersion + 
                        " with -target:" + target + " -relocate:" + relocatable);
                    if (saxonVersion != "9.7.0.7" && target != "JS") {
                        throw XError("Supplied SEF is not customized for use with Saxon-JS. The option -target:JS should " +
                            "be set when generating the export. target is: " + target, "SXJS0006");
                    }
                }
                doElem(child);
            } else if (child.nodeType == DomUtils.PROCESSING_INSTRUCTION_NODE && DomUtils.nameOfNode(child).local == String.fromCharCode(931)) {
                var actual = (checksum < 0 ? (0xFFFFFFFF + checksum + 1) : checksum).toString(16);
                if (actual == child.data) {
                    verified = true;
                } else {
                    throw XError("Invalid checksum in SEF " + child.data + " != " + actual, "SXJS0006");
                }
            }
        });
        if (!verified) {
            throw XError("No checksum found in SEF", "SXJS0006");
        }
    }


    function registerEventListeners(context) {
        "use strict";
        function register(mode, eventType) {
            //print("register " + eventType);
            var eventFn = function (event) {
                var target = event.target;
                /*var targetInfo = windowEvents.indexOf(eventType) == -1 ? target.tagName + " id=" + target.getAttribute("id") : target;
                print("notify " + eventType + " on " + targetInfo + ", isNode? " + DomUtils.isNode(target));*/
                var c2 = context.newContext(true);
                c2.currentEvent = event;
                c2.focus = Iter.Tracker(Iter.Singleton(Expr.convertFromJS(target)));
                //alert("calling ApplyTemplates");
                mode.applyTemplates(c2).expand();
                //force evaluation of the iterator
            };

            var windowEvents = ['afterprint', 'beforeprint', 'beforeunload', 'hashchange', 'languagechange', 'message',
                'offline', 'online', 'pagehide', 'pageshow', 'popstate', 'storage', 'unhandledrejection', 'unload'];
            if (windowEvents.indexOf(eventType) == -1) {
                window.document.addEventListener(eventType, eventFn, false);
            } else {
                window.addEventListener(eventType, eventFn, false);
            }
        }
        
        var modes = context.fixed.modes;
        for (var mName in modes) {
            if (modes.hasOwnProperty(mName)) {
                var parts = mName.split("}");
                if (parts[0] == "Q{http://saxonica.com/ns/interactiveXSLT") {
                    register(modes[mName], parts[1].replace(/^on/, ""));
                }
            }
        }
    }
    
    
    var timeStamp =
        inBrowser && window.performance && window.performance.now ? window.performance.now: function () {
        return Date.now().valueOf();
    };
    
    function initializeContext(stylesheet, sourceDoc, options) {
        "use strict";
        
        // Get all elements with a given name, and apply a function to each
        function forAll(name, fn) {
            Axis.descendant(stylesheet).filter(function (node) {
                return node.nodeType == DomUtils.ELEMENT_NODE && node.tagName == name;
            }).forEachItem(fn);
        }
        
        function eqname(element) {
            var a = DomUtils.getAttribute(element, "name");
            return a ? (/^Q\{/.test(a)) ? a: ("Q{}" + a) : null;
        }
        
        var context = new Context();
        context.fixed = {
            options: options,
            stylesheet: stylesheet,
            globalContextItem: sourceDoc,
            globalVars: {
            },
            namedTemplates: {
            },
            modes: {
            },
            userFunctions: {
            },
            attributeSets: {
            },
            keys: {
            },
            decimalFormats: {
            },
            resultDocUris: {
            },
            _nextDocumentNumber: 0,
            currentDate: {
            }
        };
        
        //print("Global context item = " + context.fixed.globalContextItem);
        
        //var EXPORT_NS = "http://ns.saxonica.com/xslt/export";

        
        // Index named templates
        forAll("template", function (template) {
            var tName = eqname(template);
            if (tName !== null) {
                context.fixed.namedTemplates[tName] = template;
            }
        });
        
        // Index modes by name
        forAll("mode", function (modeElem) {
            var mName = eqname(modeElem);
            context.fixed.modes[mName === null ? "": mName] = new Mode(modeElem);
        });
        
        // Create a map for all global variables. Initial values are null.
        forAll("globalVariable", function (variable) {
            var vName = eqname(variable);
            context.fixed.globalVars[vName] = {
                decl: variable, value: null, isParam: false
            };
        });
        
        // Create a map for all global parameters. Initial values are null.
        forAll("globalParam", function (variable) {
            var vName = eqname(variable);
            context.fixed.globalVars[vName] = {
                decl: variable, value: null, isParam: true
            };
        });
        
        // Index user-defined functions
        forAll("function", function (fn) {
            if (Expr.hasFlag(fn, "m")) {
                Expr.notImplemented("memo function");
            }
            var fName = eqname(fn);
            var arity = Axis.child(fn).filter(function (node) {
                return node.tagName == "arg";
            }).count();
            context.fixed.userFunctions[fName + "#" + arity] = Expr.argRole(fn, "body");
            context.fixed.userFunctions[fName + "#-1"] = true; // for function-available
        });
        
        // Index user-defined attribute-sets
        forAll("attributeSet", function (aSet) {
            var asName = eqname(aSet);
            context.fixed.attributeSets[asName] = aSet;
        });
        
        // Create a map for all key definitions.
        forAll("key", function (key) {
            var kName = eqname(key);
            //print("Declaring key " + kName);
            context.fixed.keys[kName] = key;
        });
        
        // Create a map for all key definitions.
        forAll("decimalFormat", function (fmt) {
            var fName = eqname(fmt);
            context.fixed.decimalFormats[fName === null ? "Q{}": fName] = fmt;
        });
        
        
        context.fixed.documentPool = {
        };
        context.fixed._nextDocumentNumber = 0;
        context.fixed.currentDate = new Date();
        
        if (inBrowser) {
            var htmlURI = window.location.toString();
            context.fixed.htmlURI = htmlURI;
            context.fixed.javascriptURI = platform.baseUri();
            context.fixed.staticBaseURI = platform.resolveUri(options.stylesheetLocation, htmlURI);
        } else {
            // For use with Nashorn test driver
            context.fixed.staticBaseURI = relocatable === "true" ? options.stylesheetFileName : null;
        }

        context.resultDocument = inBrowser ? document.implementation.createDocument(null, 'html', null): new Document();
        context.resultRoot = context.resultDocument.createDocumentFragment();
        context.localVars =[];
        context.localParams = {
        };
        context.tunnelParams = {
        };
        return context;
    }
    
    function Context() {
    }
    
    Context.prototype = {
        depth: 0,
        focus: null,
        resultDocument: null,
        tempOutputState: false,
        fixed: {
        },
        localParams: {
        },
        tunnelParams: {
        },
        currentTemplate: null,
        currentMode: null,
        currentError: null,
        currentEvent: null,
        currentGroup: null,
        currentGroupingKey: null,
        localVars:[],
        
        toString: function () {
            var p = "{";
            for (var n in this.localParams) {
                if (this.localParams.hasOwnProperty(n)) {
                    p += n + ":(" + this.localParams[n] + "),";
                }
            }
            p += "}";
            return "context: " + this.focus.current + " localParams: " + p;
        },
        newContext: function (clearParams) {
            //print("new Context clear=" + clearParams);
            var old = this;
            var c = new Context();
            c.depth = old.depth + 1;
            // used for diagnostics only
            c.focus = old.focus;
            c.resultDocument = old.resultDocument;
            c.currentMode = old.currentMode;
            c.currentTemplate = old.currentTemplate;
            c.currentError = old.currentError;
            c.currentGroup = old.currentGroup;
            c.currentGroupingKey = old.currentGroupingKey;
            c.fixed = old.fixed;
            c.tempOutputState = old.tempOutputState;
            c.currentEvent = old.currentEvent;
            
            if (clearParams) {
                c.localParams = {
                };
                c.tunnelParams = {
                };
                c.localVars =[];
            } else {
                c.localParams = old.localParams;
                c.tunnelParams = old.tunnelParams;
                c.localVars = old.localVars;
            }
            return c;
        },
        clearGrouping: function() {
            this.currentGroup = null;
            this.currentGroupingKey = null;
        }, 
        createElement: function (uri, name) {
            //print("createElement name " + name + ", uri " + uri);
            /* this.resultDocument == window.document is true when:
            (a) transform option destination is appendToBody|prependToBody|replaceBody, or
            (b) the constructed content of an xsl:result-document will be added to the HTML page (i.e. href is '?.' or begins with #) */
            var newElement;
            if ((uri === "" || uri == "http://www.w3.org/1999/xhtml") && inBrowser && this.resultDocument == window.document) {
                // This creates an HTMLElement, not just an Element (because window.document is an HTML document)
                newElement = this.resultDocument.createElement(name);
            } else {
                newElement = this.resultDocument.createElementNS(uri, name);
            }
            return newElement;
        },
        createAttribute: function (uri, name) {
            return new AttributeNode(new Atomic.QName.fromEQName(("Q{" + uri + "}" + name)), null, null);
        },
        createAttributeFromQName: function (qname) {
            return new AttributeNode(qname, null, null);
        }
    };
    
    
    /* A stub for the dynamic XPath functions - the code is loaded only if it is required */
    var XPath = function () {
        function load() {
            var content = SaxonJS.getPlatform().readResource("lib/xpath/XPathJS.min.js");
            content += "XPath;";
            /*jslint evil: true */
            SaxonJS.XPath = eval(content);
        }
        
        return {
            parse: function () {
                load();
                return SaxonJS.XPath.parse.apply(null,arguments);
            },
            compile: function () {
                load();
                return SaxonJS.XPath.compile.apply(null,arguments);
            },
            evaluate: function () {
                load();
                return SaxonJS.XPath.evaluate.apply(null,arguments);
            },
            evaluateXDM: function () {
                load();
                return SaxonJS.XPath.evaluateXDM.apply(null,arguments);
            },
            /* This is used in QT3tests to side-effect components of the static context */
            setStaticContext: function () {
                load();
                return SaxonJS.XPath.setStaticContext.apply(null,arguments);
            }
        };
    }
    ();
    
    
    function getProcessorInfo() {
        return {
            version: 3.0,
            vendor: "Saxonica",
            vendorURL: "http://www.saxonica.com/",
            productName: "Saxon-JS",
            productVersion: "1.0.0",
            isSchemaAware: false,
            supportsSerialization: false,
            supportsBackwardsCompatibility: true,
            supportsNamespaceAxis: true,
            supportsStreaming: false,
            supportsDynamicEvaluation: true,
            supportsHigherOrderFunctions: false,
            xPathVersion: 3.1,
            xsdVersion: 1.1
        };
    }

    // Initialization phase of SaxonJS load
    initialize();
    
    return {
        transform: transform,
        getProcessorInfo: getProcessorInfo,
        setPlatform: setPlatform,
        getPlatform: function () {
            return platform;
        },
        getNavigator: function () {
            return window.navigator.userAgent;
        },
        timeStamp: timeStamp,

        getSpaceStripper: function () {
            return spaceStripper;
        },
        internalTransform: applyStylesheet,
  
        U: {
            Atomic: Atomic, // all types needed in BuiltInAtomicType
            Axis: Axis, // Axis.child
            Context: Context, // needed for XPath evaluation
            nameOfNode: DomUtils.nameOfNode,
            isNode: DomUtils.isNode,
            isAttr: DomUtils.isAttr,
            isNamespaceNode: DomUtils.isNSNode,
            declareNS: DomUtils.declareNS,
            isMap: Expr.isMap,
            isArray: Expr.isArray,
            ForArray: Iter.ForArray,
            AnyIterator: Iter.AnyIterator,
            obtainDocumentNumber: DomUtils.obtainDocumentNumber,
            evaluate: Expr.evaluate,
            Iter: Iter,
            convertFromJS: Expr.convertFromJS,
            convertToJS: Expr.convertToJS,
            stringToCodepoints:Expr.stringToCodepoints
        },
        XError: XError,
        XPath: XPath
     };
}
();


// For use in Node.js
if (typeof require == 'function') {
    var DOMImplementation = require('xmldom').DOMImplementation;
    var Node = require('xmldom').Node;
    var Document = require('xmldom').Document;
    var DocumentFragment = require('xmldom').DocumentFragment;
    // TODO var NodePlatform = require('./NodePlatform.js');
    module.exports = SaxonJS;
}
