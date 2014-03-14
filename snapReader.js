var http = require('http');

// coming from file(s)
// morphic.js
// threads.js

// Global Functions ////////////////////////////////////////////////////

function nop() {
    // do explicitly nothing
    return null;
}

function localize(string) {
    // override this function with custom localizations
    return string;
}

function isNil(thing) {
    return thing === undefined || thing === null;
}

function contains(list, element) {
    // answer true if element is a member of list
    return list.some(function (any) {
        return any === element;
    });
}

function detect(list, predicate) {
    // answer the first element of list for which predicate evaluates
    // true, otherwise answer null
    var i, size = list.length;
    for (i = 0; i < size; i += 1) {
        if (predicate.call(null, list[i])) {
            return list[i];
        }
    }
    return null;
}

function sizeOf(object) {
    // answer the number of own properties
    var size = 0, key;
    for (key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
            size += 1;
        }
    }
    return size;
}

function isString(target) {
    return typeof target === 'string' || target instanceof StringContainer;
}

function isObject(target) {
    return target !== null &&
        (typeof target === 'object' || target instanceof Object);
}

function radians(degrees) {
    return degrees * Math.PI / 180;
}

function degrees(radians) {
    return radians * 180 / Math.PI;
}

function clone(target) {
    // answer a new instance of target's type
    if (typeof target === 'object') {
        var Clone = function () {nop(); };
        Clone.prototype = target;
        return new Clone();
    }
    return target;
}

function copy(target) {
    // answer a shallow copy of target
    var value, c, property;

    if (typeof target !== 'object') {
        return target;
    }
    value = target.valueOf();
    if (target !== value) {
        return new target.constructor(value);
    }
    if (target instanceof target.constructor &&
            target.constructor !== Object) {
        c = clone(target.constructor.prototype);
        for (property in target) {
            if (Object.prototype.hasOwnProperty.call(target, property)) {
                c[property] = target[property];
            }
        }
    } else {
        c = {};
        for (property in target) {
            if (!c[property]) {
                c[property] = target[property];
            }
        }
    }
    return c;
}

function snapEquals(a, b) {
    if (a instanceof List || (b instanceof List)) {
        if (a instanceof List && (b instanceof List)) {
            return a.equalTo(b);
        }
        return false;
    }

    var x = +a,
        y = +b,
        specials = [true, false, ''];

    // check for special values before coercing to numbers
    if (isNaN(x) || isNaN(y) ||
            [a, b].some(function (any) {return contains(specials, any) ||
                  (isString(any) && (any.indexOf(' ') > -1)); })) {
        x = a;
        y = b;
    }

    // handle text comparision case-insensitive.
    if (isString(x) && isString(y)) {
        return x.toLowerCase() === y.toLowerCase();
    }

    return x === y;
}

// coming from file(s)
// morphic.js


// Node ///////////////////////////////////////////////////////////////

// Node instance creation:

function Node(parent, childrenArray) {
    this.init(parent || null, childrenArray || []);
}

Node.prototype.init = function (parent, childrenArray) {
    this.parent = parent || null;
    this.children = childrenArray || [];
};

// Node string representation: e.g. 'a Node[3]'

Node.prototype.toString = function () {
    return 'a Node' + '[' + this.children.length.toString() + ']';
};

// Node accessing:

Node.prototype.addChild = function (aNode) {
    this.children.push(aNode);
    aNode.parent = this;
};

Node.prototype.addChildFirst = function (aNode) {
    this.children.splice(0, null, aNode);
    aNode.parent = this;
};

Node.prototype.removeChild = function (aNode) {
    var idx = this.children.indexOf(aNode);
    if (idx !== -1) {
        this.children.splice(idx, 1);
    }
};

// Node functions:

Node.prototype.root = function () {
    if (this.parent === null) {
        return this;
    }
    return this.parent.root();
};

Node.prototype.depth = function () {
    if (this.parent === null) {
        return 0;
    }
    return this.parent.depth() + 1;
};

Node.prototype.allChildren = function () {
    // includes myself
    var result = [this];
    this.children.forEach(function (child) {
        result = result.concat(child.allChildren());
    });
    return result;
};

Node.prototype.forAllChildren = function (aFunction) {
    if (this.children.length > 0) {
        this.children.forEach(function (child) {
            child.forAllChildren(aFunction);
        });
    }
    aFunction.call(null, this);
};

Node.prototype.allLeafs = function () {
    var result = [];
    this.allChildren().forEach(function (element) {
        if (element.children.length === 0) {
            result.push(element);
        }
    });
    return result;
};

Node.prototype.allParents = function () {
    // includes myself
    var result = [this];
    if (this.parent) {
        result = result.concat(this.parent.allParents());
    }
    return result;
};

Node.prototype.siblings = function () {
    var myself = this;
    if (this.parent === null) {
        return [];
    }
    return this.parent.children.filter(function (child) {
        return child !== myself;
    });
};

Node.prototype.parentThatIsA = function (constructor) {
    // including myself
    if (this instanceof constructor) {
        return this;
    }
    if (!this.parent) {
        return null;
    }
    return this.parent.parentThatIsA(constructor);
};

Node.prototype.parentThatIsAnyOf = function (constructors) {
    // including myself
    var yup = false,
        myself = this;
    constructors.forEach(function (each) {
        if (myself.constructor === each) {
            yup = true;
            return;
        }
    });
    if (yup) {
        return this;
    }
    if (!this.parent) {
        return null;
    }
    return this.parent.parentThatIsAnyOf(constructors);
};

// SteppingNode used to be a Morph, but it has been deprived of all visuals,
// becoming just a Node that's able to step

// SteppingNode ///////////////////////////////////////////////////////////////

// SteppingNode inherits from Node:


SteppingNode.prototype = new Node();
SteppingNode.prototype.constructor = SteppingNode;
SteppingNode.uber = Node.prototype;

// SteppingNode instance creation:

function SteppingNode() {
    this.init();
}

// SteppingNode initialization:

SteppingNode.prototype.init = function () {
    SteppingNode.uber.init.call(this);
    this.isSteppingNode = true;
    this.fps = 0;
    this.lastTime = Date.now();
    this.onNextStep = null; // optional function to be run once
};

// SteppingNode string representation: e.g. 'a SteppingNode 2'

SteppingNode.prototype.toString = function () {
    return 'a ' +
        (this.constructor.name ||
            this.constructor.toString().split(' ')[1].split('(')[0]) +
        ' ' +
        this.children.length.toString()
};

// SteppingNode deleting:

SteppingNode.prototype.destroy = function () {
    if (this.parent) {
        this.parent.removeChild(this);
    }
};

// SteppingNode stepping:

SteppingNode.prototype.stepFrame = function () {
    if (!this.step) {
        return null;
    }
    var current, elapsed, leftover, nxt;
    current = Date.now();
    elapsed = current - this.lastTime;
    if (this.fps > 0) {
        leftover = (1000 / this.fps) - elapsed;
    } else {
        leftover = 0;
    }
    if (leftover < 1) {
        this.lastTime = current;
        if (this.onNextStep) {
            nxt = this.onNextStep;
            this.onNextStep = null;
            nxt.call(this);
        }
        this.step();
        this.children.forEach(function (child) {
            child.stepFrame();
        });
    }
};

SteppingNode.prototype.nextSteps = function (arrayOfFunctions) {
    var lst = arrayOfFunctions || [],
        nxt = lst.shift(),
        myself = this;
    if (nxt) {
        this.onNextStep = function () {
            nxt.call(myself);
            myself.nextSteps(lst);
        };
    }
};

SteppingNode.prototype.step = function () {
    nop();
};


// SteppingNode Structure


SteppingNode.prototype.add = function (aSteppingNode) {
	if(aSteppingNode) {
    	var owner = aSteppingNode.parent;
    	if (owner) {
        	owner.removeChild(aSteppingNode);
    	}
   		this.addChild(aSteppingNode);
	}
};

SteppingNode.prototype.addBack = function (aSteppingNode) {
    var owner = aSteppingNode.parent;
    if (owner) {
        owner.removeChild(aSteppingNode);
    }
    this.addChildFirst(aSteppingNode);
};

SteppingNode.prototype.topSteppingNodeSuchThat = function (predicate) {
    var next;
    if (predicate.call(null, this)) {
        next = detect(
            this.children.slice(0).reverse(),
            predicate
        );
        if (next) {
            return next.topSteppingNodeSuchThat(predicate);
        }
        return this;
    }
    return null;
};

SteppingNode.prototype.morphAt = function (aPoint) {
    var morphs = this.allChildren().slice(0).reverse(),
        result = null;
    morphs.forEach(function (m) {
        if (m.fullBounds().containsPoint(aPoint) &&
                (result === null)) {
            result = m;
        }
    });
    return result;
};

// SteppingNode duplicating:

SteppingNode.prototype.copy = function () {
    var c = copy(this);
    c.parent = null;
    c.children = [];
    return c;
};

SteppingNode.prototype.fullCopy = function () {
    /*
    Produce a copy of me with my entire tree of submorphs. SteppingNodes
    mentioned more than once are all directed to a single new copy.
    Other properties are also *shallow* copied, so you must override
    to deep copy Arrays and (complex) Objects
    */
    var dict = {}, c;
    c = this.copyRecordingReferences(dict);
    c.forAllChildren(function (m) {
        m.updateReferences(dict);
    });
    return c;
};

SteppingNode.prototype.copyRecordingReferences = function (dict) {
    /*
    Recursively copy this entire composite morph, recording the
    correspondence between old and new morphs in the given dictionary.
    This dictionary will be used to update intra-composite references
    in the copy. See updateReferences().
    Note: This default implementation copies ONLY morphs in the
    submorph hierarchy. If a morph stores morphs in other properties
    that it wants to copy, then it should override this method to do so.
    The same goes for morphs that contain other complex data that
    should be copied when the morph is duplicated.
    */
    var c = this.copy();
    dict[this] = c;
    this.children.forEach(function (m) {
        c.add(m.copyRecordingReferences(dict));
    });
    return c;
};

SteppingNode.prototype.updateReferences = function (dict) {
    /*
    Update intra-morph references within a composite morph that has
    been copied. For example, if a button refers to morph X in the
    orginal composite then the copy of that button in the new composite
    should refer to the copy of X in new composite, not the original X.
    */
    var property;
    for (property in this) {
        if (this[property] && this[property].isSteppingNode && dict[property]) {
            this[property] = dict[property];
        }
    }
};

// SteppingNode utilities:

SteppingNode.prototype.nop = function () {
    nop();
};


// SteppingNode events:
// Note: DO WE NEED THIS???

/*
SteppingNode.prototype.escalateEvent = function (functionName, arg) {
    var handler = this.parent;
    while (!handler[functionName] && handler.parent !== null) {
        handler = handler.parent;
    }
    if (handler[functionName]) {
        handler[functionName](arg);
    }
};
*/


// SteppingNode eval:

SteppingNode.prototype.evaluateString = function (code) {
    var result;

    try {
        result = eval(code);
    } catch (err) {
		console.log(err)
    }
    return result;
};

// StringContainer /////////////////////////////////////////////////////////

// I am a single line of text

// StringContainer inherits from SteppingNode:

StringContainer.prototype = new SteppingNode();
StringContainer.prototype.constructor = StringContainer;
StringContainer.uber = SteppingNode.prototype;

// StringContainer instance creation:

function StringContainer(
    text,
    isNumeric
) {
    this.init(
        text,
        isNumeric
    );
}

StringContainer.prototype.init = function (
    text,
    isNumeric
) {
    // additional properties:
    this.text = text || ((text === '') ? '' : 'StringContainer');
    this.isNumeric = isNumeric || false;
    this.isPassword = false;

    // initialize inherited properties:
    StringContainer.uber.init.call(this);
};

StringContainer.prototype.toString = function () {
    // e.g. 'a StringContainer("Hello World")'
    return 'a ' +
        (this.constructor.name ||
            this.constructor.toString().split(' ')[1].split('(')[0]) +
        '("' + this.text.slice(0, 30) + '...")';
};

StringContainer.prototype.password = function (letter, length) {
    var ans = '',
        i;
    for (i = 0; i < length; i += 1) {
        ans += letter;
    }
    return ans;
};

// coming from file(s)
// blocks.js

/*
var SyntaxElement;
var Block;
var CommandBlock;
var ReporterBlock;
var Argument;
var CommandSlot;
var CSlot;
var InputSlot;
var BooleanSlot;
var HatBlock;
var MultiArgument;
var TemplateSlot;
var FunctionSlot;
var ReporterSlot;
var Ring;
var RingCommandSlot;
var RingReporterSlot;
var ArgumentLabel;
var TextSlot;
*/

// SyntaxElement //////////////////////////////////////////////////

// I am the ancestor of all blocks and input slots

// SyntaxElement inherits from SteppingNode:

SyntaxElement.prototype = new SteppingNode();
SyntaxElement.prototype.constructor = SyntaxElement;
SyntaxElement.uber = SteppingNode.prototype;

// SyntaxElement instance creation:

function SyntaxElement() {
    this.init();
}

SyntaxElement.prototype.init = function () {
    this.isStatic = false; // if true, I cannot be exchanged

    SyntaxElement.uber.init.call(this);

    this.defaults = [];
};

// SyntaxElement accessing:

SyntaxElement.prototype.parts = function () {
    // answer my non-control submorphs
    var nb = null;
    if (this.nextBlock) { // if I am a CommandBlock or a HatBlock
        nb = this.nextBlock();
    }
    return this.children.filter(function (child) {
        return (child !== nb)
    });
};

SyntaxElement.prototype.inputs = function () {
    // answer my arguments and nested reporters
    return this.parts().filter(function (part) {
        return part instanceof SyntaxElement;
    });

};

SyntaxElement.prototype.allInputs = function () {
    // answer arguments and nested reporters of all children
    var myself = this;
    return this.allChildren().slice(0).reverse().filter(
        function (child) {
            return (child instanceof Argument) ||
                (child instanceof ReporterBlock &&
                child !== myself);
        }
    );
};

SyntaxElement.prototype.silentReplaceInput = function (oldArg, newArg) {
    // used by the Serializer or when programatically
    // changing blocks
    var i = this.children.indexOf(oldArg),
        replacement;

    if (i === -1) {
        return;
    }

    if (newArg.parent) {
        newArg.parent.removeChild(newArg);
    }
    if (oldArg instanceof MultiArgument && this.dynamicInputLabels) {
        replacement = new ArgumentLabel(newArg);
    } else {
        replacement = newArg;
    }
    replacement.parent = this;
    this.children[i] = replacement;
};

SyntaxElement.prototype.isLocked = function () {
    // answer true if I can be exchanged by a dropped reporter
    return this.isStatic;
};

// SyntaxElement enumerating:

SyntaxElement.prototype.topBlock = function () {
    if (this.parent && this.parent.topBlock) {
        return this.parent.topBlock();
    }
    return this;
};

// SyntaxElement label parts:

SyntaxElement.prototype.labelPart = function (spec) {
    var part, tokens;
    if (spec[0] === '%' &&
            spec.length > 1 &&
            this.selector !== 'reportGetVar') {
        // check for variable multi-arg-slot:
        if ((spec.length > 5) && (spec.slice(0, 5) === '%mult')) {
            part = new MultiArgument(spec.slice(5));
            part.addInput();
            return part;
        }

        // single-arg and specialized multi-arg slots:
        switch (spec) {
        case '%inputs':
            part = new MultiArgument('%s', 'with inputs');
            part.isStatic = false;
            part.canBeEmpty = false;
            break;
        case '%scriptVars':
            part = new MultiArgument('%t', null, 1, spec);
            part.canBeEmpty = false;
            break;
        case '%parms':
            part = new MultiArgument('%t', 'Input Names:', 0, spec);
            part.canBeEmpty = false;
            break;
        case '%ringparms':
            part = new MultiArgument(
                '%t',
                'input names:',
                0,
                spec
            );
            break;
        case '%cmdRing':
            part = new Ring();
            part.selector = 'reifyScript';
            part.setSpec('%rc %ringparms');
            break;
        case '%repRing':
            part = new Ring();
            part.selector = 'reifyReporter';
            part.setSpec('%rr %ringparms');
            part.isStatic = true;
            break;
        case '%predRing':
            part = new Ring(true);
            part.selector = 'reifyPredicate';
            part.setSpec('%rp %ringparms');
            part.isStatic = true;
            break;
        case '%words':
            part = new MultiArgument('%s', null, 0);
            part.addInput(); // allow for default value setting
            part.addInput(); // allow for default value setting
            part.isStatic = false;
            break;
        case '%exp':
            part = new MultiArgument('%s', null, 0);
            part.addInput();
            part.isStatic = true;
            part.canBeEmpty = false;
            break;
		case '%inputName':
            part = new ReporterBlock();
            part.category = 'variables';
            part.setSpec(localize('Input name'));
            break;
        case '%s':
            part = new InputSlot();
            break;
        case '%anyUE':
            part = new InputSlot();
            part.isUnevaluated = true;
            break;
        case '%txt':
            part = new InputSlot();
            break;
        case '%mlt':
            part = new TextSlot();
            break;
        case '%code':
            part = new TextSlot();
            break;
        case '%obj':
            part = new Argument('object');
            break;
        case '%n':
            part = new InputSlot(null, true);
            break;
        case '%month':
            part = new InputSlot(
                null, // text
                false, // numeric?
                {
                    'January' : ['January'],
                    'February' : ['February'],
                    'March' : ['March'],
                    'April' : ['April'],
                    'May' : ['May'],
                    'June' : ['June'],
                    'July' : ['July'],
                    'August' : ['August'],
                    'September' : ['September'],
                    'October' : ['October'],
                    'November' : ['November'],
                    'December' : ['December']
                },
                true // read-only
            );
            break;
        case '%dates':
            part = new InputSlot(
                null, // text
                false, // non-numeric
                {
                    'year' : ['year'],
                    'month' : ['month'],
                    'date' : ['date'],
                    'day of week' : ['day of week'],
                    'hour' : ['hour'],
                    'minute' : ['minute'],
                    'second' : ['second'],
                    'time in milliseconds' : ['time in milliseconds']
                },
                true // read-only
            );
            part.setContents(['date']);
            break;
        case '%delim':
            part = new InputSlot(
                null, // text
                false, // numeric?
                {
                    'whitespace' : ['whitespace'],
                    'line' : ['line'],
                    'tab' : ['tab'],
                    'cr' : ['cr']
                },
                false // read-only
            );
            break;
        case '%ida':
            part = new InputSlot(
                null,
                true,
                {
                    '1' : 1,
                    last : ['last'],
                    '~' : null,
                    all : ['all']
                }
            );
            part.setContents(1);
            break;
        case '%idx':
            part = new InputSlot(
                null,
                true,
                {
                    '1' : 1,
                    last : ['last'],
                    any : ['any']
                }
            );
            part.setContents(1);
            break;
        case '%spr':
            part = new InputSlot(
                null,
                false,
                'objectsMenu',
                true
            );
            break;
        case '%cln': // clones
            part = new InputSlot(
                null,
                false,
                'clonablesMenu',
                true
            );
            break;
        case '%msg':
            part = new InputSlot(
                null,
                false,
                'messagesMenu',
                true
            );
            break;
        case '%msgHat':
            part = new InputSlot(
                null,
                false,
                'messagesReceivedMenu',
                true
            );
            part.isStatic = true;
            break;
        case '%att':
            part = new InputSlot(
                null,
                false,
                'attributesMenu',
                true
            );
            break;
        case '%fun':
            part = new InputSlot(
                null,
                false,
                {
                    abs : ['abs'],
                    floor : ['floor'],
                    sqrt : ['sqrt'],
                    sin : ['sin'],
                    cos : ['cos'],
                    tan : ['tan'],
                    asin : ['asin'],
                    acos : ['acos'],
                    atan : ['atan'],
                    ln : ['ln'],
                    'e^' : ['e^']
                },
                true
            );
            part.setContents(['sqrt']);
            break;
        case '%txtfun':
            part = new InputSlot(
                null,
                false,
                {
                    'encode URI' : ['encode URI'],
                    'decode URI' : ['decode URI'],
                    'encode URI component' : ['encode URI component'],
                    'decode URI component' : ['decode URI component'],
                    'XML escape' : ['XML escape'],
                    'XML unescape' : ['XML unescape'],
                    'hex sha512 hash' : ['hex sha512 hash']
                },
                true
            );
            part.setContents(['encode URI']);
            break;
        case '%stopChoices':
            part = new InputSlot(
                null,
                false,
                {
                    'all' : ['all'],
                    'this script' : ['this script'],
                    'this block' : ['this block']
                },
                true
            );
            part.setContents(['all']);
            part.isStatic = true;
            break;
        case '%stopOthersChoices':
            part = new InputSlot(
                null,
                false,
                {
                    'all but this script' : ['all but this script'],
                    'other scripts in sprite' : ['other scripts in sprite']
                },
                true
            );
            part.setContents(['all but this script']);
            part.isStatic = true;
            break;
        case '%typ':
            part = new InputSlot(
                null,
                false,
                {
                    number : ['number'],
                    text : ['text'],
                    Boolean : ['Boolean'],
                    list : ['list'],
                    command : ['command'],
                    reporter : ['reporter'],
                    predicate : ['predicate']
                },
                true
            );
            part.setContents(['number']);
            break;
        case '%var':
            part = new InputSlot(
                null,
                false,
                'getVarNamesDict',
                true
            );
            part.isStatic = true;
            break;
        case '%lst':
            part = new InputSlot(
                null,
                false,
                {
                    list1 : 'list1',
                    list2 : 'list2',
                    list3 : 'list3'
                },
                true
            );
            break;
        case '%codeKind':
            part = new InputSlot(
                null,
                false,
                {
                    code : ['code'],
                    header : ['header']
                },
                true
            );
            part.setContents(['code']);
            break;
        case '%l':
            part = new Argument('list');
            break;
        case '%b':
        case '%boolUE':
            part = new BooleanSlot(null, true);
            break;
        case '%cmd':
            part = new CommandSlot();
            break;
        case '%rc':
            part = new RingCommandSlot();
            part.isStatic = true;
            break;
        case '%rr':
            part = new RingReporterSlot();
            part.isStatic = true;
            break;
        case '%rp':
            part = new RingReporterSlot(true);
            part.isStatic = true;
            break;
        case '%c':
            part = new CSlot();
            part.isStatic = true;
            break;
        case '%cs':
            part = new CSlot(); // non-static
            break;
		case '%t':
            part = new TemplateSlot('a');
            break;
        case '%upvar':
            part = new TemplateSlot('\u2191'); // up-arrow
            break;
        case '%f':
            part = new FunctionSlot();
            break;
        case '%r':
            part = new ReporterSlot();
            break;
        case '%p':
            part = new ReporterSlot(true);
            break;

    // code mapping (experimental)

        case '%codeListPart':
            part = new InputSlot(
                null, // text
                false, // numeric?
                {
                    'list' : ['list'],
                    'item' : ['item'],
                    'delimiter' : ['delimiter']
                },
                true // read-only
            );
            break;
        case '%codeListKind':
            part = new InputSlot(
                null, // text
                false, // numeric?
                {
                    'collection' : ['collection'],
                    'variables' : ['variables'],
                    'parameters' : ['parameters']
                },
                true // read-only
            );
            break;
        default:
            nop();
        }
    } else {
        part = new StringContainer(spec);
    }
    return part;
};

// SyntaxElement evaluating:

SyntaxElement.prototype.evaluate = function () {
    // responsibility of my children, default is to answer null
    return null;
};

SyntaxElement.prototype.isEmptySlot = function () {
    // responsibility of my children, default is to answer false
    return false;
};

// SyntaxElement code mapping

SyntaxElement.prototype.mappedCode = function (definitions) {
    var result = this.evaluate();
    if (result instanceof Block) {
        return result.mappedCode(definitions);
    }
    return result;
};


// Block //////////////////////////////////////////////////////////

// Block inherits from SyntaxElement:

Block.prototype = new SyntaxElement();
Block.prototype.constructor = Block;
Block.uber = SyntaxElement.prototype;

// Block instance creation:

function Block() {
    this.init();
}

Block.prototype.init = function () {
    this.selector = null; // name of method to be triggered
    this.blockSpec = ''; // formal description of label and arguments

    // not to be persisted:
    this.instantiationSpec = null; // spec to set upon fullCopy() of template
    this.category = null; // for zebra coloring (non persistent)

    Block.uber.init.call(this);
};

Block.prototype.receiver = function () {
    // answer the object to which I apply (whose method I represent)
    var up = this.parent;
    while (!!up) {
        if (up.owner) {
            return up.owner;
        }
        up = up.parent;
    }
    return null;
};

Block.prototype.toString = function () {
    return 'a ' +
        (this.constructor.name ||
            this.constructor.toString().split(' ')[1].split('(')[0]) +
        ' ("' +
        this.blockSpec.slice(0, 30) + '...")';
};

// Block spec:

Block.prototype.parseSpec = function (spec) {
    var result = [],
        words,
        word = '';

    words = isString(spec) ? spec.split(' ') : [];
    if (words.length === 0) {
        words = [spec];
    }
    if (this.labelWordWrap) {
        return words;
    }

    function addWord(w) {
        if ((w[0] === '%') && (w.length > 1)) {
            if (word !== '') {
                result.push(word);
                word = '';
            }
            result.push(w);
        } else {
            if (word !== '') {
                word += ' ' + w;
            } else {
                word = w;
            }
        }
    }

    words.forEach(function (each) {
        addWord(each);
    });
    if (word !== '') {
        result.push(word);
    }
    return result;
};

Block.prototype.setSpec = function (spec) {
    var myself = this,
        part,
        inputIdx = -1;

    if (!spec) {return; }
    this.parts().forEach(function (part) {
        part.destroy();
    });
    if (this.isPrototype) {
        this.add(this.placeHolder());
    }
    this.parseSpec(spec).forEach(function (word) {
        if (word[0] === '%') {
            inputIdx += 1;
        }
        part = myself.labelPart(word);
        myself.add(part);
		if (myself.isPrototype) {
            myself.add(myself.placeHolder());
        }
        if (part instanceof InputSlot && myself.definition) {
            part.setChoices.apply(
                part,
                myself.definition.inputOptionsOfIdx(inputIdx)
            );
        }
    });
    this.blockSpec = spec;
};

Block.prototype.buildSpec = function () {
    // create my blockSpec from my parts - for demo purposes only
    var myself = this;
    this.blockSpec = '';
    this.parts().forEach(function (part) {
        if (part instanceof StringContainer) {
            myself.blockSpec += part.text;
        } else if (part instanceof Argument) {
            myself.blockSpec += part.getSpec();
        } else if (part.isBlockLabelBreak) {
            myself.blockSpec += part.getSpec();
        } else {
            myself.blockSpec += '[undefined]';
        }
        myself.blockSpec += ' ';
    });
    this.blockSpec = this.blockSpec.trim();
};

Block.prototype.rebuild = function (contrast) {
    // rebuild my label fragments, for use in ToggleElementMorphs
    this.setSpec(this.blockSpec);
};

// Block code mapping

Block.prototype.mapHeader = function (aString, key) {
    // primitive for programatically mapping header code
    var sel = key || this.selector.substr(0, 5) === 'reify' ?
            'reify' : this.selector;
    if (aString) {
        if (this.definition) { // custom block
            this.definition.codeHeader = aString;
        } else {
            Stage.prototype.codeHeaders[sel] = aString;
        }
    }
};

Block.prototype.mapCode = function (aString, key) {
    // primitive for programatically mapping code
    var sel = key || this.selector.substr(0, 5) === 'reify' ?
            'reify' : this.selector;
    if (aString) {
        if (this.definition) { // custom block
            this.definition.codeMapping = aString;
        } else {
            Stage.prototype.codeMappings[sel] = aString;
        }
    }
};

Block.prototype.mappedCode = function (definitions) {
    var key = this.selector.substr(0, 5) === 'reify' ?
            'reify' : this.selector,
        code,
        codeLines,
        count = 1,
        header,
        headers,
        headerLines,
        body,
        bodyLines,
        defKey = this.definition ? this.definition.spec : key,
        defs = definitions || {},
        parts = [];
    code = key === 'reportGetVar' ? this.blockSpec
            : this.definition ? this.definition.codeMapping || ''
                    : Stage.prototype.codeMappings[key] || '';

    // map header
    if (key !== 'reportGetVar' && !defs.hasOwnProperty(defKey)) {
        defs[defKey] = null; // create the property for recursive definitions
        if (this.definition) {
            header = this.definition.codeHeader || '';
            if (header.indexOf('<body') !== -1) { // replace with def mapping
                body = '';
                if (this.definition.body) {
                    body = this.definition.body.expression.mappedCode(defs);
                }
                bodyLines = body.split('\n');
                headerLines = header.split('\n');
                headerLines.forEach(function (headerLine, idx) {
                    var prefix = '',
                        indent;
                    if (headerLine.trimLeft().indexOf('<body') === 0) {
                        indent = headerLine.indexOf('<body');
                        prefix = headerLine.slice(0, indent);
                    }
                    headerLines[idx] = headerLine.replace(
                        new RegExp('<body>'),
                        bodyLines.join('\n' + prefix)
                    );
                    headerLines[idx] = headerLines[idx].replace(
                        new RegExp('<body>', 'g'),
                        bodyLines.join('\n')
                    );
                });
                header = headerLines.join('\n');
            }
            defs[defKey] = header;
        } else {
            defs[defKey] = Stage.prototype.codeHeaders[defKey];
        }
    }

    codeLines = code.split('\n');
    this.inputs().forEach(function (input) {
        parts.push(input.mappedCode(defs).toString());
    });
    parts.forEach(function (part) {
        var partLines = part.split('\n'),
            placeHolder = '<#' + count + '>',
            rx = new RegExp(placeHolder, 'g');
        codeLines.forEach(function (codeLine, idx) {
            var prefix = '',
                indent;
            if (codeLine.trimLeft().indexOf(placeHolder) === 0) {
                indent = codeLine.indexOf(placeHolder);
                prefix = codeLine.slice(0, indent);
            }
            codeLines[idx] = codeLine.replace(
                new RegExp(placeHolder),
                partLines.join('\n' + prefix)
            );
            codeLines[idx] = codeLines[idx].replace(rx, partLines.join('\n'));
        });
        count += 1;
    });
    code = codeLines.join('\n');
    if (this.nextBlock && this.nextBlock()) { // Command
        code += ('\n' + this.nextBlock().mappedCode(defs));
    }
    if (!definitions) { // top-level, add headers
        headers = [];
        Object.keys(defs).forEach(function (each) {
            if (defs[each]) {
                headers.push(defs[each]);
            }
        });
        if (headers.length) {
            return headers.join('\n\n')
                + '\n\n'
                + code;
        }
    }
    return code;
};

Block.prototype.codeDefinitionHeader = function () {
    var block = this.definition ? new PrototypeHatBlock(this.definition)
            : Sprite.prototype.blockForSelector(this.selector),
        hat = new HatBlock(),
        count = 1;

    if (this.definition) {return block; }
    block.inputs().forEach(function (input) {
        var part = new TemplateSlot('#' + count);
        count += 1;
    });
    block.isPrototype = true;
    hat.setCategory("control");
    hat.setSpec('%s');
	return hat;
};

Block.prototype.codeMappingHeader = function () {
    var block = this.definition ? this.definition.blockInstance()
            : Sprite.prototype.blockForSelector(this.selector),
        hat = new HatBlock(),
        count = 1;

    block.inputs().forEach(function (input) {
        var part = new TemplateSlot('<#' + count + '>');
        count += 1;
    });
    block.isPrototype = true;
    hat.setCategory("control");
    hat.setSpec('%s');
    return hat;
};

Block.prototype.setCategory = function (aString) {
    this.category = aString;
};

// Block copying

Block.prototype.fullCopy = function () {
    var ans = Block.uber.fullCopy.call(this);
    if (this.instantiationSpec) {
        ans.setSpec(this.instantiationSpec);
    }
	return ans;
};

// CommandBlock ///////////////////////////////////////////////////

// CommandBlock inherits from Block:

CommandBlock.prototype = new Block();
CommandBlock.prototype.constructor = CommandBlock;
CommandBlock.uber = Block.prototype;

// CommandBlock instance creation:

function CommandBlock() {
    this.init();
}

CommandBlock.prototype.init = function () {
    CommandBlock.uber.init.call(this);
};

// CommandBlock enumerating:

CommandBlock.prototype.blockSequence = function () {
    var nb = this.nextBlock(),
        result = [this];
    if (nb) {
        result = result.concat(nb.blockSequence());
    }
    return result;
};

CommandBlock.prototype.bottomBlock = function () {
    // topBlock() also exists - inherited from SyntaxElement
    if (this.nextBlock()) {
        return this.nextBlock().bottomBlock();
    }
    return this;
};

CommandBlock.prototype.nextBlock = function (block) {
    // set / get the block attached to my bottom
    if (block) {
        var nb = this.nextBlock(),
            affected = this.parentThatIsA(CommandSlot);
        this.add(block);
        if (nb) {
            block.bottomBlock().nextBlock(nb);
        }
    } else {
        return detect(
            this.children,
            function (child) {
                return child instanceof CommandBlock
                    && !child.isPrototype;
            }
        );
    }
};

CommandBlock.prototype.isStop = function () {
    return ([
        'doStopThis',
        'doStop',
        'doStopBlock',
        'doStopAll',
        'doForever',
        'doReport',
        'removeClone'
    ].indexOf(this.selector) > -1);
};

// HatBlock ///////////////////////////////////////////////////////

// HatBlock inherits from CommandBlock:

HatBlock.prototype = new CommandBlock();
HatBlock.prototype.constructor = HatBlock;
HatBlock.uber = CommandBlock.prototype;

// HatBlock instance creation:

function HatBlock() {
    this.init();
}

HatBlock.prototype.init = function () {
    HatBlock.uber.init.call(this);
};

// HatBlock enumerating:

HatBlock.prototype.blockSequence = function () {
    // override my inherited method so that I am not part of my sequence
    var result = HatBlock.uber.blockSequence.call(this);
    result.shift();
    return result;
};

// ReporterBlock //////////////////////////////////////////////////

// ReporterBlock inherits from Block:

ReporterBlock.prototype = new Block();
ReporterBlock.prototype.constructor = ReporterBlock;
ReporterBlock.uber = Block.prototype;

// ReporterBlock instance creation:

function ReporterBlock(isPredicate) {
    this.init(isPredicate);
}

ReporterBlock.prototype.init = function (isPredicate) {
    ReporterBlock.uber.init.call(this);
    this.isPredicate = isPredicate || false;
};

// ReporterBlock enumerating

ReporterBlock.prototype.blockSequence = function () {
    // reporters don't have a sequence, answer myself
    return this;
};

// ReporterBlock evaluating

ReporterBlock.prototype.isUnevaluated = function () {
/*
    answer whether my parent block's slot is designated to be of an
    'unevaluated' kind, denoting a spedial form
*/
    return contains(['%anyUE', '%boolUE', '%f'], this.getSlotSpec());
};

ReporterBlock.prototype.isLocked = function () {
    // answer true if I can be exchanged by a dropped reporter
    return this.isStatic || (this.getSlotSpec() === '%t');
};

ReporterBlock.prototype.getSlotSpec = function () {
    // answer the spec of the slot I'm in, if any
    var parts, idx;
    if (this.parent instanceof Block) {
        parts = this.parent.parts();
        idx = parts.indexOf(this);
        if (idx !== -1) {
            if (this.parent.blockSpec) {
                return this.parseSpec(this.parent.blockSpec)[idx];
            }
        }
    }
    if (this.parent instanceof MultiArgument) {
        return this.parent.slotSpec;
    }
    if (this.parent instanceof TemplateSlot) {
        return this.parent.getSpec();
    }
    return null;
};

// Ring /////////////////////////////////////////////////////////////

// Ring inherits from ReporterBlock:

Ring.prototype = new ReporterBlock();
Ring.prototype.constructor = Ring;
Ring.uber = ReporterBlock.prototype;

// Ring instance creation:

function Ring() {
    this.init();
}

Ring.prototype.init = function () {
    Ring.uber.init.call(this);
    this.category = 'other';
};

Ring.prototype.contents = function () {
    return this.parts()[0].nestedBlock();
};

Ring.prototype.inputNames = function () {
    return this.parts()[1].evaluate();
};

Ring.prototype.dataType = function () {
    switch (this.selector) {
    case 'reifyScript':
        return 'command';
    case 'reifyPredicate':
        return 'predicate';
    default:
        return 'reporter';
    }
};

// Argument //////////////////////////////////////////////////////////

// Argument inherits from SyntaxElement:

Argument.prototype = new SyntaxElement();
Argument.prototype.constructor = Argument;
Argument.uber = SyntaxElement.prototype;

// Argument instance creation:

function Argument(type) {
    this.init(type);
}

Argument.prototype.init = function (type) {
    this.type = type || null;
    this.isHole = false;
    Argument.uber.init.call(this);
};

// Argument spec extrapolation (for demo purposes)

Argument.prototype.getSpec = function () {
    return '%s'; // default
};

// Argument evaluation

Argument.prototype.isEmptySlot = function () {
    return this.type !== null;
};

// CommandSlot ////////////////////////////////////////////////////

// CommandSlot inherits from Argument:

CommandSlot.prototype = new Argument();
CommandSlot.prototype.constructor = CommandSlot;
CommandSlot.uber = Argument.prototype;

// CommandSlot instance creation:

function CommandSlot() {
    this.init();
}

CommandSlot.prototype.init = function () {
    CommandSlot.uber.init.call(this);
};

CommandSlot.prototype.getSpec = function () {
    return '%cmd';
};

// CommandSlot enumerating:

CommandSlot.prototype.topBlock = function () {
    if (this.parent.topBlock) {
        return this.parent.topBlock();
    }
    return this.nestedBlock();
};

// CommandSlot nesting:

CommandSlot.prototype.nestedBlock = function (block) {
    if (block) {
        var nb = this.nestedBlock();
        this.add(block);
        if (nb) {
            block.bottomBlock().nextBlock(nb);
        }
    } else {
        return detect(
            this.children,
            function (child) {
                return child instanceof CommandBlock;
            }
        );
    }
};

// CommandSlot evaluating:

CommandSlot.prototype.evaluate = function () {
    return this.nestedBlock();
};

CommandSlot.prototype.isEmptySlot = function () {
    return !this.isStatic && (this.nestedBlock() === null);
};

// RingCommandSlot ///////////////////////////////////////////////////

// RingCommandSlot inherits from CommandSlot:

RingCommandSlot.prototype = new CommandSlot();
RingCommandSlot.prototype.constructor = RingCommandSlot;
RingCommandSlot.uber = CommandSlot.prototype;

// RingCommandSlot instance creation:

function RingCommandSlot() {
    this.init();
}

RingCommandSlot.prototype.init = function () {
    RingCommandSlot.uber.init.call(this);
    this.isHole = true;
};

RingCommandSlot.prototype.getSpec = function () {
    return '%rc';
};

// CSlot ////////////////////////////////////////////////////

// CSlot inherits from CommandSlot:

CSlot.prototype = new CommandSlot();
CSlot.prototype.constructor = CSlot;
CSlot.uber = CommandSlot.prototype;

// CSlot instance creation:

function CSlot() {
    this.init();
}

CSlot.prototype.init = function () {
    CommandSlot.uber.init.call(this);
    this.isHole = true;
};

CSlot.prototype.getSpec = function () {
    return '%c';
};

CSlot.prototype.mappedCode = function (definitions) {
    var code = Stage.prototype.codeMappings.reify || '<#1>',
        codeLines = code.split('\n'),
        nested = this.nestedBlock(),
        part = nested ? nested.mappedCode(definitions) : '',
        partLines = (part.toString()).split('\n'),
        rx = new RegExp('<#1>', 'g');

    codeLines.forEach(function (codeLine, idx) {
        var prefix = '',
            indent;
        if (codeLine.trimLeft().indexOf('<#1>') === 0) {
            indent = codeLine.indexOf('<#1>');
            prefix = codeLine.slice(0, indent);
        }
        codeLines[idx] = codeLine.replace(
            new RegExp('<#1>'),
            partLines.join('\n' + prefix)
        );
        codeLines[idx] = codeLines[idx].replace(rx, partLines.join('\n'));
    });

    return codeLines.join('\n');
};

// InputSlot //////////////////////////////////////////////////////

// InputSlot inherits from Argument:

InputSlot.prototype = new Argument();
InputSlot.prototype.constructor = InputSlot;
InputSlot.uber = Argument.prototype;

// InputSlot preferences settings:

InputSlot.prototype.executeOnSliderEdit = false;

// InputSlot instance creation:

function InputSlot(text, isNumeric, choiceDict, isReadOnly) {
    this.init(text, isNumeric, choiceDict, isReadOnly);
}

InputSlot.prototype.init = function (
    text,
    isNumeric,
    choiceDict,
    isReadOnly
) {
    var contents = new StringContainer('');

    this.isUnevaluated = false;
    this.choices = choiceDict || null; // object, function or selector
    this.isNumeric = isNumeric || false;
    this.isReadOnly = isReadOnly || false;
    this.constant = null;

    InputSlot.uber.init.call(this);
    this.add(contents);
    this.setContents(text);
};

// InputSlot accessing:

InputSlot.prototype.getSpec = function () {
    if (this.isNumeric) {
        return '%n';
    }
    return '%s'; // default
};

InputSlot.prototype.contents = function () {
    return detect(
        this.children,
        function (child) {
            return (child instanceof StringContainer);
        }
    );
};

InputSlot.prototype.setContents = function (aStringOrFloat) {
    var cnts = this.contents(),
        dta = aStringOrFloat,
        isConstant = dta instanceof Array;
    if (isConstant) {
        dta = localize(dta[0]);
    } else { // assume dta is a localizable choice if it's a key in my choices
        if (this.choices !== null && this.choices[dta] instanceof Array) {
            return this.setContents(this.choices[dta]);
        }
    }
    cnts.text = dta;
    if (isNil(dta)) {
        cnts.text = '';
    } else if (dta.toString) {
        cnts.text = dta.toString();
    }

    // remember the constant, if any
    this.constant = isConstant ? aStringOrFloat : null;
};

InputSlot.prototype.getVarNamesDict = function () {
    var block = this.parentThatIsA(Block),
        rcvr,
        proto,
        rings,
        declarations,
        tempVars = [],
        dict;

    if (!block) {
        return {};
    }
    rcvr = block.receiver();

    proto = detect(block.allParents(), function (morph) {
        return morph instanceof PrototypeHatBlock;
    });
    if (proto) {
        tempVars = proto.inputs()[0].inputFragmentNames();
    }

    rings = block.allParents().filter(function (block) {
        return block instanceof Ring;
    });
    rings.forEach(function (block) {
        tempVars = tempVars.concat(block.inputs()[1].evaluate());
    });

    declarations = block.allParents().filter(function (block) {
        return block.selector === 'doDeclareVariables';
    });
    declarations.forEach(function (block) {
        tempVars = tempVars.concat(block.inputs()[0].evaluate());
    });

    if (rcvr) {
        dict = rcvr.variables.allNamesDict();
        tempVars.forEach(function (name) {
            dict[name] = name;
        });
        return dict;
    }
    return {};
};

InputSlot.prototype.setChoices = function (dict, readonly) {
    // externally specify choices and read-only status,
    // used for custom blocks
    var cnts = this.contents();
    this.choices = dict;
    this.isReadOnly = readonly || false;
};

// InputSlot code mapping

/*
    code mapping lets you use blocks to generate arbitrary text-based
    source code that can be exported and compiled / embedded elsewhere,
    it's not part of Snap's evaluator and not needed for Snap itself
*/

InputSlot.prototype.mappedCode = function () {
    var code = Stage.prototype.codeMappings.string || '<#1>',
        block = this.parentThatIsA(Block),
        val = this.evaluate();

    if (this.isNumeric) {return val; }
    if (!isNaN(parseFloat(val))) {return val; }
    if (!isString(val)) {return val; }
    if (block && contains(
            ['doSetVar', 'doChangeVar'],
            block.selector
        )) {
        return val;
    }
    return code.replace(/<#1>/g, val);
};

// InputSlot evaluating:

InputSlot.prototype.evaluate = function () {
/*
    answer my content's text string. If I am numerical convert that
    string to a number. If the conversion fails answer the string
    (e.g. for special choices like 'any', 'all' or 'last') otherwise
    the numerical value.
*/
    var num,
        contents = this.contents();
    if (this.constant) {
        return this.constant;
    }
    if (this.isNumeric) {
        num = parseFloat(contents.text || '0');
        if (!isNaN(num)) {
            return num;
        }
    }
    if (contents) { return contents.text };
};

InputSlot.prototype.isEmptySlot = function () {
    return this.contents().text === '';
};

// TemplateSlot ///////////////////////////////////////////////////

// TemplateSlot inherits from Argument:

TemplateSlot.prototype = new Argument();
TemplateSlot.prototype.constructor = TemplateSlot;
TemplateSlot.uber = Argument.prototype;

// TemplateSlot instance creation:

function TemplateSlot(name) {
    this.init(name);
}

TemplateSlot.prototype.init = function (name) {
    var template = new ReporterBlock();
    this.labelString = name || '';
    template.isTemplate = true;
    if (modules.objects !== undefined) {
        template.category = 'variables';
    } else {
        template.category = null;
    }
    template.setSpec(this.labelString);
    template.selector = 'reportGetVar';
    TemplateSlot.uber.init.call(this);
    this.add(template);
    this.isStatic = true; // I cannot be exchanged
};

// TemplateSlot accessing:

TemplateSlot.prototype.getSpec = function () {
    return '%t';
};

TemplateSlot.prototype.template = function () {
    return this.children[0];
};

TemplateSlot.prototype.contents = function () {
    return this.template().blockSpec;
};

TemplateSlot.prototype.setContents = function (aString) {
    var tmp = this.template();
    tmp.setSpec(aString);
};

// TemplateSlot evaluating:

TemplateSlot.prototype.evaluate = function () {
    return this.contents();
};

// BooleanSlot ////////////////////////////////////////////////////

// BooleanSlot inherits from Argument:

BooleanSlot.prototype = new Argument();
BooleanSlot.prototype.constructor = BooleanSlot;
BooleanSlot.uber = Argument.prototype;

// BooleanSlot instance creation:

function BooleanSlot() {
    this.init();
}

BooleanSlot.prototype.init = function () {
    BooleanSlot.uber.init.call(this);
};

BooleanSlot.prototype.getSpec = function () {
    return '%b';
};

// BooleanSlot implicit formal parameters:

BooleanSlot.prototype.isEmptySlot = function () {
    return true;
};

// TextSlot //////////////////////////////////////////////////////

// TextSlot inherits from InputSlot:

TextSlot.prototype = new InputSlot();
TextSlot.prototype.constructor = TextSlot;
TextSlot.uber = InputSlot.prototype;

// TextSlot instance creation:

function TextSlot(text, isNumeric, choiceDict, isReadOnly) {
    this.init(text, isNumeric, choiceDict, isReadOnly);
}

TextSlot.prototype.init = function (
    text,
    isNumeric,
    choiceDict,
    isReadOnly
) {
    var contents = new TextMorph('');

    this.isUnevaluated = false;
    this.choices = choiceDict || null; // object, function or selector
    this.isNumeric = isNumeric || false;
    this.isReadOnly = isReadOnly || false;
    this.constant = null;

    InputSlot.uber.init.call(this);
    this.add(contents);
    this.setContents(text);

};

// TextSlot accessing:

TextSlot.prototype.getSpec = function () {
    if (this.isNumeric) {
        return '%mln';
    }
    return '%mlt'; // default
};

TextSlot.prototype.contents = function () {
    return detect(
        this.children,
        function (child) {
            return (child instanceof TextMorph);
        }
    );
};


// MultiArgument ///////////////////////////////////////////////////////

// MultiArgument  inherits from Argument:

MultiArgument.prototype = new Argument();
MultiArgument.prototype.constructor = MultiArgument;
MultiArgument.uber = Argument.prototype;

// MultiArgument instance creation:

function MultiArgument(
    slotSpec,
    labelTxt,
    min,
    eSpec
) {
    this.init(
        slotSpec,
        labelTxt,
        min,
        eSpec
    );
}

MultiArgument.prototype.init = function (
    slotSpec,
    labelTxt,
    min,
    eSpec
) {
    var label,
        i;

    this.slotSpec = slotSpec || '%s';
    this.labelText = localize(labelTxt || '');
    this.minInputs = min || 0;
    this.elementSpec = eSpec || null;

    this.canBeEmpty = true;
    MultiArgument.uber.init.call(this);

    // label text:
    label = this.labelPart(this.labelText);
    this.add(label);

    // create the minimum number of inputs
    for (i = 0; i < this.minInputs; i += 1) {
        this.addInput();
    }
};

MultiArgument.prototype.label = function () {
    return this.children[0];
};

MultiArgument.prototype.getSpec = function () {
    return '%mult' + this.slotSpec;
};

// MultiArgument defaults:

MultiArgument.prototype.setContents = function (anArray) {
    var inputs = this.inputs(), i;
    for (i = 0; i < anArray.length; i += 1) {
        if ((anArray[i]) && (inputs[i])) {
            inputs[i].setContents(anArray[i]);
        }
    }
};

// MultiArgument arity control:

MultiArgument.prototype.addInput = function (contents) {
    var i, name,
        newPart = this.labelPart(this.slotSpec),
        idx = this.children.length - 1;
    if (contents) {
        newPart.setContents(contents);
    } else if (this.elementSpec === '%scriptVars') {
        name = '';
        i = idx;
        while (i > 0) {
            name = String.fromCharCode(97 + (i - 1) % 26) + name;
            i = Math.floor((i - 1) / 26);
        }
        newPart.setContents(name);
    } else if (contains(['%parms', '%ringparms'], this.elementSpec)) {
        newPart.setContents('#' + idx);
    }
    newPart.parent = this;
    this.children.splice(idx, 0, newPart);
};

MultiArgument.prototype.removeInput = function () {
    var oldPart, scripts;
    if (this.children.length > 1) {
        oldPart = this.children[this.children.length - 2];
        this.removeChild(oldPart);
        if (oldPart instanceof Block) {
            scripts = this.parentThatIsA(ScriptsMorph);
            if (scripts) {
                scripts.add(oldPart);
            }
        }
    }
};

// MultiArgument code mapping

/*
    code mapping lets you use blocks to generate arbitrary text-based
    source code that can be exported and compiled / embedded elsewhere,
    it's not part of Snap's evaluator and not needed for Snap itself
*/

MultiArgument.prototype.mapCodeDelimiter = function (key) {
    this.mapToCode(key + 'delim', 'list item delimiter');
};

MultiArgument.prototype.mapCodeList = function (key) {
    this.mapToCode(key + 'list', 'list contents <#1>');
};

MultiArgument.prototype.mapCodeItem = function (key) {
    this.mapToCode(key + 'item', 'list item <#1>');
};

MultiArgument.prototype.mappedCode = function (definitions) {
    var block = this.parentThatIsA(Block),
        key = '',
        code,
        items = '',
        itemCode,
        delim,
        count = 0,
        parts = [];

    if (block) {
        if (block instanceof Ring) {
            key = 'parms_';
        } else if (block.selector === 'doDeclareVariables') {
            key = 'tempvars_';
        }
    }

    code = Stage.prototype.codeMappings[key + 'list'] || '<#1>';
    itemCode = Stage.prototype.codeMappings[key + 'item'] || '<#1>';
    delim = Stage.prototype.codeMappings[key + 'delim'] || ' ';

    this.inputs().forEach(function (input) {
        parts.push(itemCode.replace(/<#1>/g, input.mappedCode(definitions)));
    });
    parts.forEach(function (part) {
        if (count) {
            items += delim;
        }
        items += part;
        count += 1;
    });
    code = code.replace(/<#1>/g, items);
    return code;
};

// MultiArgument arity evaluating:

MultiArgument.prototype.evaluate = function () {
/*
    this is usually overridden by the interpreter. This method is only
    called (and needed) for the variables menu.
*/
    var result = [];
    this.inputs().forEach(function (slot) {
        result.push(slot.evaluate());
    });
    return result;
};

MultiArgument.prototype.isEmptySlot = function () {
    return this.canBeEmpty ? this.inputs().length === 0 : false;
};

// ArgumentLabel ///////////////////////////////////////////////////////

// ArgumentLabel  inherits from Argument:

ArgumentLabel.prototype = new Argument();
ArgumentLabel.prototype.constructor = ArgumentLabel;
ArgumentLabel.uber = Argument.prototype;

// MultiArgument instance creation:

function ArgumentLabel(argMorph, labelTxt) {
    this.init(argMorph, labelTxt);
}

ArgumentLabel.prototype.init = function (argMorph, labelTxt) {
    var label;

    this.labelText = localize(labelTxt || 'input list:');
    ArgumentLabel.uber.init.call(this);

    this.isStatic = true; // I cannot be exchanged

    // label text:
    label = this.labelPart(this.labelText);
    this.add(label);

    // argMorph
    this.add(argMorph);
};

ArgumentLabel.prototype.label = function () {
    return this.children[0];
};

ArgumentLabel.prototype.argMorph = function () {
    return this.children[1];
};

// ArgumentLabel evaluating:

ArgumentLabel.prototype.evaluate = function () {
/*
    this is usually overridden by the interpreter. This method is only
    called (and needed) for the variables menu.
*/
    return this.argMorph().evaluate();
};

ArgumentLabel.prototype.isEmptySlot = function () {
    return false;
};

// FunctionSlot ///////////////////////////////////////////////////

// FunctionSlot inherits from Argument:

FunctionSlot.prototype = new Argument();
FunctionSlot.prototype.constructor = FunctionSlot;
FunctionSlot.uber = Argument.prototype;

// FunctionSlot instance creation:

function FunctionSlot(isPredicate) {
    this.init(isPredicate);
}

FunctionSlot.prototype.init = function (isPredicate) {
    FunctionSlot.uber.init.call(this);
    this.isPredicate = isPredicate || false;
};

FunctionSlot.prototype.getSpec = function () {
    return '%f';
};

// ReporterSlot ///////////////////////////////////////////////////

// ReporterSlot inherits from FunctionSlot:

ReporterSlot.prototype = new FunctionSlot();
ReporterSlot.prototype.constructor = ReporterSlot;
ReporterSlot.uber = FunctionSlot.prototype;

// ReporterSlot instance creation:

function ReporterSlot(isPredicate) {
    this.init(isPredicate);
}

ReporterSlot.prototype.init = function (isPredicate) {
    ReporterSlot.uber.init.call(this, isPredicate);
    this.add(this.emptySlot());
};

ReporterSlot.prototype.emptySlot = function () {
    var empty = new Argument();
    return empty;
};

// ReporterSlot accessing:

ReporterSlot.prototype.getSpec = function () {
    return '%r';
};

ReporterSlot.prototype.contents = function () {
    return this.children[0];
};

ReporterSlot.prototype.nestedBlock = function () {
    var contents = this.contents();
    return contents instanceof ReporterBlock ? contents : null;
};

// ReporterSlot evaluating:

ReporterSlot.prototype.evaluate = function () {
    return this.nestedBlock();
};

ReporterSlot.prototype.isEmptySlot = function () {
    return this.nestedBlock() === null;
};

// RingReporterSlot ///////////////////////////////////////////////////

// ReporterSlot inherits from FunctionSlot:

RingReporterSlot.prototype = new ReporterSlot();
RingReporterSlot.prototype.constructor = RingReporterSlot;
RingReporterSlot.uber = ReporterSlot.prototype;

// RingReporterSlot instance creation:

function RingReporterSlot(isPredicate) {
    this.init(isPredicate);
}

RingReporterSlot.prototype.init = function (isPredicate) {
    RingReporterSlot.uber.init.call(this, isPredicate);
    this.isHole = true;
};

// RingReporterSlot accessing:

RingReporterSlot.prototype.getSpec = function () {
    return '%rr';
};

RingReporterSlot.prototype.replaceInput = function (source, target) {
    RingReporterSlot.uber.replaceInput.call(this, source, target);
};
// coming from file(s)
// threads.js

/*
var ThreadManager;
var Process;
var Context;
var VariableFrame;
var UpvarReference;
*/

// ThreadManager ///////////////////////////////////////////////////////

function ThreadManager() {
    this.processes = [];
}

ThreadManager.prototype.toggleProcess = function (block) {
    var active = this.findProcess(block);
    if (active) {
        active.stop();
    } else {
        return this.startProcess(block);
    }
};

ThreadManager.prototype.startProcess = function (block, isThreadSafe) {
    var active = this.findProcess(block),
        top = block.topBlock(),
        newProc;
    if (active) {
        if (isThreadSafe) {
            return active;
        }
        active.stop();
        this.removeTerminatedProcesses();
    }
    newProc = new Process(block.topBlock());
    this.processes.push(newProc);
    return newProc;
};

ThreadManager.prototype.stopAll = function (excpt) {
    // excpt is optional
    this.processes.forEach(function (proc) {
        if (proc !== excpt) {
            proc.stop();
        }
    });
};

ThreadManager.prototype.stopAllForReceiver = function (rcvr, excpt) {
    // excpt is optional
    this.processes.forEach(function (proc) {
        if (proc.homeContext.receiver === rcvr && proc !== excpt) {
            proc.stop();
            if (rcvr.isClone) {
                proc.isDead = true;
            }
        }
    });
};

ThreadManager.prototype.stopProcess = function (block) {
    var active = this.findProcess(block);
    if (active) {
        active.stop();
    }
};

ThreadManager.prototype.pauseAll = function (stage) {
    this.processes.forEach(function (proc) {
        proc.pause();
    });
};

ThreadManager.prototype.isPaused = function () {
    return detect(this.processes, function (proc) {return proc.isPaused; })
        !== null;
};

ThreadManager.prototype.resumeAll = function (stage) {
    this.processes.forEach(function (proc) {
        proc.resume();
    });
};

ThreadManager.prototype.step = function () {
/*
    run each process until it gives up control, skipping processes
    for sprites that are currently picked up, then filter out any
    processes that have been terminated
*/
    this.processes.forEach(function (proc) {
        if (!proc.isDead) {
            proc.runStep();
        }
    });
    this.removeTerminatedProcesses();
};

ThreadManager.prototype.removeTerminatedProcesses = function () {
    // and un-highlight their scripts
    var remaining = [];
    this.processes.forEach(function (proc) {
        if (!proc.isRunning() && !proc.errorFlag && !proc.isDead) {
            if (proc.topBlock instanceof ReporterBlock) {
                if (proc.homeContext.inputs[0] instanceof List) {
					nop();
                } else {
                    proc.topBlock.showBubble(proc.homeContext.inputs[0]);
                }
            }
        } else {
            remaining.push(proc);
        }
    });
    this.processes = remaining;
};

ThreadManager.prototype.findProcess = function (block) {
    var top = block.topBlock();
    return detect(
        this.processes,
        function (each) {
            return each.topBlock === top;
        }
    );
};

// Process /////////////////////////////////////////////////////////////

Process.prototype = {};
Process.prototype.contructor = Process;
Process.prototype.timeout = 500; // msecs after which to force yield
Process.prototype.isCatchingErrors = true;

function Process(topBlock) {
    this.topBlock = topBlock || null;

    this.readyToYield = false;
    this.readyToTerminate = false;
    this.isDead = false;
    this.errorFlag = false;
    this.context = null;
    this.homeContext = new Context();
    this.lastYield = Date.now();
    this.isAtomic = false;
    this.prompter = null;
    this.httpRequest = null;
    this.isPaused = false;
    this.pauseOffset = null;
    this.frameCount = 0;

    if (topBlock) {
        this.homeContext.receiver = topBlock.receiver();
        this.homeContext.variables.parentFrame =
            this.homeContext.receiver.variables;
        this.context = new Context(
            null,
            topBlock.blockSequence(),
            this.homeContext
        );
        this.pushContext('doYield'); // highlight top block
    }
}

// Process accessing

Process.prototype.isRunning = function () {
    return (this.context !== null) && (!this.readyToTerminate);
};

// Process entry points

Process.prototype.runStep = function () {
/*
    a step is an an uninterruptable 'atom', it can consist
    of several contexts, even of several blocks
*/
    if (this.isPaused) { // allow pausing in between atomic steps:
		console.log('a');
        return this.pauseStep();
    }
    this.readyToYield = false;
    while (!this.readyToYield
            && this.context
            && (this.isAtomic ?
                    (Date.now() - this.lastYield < this.timeout) : true)
                ) {
        // also allow pausing inside atomic steps - for PAUSE block primitive:
        if (this.isPaused) {
            return this.pauseStep();
        }
        this.evaluateContext();
    }
    this.lastYield = Date.now();

    if (this.readyToTerminate) {
        while (this.context) {
            this.popContext();
        }
	}
};

Process.prototype.stop = function () {
    this.readyToYield = true;
    this.readyToTerminate = true;
    this.errorFlag = false;
};

Process.prototype.pause = function () {
    this.isPaused = true;
    if (this.context && this.context.startTime) {
        this.pauseOffset = Date.now() - this.context.startTime;
    }
};

Process.prototype.resume = function () {
    this.isPaused = false;
    this.pauseOffset = null;
};

Process.prototype.pauseStep = function () {
    this.lastYield = Date.now();
    if (this.context && this.context.startTime) {
        this.context.startTime = this.lastYield - this.pauseOffset;
    }
};

// Process evaluation

Process.prototype.evaluateContext = function () {
    var exp = this.context.expression;

    this.frameCount += 1;
    if (exp instanceof Array) {
        return this.evaluateSequence(exp);
    }
    if (exp instanceof MultiArgument) {
        return this.evaluateMultiSlot(exp, exp.inputs().length);
    }
    if (exp instanceof ArgumentLabel) {
        return this.evaluateArgLabel(exp);
    }
    if (exp instanceof Argument || exp.bindingID) {
        return this.evaluateInput(exp);
    }
    if (exp instanceof Block) {
        return this.evaluateBlock(exp, exp.inputs().length);
    }
    if (exp instanceof StringContainer) {
        return this[exp]();
    }
    this.popContext(); // default: just ignore it
};

Process.prototype.evaluateBlock = function (block, argCount) {
    // check for special forms
    if (contains(['reportOr', 'reportAnd'], block.selector)) {
        return this[block.selector](block);
    }

    // first evaluate all inputs, then apply the primitive
    var rcvr = this.context.receiver || this.topBlock.receiver(),
        inputs = this.context.inputs;

    if (argCount > inputs.length) {
        this.evaluateNextInput(block);
    } else {
        if (this[block.selector]) {
            rcvr = this;
        }
        if (this.isCatchingErrors) {
            try {
                this.returnValueToParentContext(
                    rcvr[block.selector].apply(rcvr, inputs)
                );
                this.popContext();
            } catch (error) {
                this.handleError(error, block);
            }
        } else {
            this.returnValueToParentContext(
                rcvr[block.selector].apply(rcvr, inputs)
            );
            this.popContext();
        }
    }
};

// Process: Special Forms Blocks Primitives

Process.prototype.reportOr = function (block) {
    var inputs = this.context.inputs;

    if (inputs.length < 1) {
        this.evaluateNextInput(block);
    } else if (inputs[0]) {
        this.returnValueToParentContext(true);
        this.popContext();
    } else if (inputs.length < 2) {
        this.evaluateNextInput(block);
    } else {
        this.returnValueToParentContext(inputs[1] === true);
        this.popContext();
    }
};

Process.prototype.reportAnd = function (block) {
    var inputs = this.context.inputs;

    if (inputs.length < 1) {
        this.evaluateNextInput(block);
    } else if (!inputs[0]) {
        this.returnValueToParentContext(false);
        this.popContext();
    } else if (inputs.length < 2) {
        this.evaluateNextInput(block);
    } else {
        this.returnValueToParentContext(inputs[1] === true);
        this.popContext();
    }
};

// Process: Non-Block evaluation

Process.prototype.evaluateMultiSlot = function (multiSlot, argCount) {
    // first evaluate all subslots, then return a list of their values
    var inputs = this.context.inputs,
        ans;
    if (multiSlot.bindingID) {
        if (this.isCatchingErrors) {
            try {
                ans = this.context.variables.getVar(multiSlot.bindingID);
            } catch (error) {
                this.handleError(error, multiSlot);
            }
        } else {
            ans = this.context.variables.getVar(multiSlot.bindingID);
        }
        this.returnValueToParentContext(ans);
        this.popContext();
    } else {
        if (argCount > inputs.length) {
            this.evaluateNextInput(multiSlot);
        } else {
            this.returnValueToParentContext(new List(inputs));
            this.popContext();
        }
    }
};
Process.prototype.evaluateArgLabel = function (argLabel) {
    // perform the ID function on an ArgumentLabel element
    var inputs = this.context.inputs;
    if (inputs.length < 1) {
        this.evaluateNextInput(argLabel);
    } else {
        this.returnValueToParentContext(inputs[0]);
        this.popContext();
    }
};

Process.prototype.evaluateInput = function (input) {
    // evaluate the input unless it is bound to an implicit parameter
    var ans;
    if (input.bindingID) {
        if (this.isCatchingErrors) {
            try {
                ans = this.context.variables.getVar(input.bindingID);
            } catch (error) {
                this.handleError(error, input);
            }
        } else {
            ans = this.context.variables.getVar(input.bindingID);
        }
    } else {
        ans = input.evaluate();
        if (ans) {
            if (contains(
                    [CommandSlot, ReporterSlot],
                    input.constructor
                ) || (input instanceof CSlot && !input.isStatic)) {
                // I know, this still needs yet to be done right....
                ans = this.reify(ans, new List());
                ans.isImplicitLambda = true;
            }
        }
    }
    this.returnValueToParentContext(ans);
    this.popContext();
};

Process.prototype.evaluateSequence = function (arr) {
    var pc = this.context.pc,
        outer = this.context.outerContext,
        isLambda = this.context.isLambda,
        isImplicitLambda = this.context.isImplicitLambda,
        upvars = this.context.upvars;
    if (pc === (arr.length - 1)) { // tail call elimination
        this.context = new Context(
            this.context.parentContext,
            arr[pc],
            this.context.outerContext,
            this.context.receiver
        );
        this.context.isLambda = isLambda;
        this.context.isImplicitLambda = isImplicitLambda;
        if (upvars) {
            this.context.upvars = new UpvarReference(upvars);
        }
    } else {
        if (pc >= arr.length) {
            this.popContext();
        } else {
            this.context.pc += 1;
            this.pushContext(arr[pc], outer);
        }
    }
};

Process.prototype.evaluateNextInput = function (element) {
    var nxt = this.context.inputs.length,
        args = element.inputs(),
        exp = args[nxt],
        outer = this.context.outerContext; // for tail call elimination

    if (exp.isUnevaluated) {
        if (exp.isUnevaluated === true || exp.isUnevaluated()) {
            // just return the input as-is
            /*
                Note: we only reify the input here, if it's not an
                input to a reification primitive itself (THE BLOCK,
                THE SCRIPT), because those allow for additional
                explicit parameter bindings.
            */
            if (contains(['reify', 'reportScript'],
                    this.context.expression.selector)) {
                this.context.addInput(exp);
            } else {
                this.context.addInput(this.reify(exp, new List()));
            }
        } else {
            this.pushContext(exp, outer);
        }
    } else {
        this.pushContext(exp, outer);
    }
};

Process.prototype.doYield = function () {
    this.popContext();
    if (!this.isAtomic) {
        this.readyToYield = true;
    }
};

// Process Exception Handling

Process.prototype.handleError = function (error, element) {
    this.stop();
    this.errorFlag = true;
	console.log('Error: ' + error + '\nProcess: ' + this + '\nElement:');
};

// Process Lambda primitives

Process.prototype.reify = function (topBlock, parameterNames, isCustomBlock) {
    var context = new Context(
            null,
            null,
            this.context ? this.context.outerContext : null
        ),
        i = 0;

    if (topBlock) {
        context.expression = topBlock.fullCopy();

        if (!isCustomBlock) {
            // mark all empty slots with an identifier
            context.expression.allEmptySlots().forEach(function (slot) {
                i += 1;
                if (slot instanceof MultiArgument) {
                    slot.bindingID = ['arguments'];
                } else {
                    slot.bindingID = i;
                }
            });
            // and remember the number of detected empty slots
            context.emptySlots = i;
        }

    } else {
        context.expression = [this.context.expression.fullCopy()];
    }

    context.inputs = parameterNames.asArray();
    context.receiver
        = this.context ? this.context.receiver : topBlock.receiver();

    return context;
};

Process.prototype.reportScript = function (parameterNames, topBlock) {
    return this.reify(topBlock, parameterNames);
};

Process.prototype.reifyScript = function (topBlock, parameterNames) {
    return this.reify(topBlock, parameterNames);
};

Process.prototype.reifyReporter = function (topBlock, parameterNames) {
    return this.reify(topBlock, parameterNames);
};

Process.prototype.reifyPredicate = function (topBlock, parameterNames) {
    return this.reify(topBlock, parameterNames);
};

Process.prototype.doRun = function (context, args, isCustomBlock) {
    return this.evaluate(context, args, true, isCustomBlock);
};

Process.prototype.evaluate = function (
    context,
    args,
    isCommand
) {
    if (!context) {return null; }
    if (context.isContinuation) {
        return this.runContinuation(context, args);
    }
    if (!(context instanceof Context)) {
        throw new Error('expecting a ring but getting ' + context);
    }

    var outer = new Context(null, null, context.outerContext),
        runnable,
        extra,
        parms = args.asArray(),
        i,
        value;

    if (!outer.receiver) {
        outer.receiver = context.receiver; // for custom blocks
    }
    runnable = new Context(
        this.context.parentContext,
        context.expression,
        outer,
        context.receiver
    );
    extra = new Context(runnable, 'doYield');

    /*
        Note: if the context's expression is a ReporterBlock,
        the extra context gets popped off immediately without taking
        effect (i.e. it doesn't yield within evaluating a stack of
        nested reporters)
    */

    if (isCommand || (context.expression instanceof ReporterBlock)) {
        this.context.parentContext = extra;
    } else {
        this.context.parentContext = runnable;
    }

    runnable.isLambda = true;
    runnable.isImplicitLambda = context.isImplicitLambda;
    runnable.isCustomBlock = false;

    // assign parameters if any were passed
    if (parms.length > 0) {

        // assign formal parameters
        for (i = 0; i < context.inputs.length; i += 1) {
            value = 0;
            if (!isNil(parms[i])) {
                value = parms[i];
            }
            outer.variables.addVar(context.inputs[i], value);
        }

        // assign implicit parameters if there are no formal ones
        if (context.inputs.length === 0) {
            // assign the actual arguments list to the special
            // parameter ID ['arguments'], to be used for variadic inputs
            outer.variables.addVar(['arguments'], args);

            // in case there is only one input
            // assign it to all empty slots
            if (parms.length === 1) {
                for (i = 1; i <= context.emptySlots; i += 1) {
                    outer.variables.addVar(i, parms[0]);
                }

            // if the number of inputs matches the number
            // of empty slots distribute them sequentially
            } else if (parms.length === context.emptySlots) {
                for (i = 1; i <= parms.length; i += 1) {
                    outer.variables.addVar(i, parms[i - 1]);
                }

            } else if (context.emptySlots !== 1) {
                throw new Error(
                    'expecting ' + context.emptySlots + ' input(s), '
                        + 'but getting ' + parms.length
                );
            }
        }
    }
    if (this.context.upvars) {
        runnable.upvars = new UpvarReference(this.context.upvars);
    }

    if (runnable.expression instanceof CommandBlock) {
        runnable.expression = runnable.expression.blockSequence();
    }
};

Process.prototype.fork = function (context, args) {
    if (context.isContinuation) {
        throw new Error(
            'continuations cannot be forked'
        );
    }

    var outer = new Context(null, null, context.outerContext),
        runnable = new Context(null,
            context.expression,
            outer
            ),
        parms = args.asArray(),
        i,
        value,
        stage = this.homeContext.receiver.parentThatIsA(Stage),
        proc = new Process();

    runnable.isLambda = true;

    // assign parameters if any were passed
    if (parms.length > 0) {

        // assign formal parameters
        for (i = 0; i < context.inputs.length; i += 1) {
            value = 0;
            if (!isNil(parms[i])) {
                value = parms[i];
            }
            outer.variables.addVar(context.inputs[i], value);
        }

        // assign implicit parameters if there are no formal ones
        if (context.inputs.length === 0) {
            // assign the actual arguments list to the special
            // parameter ID ['arguments'], to be used for variadic inputs
            outer.variables.addVar(['arguments'], args);

            // in case there is only one input
            // assign it to all empty slots
            if (parms.length === 1) {
                for (i = 1; i <= context.emptySlots; i += 1) {
                    outer.variables.addVar(i, parms[0]);
                }

            // if the number of inputs matches the number
            // of empty slots distribute them sequentially
            } else if (parms.length === context.emptySlots) {
                for (i = 1; i <= parms.length; i += 1) {
                    outer.variables.addVar(i, parms[i - 1]);
                }

            } else if (context.emptySlots !== 1) {
                throw new Error(
                    'expecting ' + context.emptySlots + ' input(s), '
                        + 'but getting ' + parms.length
                );
            }
        }
    }

    if (runnable.expression instanceof CommandBlock) {
        runnable.expression = runnable.expression.blockSequence();
    }

    proc.homeContext = context.outerContext;
    proc.topBlock = context.expression;
    proc.context = runnable;
    proc.pushContext('doYield');
    stage.threads.processes.push(proc);
};

Process.prototype.doReport = function (value, isCSlot) {
    while (this.context && !this.context.isLambda) {
        if (this.context.expression === 'doStopWarping') {
            this.doStopWarping();
        } else {
            this.popContext();
        }
    }
    if (this.context && this.context.isImplicitLambda) {
        if (this.context.expression === 'doStopWarping') {
            this.doStopWarping();
        } else {
            this.popContext();
        }
        return this.doReport(value, true);
    }
    if (this.context && this.context.isCustomBlock) {
        // now I'm back at the custom block sequence.
        // advance my pc to my expression's length
        this.context.pc = this.context.expression.length - 1;
    }
    if (isCSlot) {
        if (this.context.parentContext.expression instanceof Array) {
            this.popContext();
        }
    }
    return value;
};

Process.prototype.doStopBlock = function () {
    this.doReport();
};

// Process continuations primitives

Process.prototype.doCallCC = function (aContext) {
    this.evaluate(aContext, new List([this.context.continuation()]));
};

Process.prototype.reportCallCC = function (aContext) {
    this.doCallCC(aContext);
};

Process.prototype.runContinuation = function (aContext, args) {
    var parms = args.asArray();
    this.context.parentContext = aContext.copyForContinuationCall();
    // passing parameter if any was passed
    if (parms.length === 1) {
        this.context.parentContext.outerContext.variables.addVar(
            1,
            parms[0]
        );
    }
};


// Process variables primitives

Process.prototype.doDeclareVariables = function (varNames) {
    var varFrame = this.context.outerContext.variables;
    varNames.asArray().forEach(function (name) {
        varFrame.addVar(name);
    });
};

Process.prototype.doSetVar = function (varName, value) {
    var varFrame = this.context.variables,
        name = varName;

    if (name instanceof Context) {
        if (name.expression.selector === 'reportGetVar') {
            name = name.expression.blockSpec;
        }
    }
    varFrame.setVar(name, value);
};

Process.prototype.doChangeVar = function (varName, value) {
    var varFrame = this.context.variables,
        name = varName;

    if (name instanceof Context) {
        if (name.expression.selector === 'reportGetVar') {
            name = name.expression.blockSpec;
        }
    }
    varFrame.changeVar(name, value);
};

Process.prototype.reportGetVar = function () {
    // assumes a getter block whose blockSpec is a variable name
    var varName = this.context.expression.blockSpec;

    return this.context.variables.getVar(
        varName,
        this.context.upvars
    );
};

// Process lists primitives

Process.prototype.reportNewList = function (elements) {
    return elements;
};

Process.prototype.reportCONS = function (car, cdr) {
    return new List().cons(car, cdr);
};

Process.prototype.reportCDR = function (list) {
    return list.cdr();
};

Process.prototype.doAddToList = function (element, list) {
    list.add(element);
};

Process.prototype.doDeleteFromList = function (index, list) {
    var idx = index;
    if (this.inputOption(index) === 'all') {
        return list.clear();
    }
    if (index === '') {
        return null;
    }
    if (this.inputOption(index) === 'last') {
        idx = list.length();
    }
    list.remove(idx);
};

Process.prototype.doInsertInList = function (element, index, list) {
    var idx = index;
    if (index === '') {
        return null;
    }
    if (this.inputOption(index) === 'any') {
        idx = this.reportRandom(1, list.length());
    }
    if (this.inputOption(index) === 'last') {
        idx = list.length() + 1;
    }
    list.add(element, idx);
};

Process.prototype.doReplaceInList = function (index, list, element) {
    var idx = index;
    if (index === '') {
        return null;
    }
    if (this.inputOption(index) === 'any') {
        idx = this.reportRandom(1, list.length());
    }
    if (this.inputOption(index) === 'last') {
        idx = list.length();
    }
    list.put(element, idx);
};

Process.prototype.reportListItem = function (index, list) {
    var idx = index;
    if (index === '') {
        return '';
    }
    if (this.inputOption(index) === 'any') {
        idx = this.reportRandom(1, list.length());
    }
    if (this.inputOption(index) === 'last') {
        idx = list.length();
    }
    return list.at(idx);
};

Process.prototype.reportListLength = function (list) {
    return list.length();
};

Process.prototype.reportListContainsItem = function (list, element) {
    return list.contains(element);
};

// Process conditionals primitives

Process.prototype.doIf = function () {
    var args = this.context.inputs,
        outer = this.context.outerContext, // for tail call elimination
        isLambda = this.context.isLambda,
        isImplicitLambda = this.context.isImplicitLambda,
        isCustomBlock = this.context.isCustomBlock,
        upvars = this.context.upvars;

    this.popContext();
    if (args[0]) {
        if (args[1]) {
            this.pushContext(args[1].blockSequence(), outer);
            this.context.isLambda = isLambda;
            this.context.isImplicitLambda = isImplicitLambda;
        	this.context.isCustomBlock = isCustomBlock;
            this.context.upvars = new UpvarReference(upvars);
        }
    }
    this.pushContext();
};

Process.prototype.doIfElse = function () {
    var args = this.context.inputs,
        outer = this.context.outerContext, // for tail call elimination
        isLambda = this.context.isLambda,
        isImplicitLambda = this.context.isImplicitLambda,
        isCustomBlock = this.context.isCustomBlock,
        upvars = this.context.upvars;

    this.popContext();
    if (args[0]) {
        if (args[1]) {
            this.pushContext(args[1].blockSequence(), outer);
        }
    } else {
        if (args[2]) {
            this.pushContext(args[2].blockSequence(), outer);
        } else {
            this.pushContext('doYield');
        }
    }
    if (this.context) {
        this.context.isLambda = isLambda;
        this.context.isImplicitLambda = isImplicitLambda;
        this.context.isCustomBlock = isCustomBlock;
        this.context.upvars = new UpvarReference(upvars);
    }

    this.pushContext();
};

// Process process related primitives

Process.prototype.doStop = function () {
    this.stop();
};

Process.prototype.doStopAll = function () {
    var stage;
    if (this.homeContext.receiver) {
        stage = this.homeContext.receiver.parentThatIsA(Stage);
        if (stage) {
            stage.threads.resumeAll(stage);
            stage.threads.stopAll();
			stage.removeAllClones();
        }
    }
};

Process.prototype.doStopThis = function (choice) {
    switch (this.inputOption(choice)) {
    case 'all':
        this.doStopAll();
        break;
    case 'this script':
        this.doStop();
        break;
    case 'this block':
        this.doStopBlock();
        break;
    default:
        nop();
    }
};

Process.prototype.doStopOthers = function (choice) {
    var stage;
    if (this.homeContext.receiver) {
        stage = this.homeContext.receiver.parentThatIsA(Stage);
        if (stage) {
            switch (this.inputOption(choice)) {
            case 'all but this script':
                stage.threads.stopAll(this);
                break;
            case 'other scripts in sprite':
                stage.threads.stopAllForReceiver(
                    this.homeContext.receiver,
                    this
                );
                break;
            default:
                nop();
            }
        }
    }
};

Process.prototype.doWarp = function (body) {
    // execute my contents block atomically (more or less)
    var outer = this.context.outerContext, // for tail call elimination
        isLambda = this.context.isLambda,
        isImplicitLambda = this.context.isImplicitLambda,
        isCustomBlock = this.context.isCustomBlock,
        stage;

    this.popContext();

    if (body) {
        if (this.homeContext.receiver) {
            if (this.homeContext.receiver.startWarp) {
                // pen optimization
                this.homeContext.receiver.startWarp();
            }
            stage = this.homeContext.receiver.parentThatIsA(Stage);
            if (stage) {
                stage.fps = 0; // variable frame rate
            }
        }

        this.pushContext('doYield');

        this.context.isLambda = isLambda;
        this.context.isImplicitLambda = isImplicitLambda;
        this.context.isCustomBlock = isCustomBlock;

        if (!this.isAtomic) {
            this.pushContext('doStopWarping');
        }
        this.pushContext(body.blockSequence(), outer);
        this.isAtomic = true;
    }
    this.pushContext();
};

Process.prototype.doStopWarping = function () {
    var stage;
    this.popContext();
    this.isAtomic = false;
    if (this.homeContext.receiver) {
        if (this.homeContext.receiver.endWarp) {
            // pen optimization
            this.homeContext.receiver.endWarp();
        }
        stage = this.homeContext.receiver.parentThatIsA(Stage);
        if (stage) {
            stage.fps = stage.frameRate; //  back to fixed frame rate
        }
    }
};

Process.prototype.doPauseAll = function () {
    var stage, ide;
    if (this.homeContext.receiver) {
        stage = this.homeContext.receiver.parentThatIsA(Stage);
        if (stage) {
            stage.threads.pauseAll(stage);
        }
	}
};

// Process loop primitives

Process.prototype.doForever = function (body) {
    this.pushContext('doYield');
    if (body) {
        this.pushContext(body.blockSequence());
    }
    this.pushContext();
};

Process.prototype.doRepeat = function (counter, body) {
    var block = this.context.expression,
        outer = this.context.outerContext, // for tail call elimination
        isLambda = this.context.isLambda,
        isImplicitLambda = this.context.isImplicitLambda,
        isCustomBlock = this.context.isCustomBlock,
        upvars = this.context.upvars;

    if (counter < 1) { // was '=== 0', which caused infinite loops on non-ints
        return null;
    }
    this.popContext();

    this.pushContext(block, outer);

    this.context.isLambda = isLambda;
    this.context.isImplicitLambda = isImplicitLambda;
    this.context.isCustomBlock = isCustomBlock;
    this.context.upvars = new UpvarReference(upvars);

    this.context.addInput(counter - 1);

    this.pushContext('doYield');
    if (body) {
        this.pushContext(body.blockSequence());
    }

    this.pushContext();
};

Process.prototype.doUntil = function (goalCondition, body) {
    if (goalCondition) {
        this.popContext();
        this.pushContext('doYield');
        return null;
    }
    this.context.inputs = [];
    this.pushContext('doYield');
    if (body) {
        this.pushContext(body.blockSequence());
    }
    this.pushContext();
};

Process.prototype.doWaitUntil = function (goalCondition) {
    if (goalCondition) {
        this.popContext();
        this.pushContext('doYield');
        return null;
    }
    this.context.inputs = [];
    this.pushContext('doYield');
    this.pushContext();
};

Process.prototype.reportMap = function (reporter, list) {
    // answer a new list containing the results of the reporter applied
    // to each value of the given list. Distinguish between linked and
    // arrayed lists.
    // Note: This method utilizes the current context's inputs array to
    // manage temporary variables, whose allocation to which slot are
    // documented in each of the variants' code (linked or arrayed) below

    var next;
    if (list.isLinked) {
        // this.context.inputs:
        // [0] - reporter
        // [1] - list (original source)
        // -----------------------------
        // [2] - result list (target)
        // [3] - currently last element of result list
        // [4] - current source list (what's left to map)
        // [5] - current value of last function call

        if (this.context.inputs.length < 3) {
            this.context.addInput(new List());
            this.context.inputs[2].isLinked = true;
            this.context.addInput(this.context.inputs[2]);
            this.context.addInput(list);
        }
        if (this.context.inputs[4].length() === 0) {
            this.context.inputs[3].rest = list.cons(this.context.inputs[5]);
            this.returnValueToParentContext(this.context.inputs[2].cdr());
            return;
        }
        if (this.context.inputs.length > 5) {
            this.context.inputs[3].rest = list.cons(this.context.inputs[5]);
            this.context.inputs[3] = this.context.inputs[3].rest;
            this.context.inputs.splice(5);
        }
        next = this.context.inputs[4].at(1);
        this.context.inputs[4] = this.context.inputs[4].cdr();
        this.pushContext();
        this.evaluate(reporter, new List([next]));
    } else { // arrayed
        // this.context.inputs:
        // [0] - reporter
        // [1] - list (original source)
        // -----------------------------
        // [2..n] - result values (target)

        if (this.context.inputs.length - 2 === list.length()) {
            this.returnValueToParentContext(
                new List(this.context.inputs.slice(2))
            );
            return;
        }
        next = list.at(this.context.inputs.length - 1);
        this.pushContext();
        this.evaluate(reporter, new List([next]));
    }
};

// Process interpolated primitives

Process.prototype.doWait = function (secs) {
    if (!this.context.startTime) {
        this.context.startTime = Date.now();
    }
    if ((Date.now() - this.context.startTime) >= (secs * 1000)) {
        return null;
    }
    this.pushContext('doYield');
    this.pushContext();
};

Process.prototype.doSayFor = function (data, secs) {
	this.blockReceiver().bubble(data);
};

Process.prototype.doThinkFor = function (data, secs) {
    this.blockReceiver().doThink(data);
};

Process.prototype.blockReceiver = function () {
    return this.context ? this.context.receiver || this.homeContext.receiver
            : this.homeContext.receiver;
};

// Process URI retrieval (interpolated)

Process.prototype.reportURL = function (url) {
    var response;

    if (!this.httpRequest) {
        this.httpRequest = http.get('http://' + url, function(res) {
			var data = '';
			res.on('data', function (chunk) {
				data += chunk;
			});
			
			res.on('end', function() {
				response = data;
			})

		}).on('error', function(e) {
  			console.log("HTTP error: " + e.message);
		});
    } 
	
	if (response) {
        this.httpRequest = null;
        return response;
    }

    this.pushContext('doYield');
    this.pushContext();
};

// Process event messages primitives

Process.prototype.doBroadcast = function (message) {
    var stage = this.homeContext.receiver.parentThatIsA(Stage),
        hats = [],
        procs = [];

    if (message !== '') {
        stage.lastMessage = message;
        stage.children.concat(stage).forEach(function (morph) {
            if (morph instanceof Sprite || morph instanceof Stage) {
                hats = hats.concat(morph.allHatBlocksFor(message));
            }
        });
        hats.forEach(function (block) {
            procs.push(stage.threads.startProcess(block, stage.isThreadSafe));
        });
    }
    return procs;
};

Process.prototype.doBroadcastAndWait = function (message) {
    if (!this.context.activeSends) {
        this.context.activeSends = this.doBroadcast(message);
    	this.context.activeSends.forEach(
			function(proc) {
				proc.runStep();
			}
		)
	}
 
    this.context.activeSends = this.context.activeSends.filter(
        function (proc) {
            return proc.isRunning();
        }
    );
    if (this.context.activeSends.length === 0) {
        return null;
    }
    this.pushContext('doYield');
    this.pushContext();
};

Process.prototype.getLastMessage = function () {
    var stage;
    if (this.homeContext.receiver) {
        stage = this.homeContext.receiver.parentThatIsA(Stage);
        if (stage) {
            return stage.getLastMessage();
        }
    }
    return '';
};

// Process type inference

Process.prototype.reportIsA = function (thing, typeString) {
    return this.reportTypeOf(thing) === this.inputOption(typeString);
};

Process.prototype.reportTypeOf = function (thing) {
    // answer a string denoting the argument's type
    var exp;
    if (thing === null || (thing === undefined)) {
        return 'nothing';
    }
    if (thing === true || (thing === false)) {
        return 'Boolean';
    }
    if (!isNaN(parseFloat(thing))) {
        return 'number';
    }
    if (isString(thing)) {
        return 'text';
    }
    if (thing instanceof List) {
        return 'list';
    }
    if (thing instanceof Context) {
        if (thing.expression instanceof Ring) {
            return thing.expression.dataType();
        }
        if (thing.expression instanceof ReporterBlock) {
            if (thing.expression.isPredicate) {
                return 'predicate';
            }
            return 'reporter';
        }

        if (thing.expression instanceof Array) {
            exp = thing.expression[thing.pc || 0];
            if (exp.isPredicate) {
                return 'predicate';
            }
            if (exp instanceof Ring) {
                return exp.dataType();
            }
            if (exp instanceof ReporterBlock) {
                return 'reporter';
            }
            if (exp instanceof CommandBlock) {
                return 'command';
            }
            return 'reporter'; // 'ring';
        }

        if (thing.expression instanceof CommandBlock) {
            return 'command';
        }
        return 'reporter'; // 'ring';
    }
    return 'undefined';
};

// Process math primtives

Process.prototype.reportSum = function (a, b) {
    return +a + (+b);
};

Process.prototype.reportDifference = function (a, b) {
    return +a - +b;
};

Process.prototype.reportProduct = function (a, b) {
    return +a * +b;
};

Process.prototype.reportQuotient = function (a, b) {
    return +a / +b;
};

Process.prototype.reportModulus = function (a, b) {
    var x = +a,
        y = +b;
    return ((x % y) + y) % y;
};

Process.prototype.reportRandom = function (min, max) {
    var floor = +min,
        ceil = +max;
    if ((floor % 1 !== 0) || (ceil % 1 !== 0)) {
        return Math.random() * (ceil - floor) + floor;
    }
    return Math.floor(Math.random() * (ceil - floor + 1)) + floor;
};

Process.prototype.reportLessThan = function (a, b) {
    var x = +a,
        y = +b;
    if (isNaN(x) || isNaN(y)) {
        x = a;
        y = b;
    }
    return x < y;
};

Process.prototype.reportNot = function (bool) {
    return !bool;
};

Process.prototype.reportGreaterThan = function (a, b) {
    var x = +a,
        y = +b;
    if (isNaN(x) || isNaN(y)) {
        x = a;
        y = b;
    }
    return x > y;
};

Process.prototype.reportEquals = function (a, b) {
    return snapEquals(a, b);
};

Process.prototype.reportIsIdentical = function (a, b) {
    var tag = 'idTag';
    if (this.isImmutable(a) || this.isImmutable(b)) {
        return snapEquals(a, b);
    }

    function clear() {
        if (Object.prototype.hasOwnProperty.call(a, tag)) {
            delete a[tag];
        }
        if (Object.prototype.hasOwnProperty.call(b, tag)) {
            delete b[tag];
        }
    }

    clear();
    a[tag] = Date.now();
    if (b[tag] === a[tag]) {
        clear();
        return true;
    }
    clear();
    return false;
};

Process.prototype.isImmutable = function (obj) {
    // private
    return contains(
        ['nothing', 'Boolean', 'text', 'number', 'undefined'],
        this.reportTypeOf(obj)
    );
};

Process.prototype.reportTrue = function () {
    return true;
};

Process.prototype.reportFalse = function () {
    return false;
};

Process.prototype.reportRound = function (n) {
    return Math.round(+n);
};

Process.prototype.reportMonadic = function (fname, n) {
    var x = +n,
        result = 0;

    switch (this.inputOption(fname)) {
    case 'abs':
        result = Math.abs(x);
        break;
    case 'floor':
        result = Math.floor(x);
        break;
    case 'sqrt':
        result = Math.sqrt(x);
        break;
    case 'sin':
        result = Math.sin(radians(x));
        break;
    case 'cos':
        result = Math.cos(radians(x));
        break;
    case 'tan':
        result = Math.tan(radians(x));
        break;
    case 'asin':
        result = degrees(Math.asin(x));
        break;
    case 'acos':
        result = degrees(Math.acos(x));
        break;
    case 'atan':
        result = degrees(Math.atan(x));
        break;
    case 'ln':
        result = Math.log(x);
        break;
    case 'log':
        result = 0;
        break;
    case 'e^':
        result = Math.exp(x);
        break;
    case '10^':
        result = 0;
        break;
    default:
        nop();
    }
    return result;
};

Process.prototype.reportTextFunction = function (fname, string) {
    var x = (isNil(string) ? '' : string).toString(),
        result = '';

    switch (this.inputOption(fname)) {
    case 'encode URI':
        result = encodeURI(x);
        break;
    case 'decode URI':
        result = decodeURI(x);
        break;
    case 'encode URI component':
        result = encodeURIComponent(x);
        break;
    case 'decode URI component':
        result = decodeURIComponent(x);
        break;
    case 'XML escape':
        result = new XML_Element().escape(x);
        break;
    case 'XML unescape':
        result = new XML_Element().unescape(x);
        break;
    case 'hex sha512 hash':
        result = hex_sha512(x);
        break;
    default:
        nop();
    }
    return result;
};

Process.prototype.reportJoin = function (a, b) {
    var x = (isNil(a) ? '' : a).toString(),
        y = (isNil(b) ? '' : b).toString();
    return x.concat(y);
};

Process.prototype.reportJoinWords = function (aList) {
    if (aList instanceof List) {
        return aList.asText();
    }
    return (aList || '').toString();
};

// Process string ops

Process.prototype.reportLetter = function (idx, string) {
    var i = +(idx || 0),
        str = (string || '').toString();
    return str[i - 1] || '';
};

Process.prototype.reportStringSize = function (string) {
    if (string instanceof List) { // catch a common user error
        return string.length();
    }
    var str = (string || '').toString();
    return str.length;
};

Process.prototype.reportUnicode = function (string) {
    var str = (string || '').toString()[0];
    return str ? str.charCodeAt(0) : 0;
};

Process.prototype.reportUnicodeAsLetter = function (num) {
    var code = +(num || 0);
    return String.fromCharCode(code);
};

Process.prototype.reportTextSplit = function (string, delimiter) {
    var types = ['text', 'number'],
        strType = this.reportTypeOf(string),
        delType = this.reportTypeOf(this.inputOption(delimiter)),
        str,
        del;
    if (!contains(types, strType)) {
        throw new Error('expecting a text instad of a ' + strType);
    }
    if (!contains(types, delType)) {
        throw new Error('expecting a text delimiter instad of a ' + delType);
    }
    str = (string || '').toString();
    switch (this.inputOption(delimiter)) {
    case 'line':
        del = '\n';
        break;
    case 'tab':
        del = '\t';
        break;
    case 'cr':
        del = '\r';
        break;
    case 'whitespace':
        return new List(str.trim().split(/[\t\r\n ]+/));
    default:
        del = (delimiter || '').toString();
    }
    return new List(str.split(del));
};

// Process debugging

Process.prototype.alert = function (data) {
    // debugging primitives only work in dev mode, otherwise they're nop
    var world;
    if (this.homeContext.receiver) {
        world = this.homeContext.receiver.world();
        if (world.isDevMode) {
            console.log('Debug alert:\n' + data.asArray());
        }
    }
};

Process.prototype.log = function (data) {
    // debugging primitives only work in dev mode, otherwise they're nop
    var world;
    if (this.homeContext.receiver) {
        world = this.homeContext.receiver.world();
        if (world.isDevMode) {
            console.log('Debug log:\n' + data.asArray());
        }
    }
};

// Process motion primitives

Process.prototype.getOtherObject = function (name, thisObj, stageObj) {
    // private, find the sprite indicated by the given name
    // either onstage or in the World's hand

    var stage = isNil(stageObj) ?
                thisObj.parentThatIsA(Stage) : stageObj,
        thatObj = null;

    if (stage) {
        // find the corresponding sprite on the stage
        thatObj = detect(
            stage.children,
            function (morph) {return morph.name === name; }
        );
    }
    return thatObj;
};

// Process temporary cloning (Scratch-style)

Process.prototype.createClone = function (name) {
    var thisObj = this.homeContext.receiver,
        thatObj;

    if (!name) {return; }
    if (thisObj) {
        if (this.inputOption(name) === 'myself') {
            thisObj.createClone();
        } else {
            thatObj = this.getOtherObject(name, thisObj);
            if (thatObj) {
                thatObj.createClone();
            }
        }
    }
};

// Process sensing primitives

Process.prototype.reportContextFor = function (context, otherObj) {
    // Private - return a copy of the context
    // and bind it to another receiver
    var result = copy(context);
    result.receiver = otherObj;
    if (result.outerContext) {
        result.outerContext = copy(result.outerContext);
        result.outerContext.receiver = otherObj;
    }
    return result;
};

Process.prototype.doResetTimer = function () {
    var stage;
    if (this.homeContext.receiver) {
        stage = this.homeContext.receiver.parentThatIsA(Stage);
        if (stage) {
            stage.resetTimer();
        }
    }
};

Process.prototype.reportTimer = function () {
    var stage;
    if (this.homeContext.receiver) {
        stage = this.homeContext.receiver.parentThatIsA(Stage);
        if (stage) {
            return stage.getTimer();
        }
    }
    return 0;
};

// Process Dates and times in Snap
// Map block options to built-in functions
var dateMap = {
    'year' : 'getFullYear',
    'month' : 'getMonth',
    'date': 'getDate',
    'day of week' : 'getDay',
    'hour' : 'getHours',
    'minute' : 'getMinutes',
    'second' : 'getSeconds',
    'time in milliseconds' : 'getTime'
};

Process.prototype.reportDate = function (datefn) {
    var inputFn = this.inputOption(datefn),
        currDate = new Date(),
        func = dateMap[inputFn],
        result = currDate[func]();

    if (!dateMap[inputFn]) { return ''; }

    // Show months as 1-12 and days as 1-7
    if (inputFn === 'month' || inputFn === 'day of week') {
        result += 1;
    }

    return result;
};

// Process code mapping

/*
    for generating textual source code using
    blocks - not needed to run or debug Snap
*/

Process.prototype.doMapCodeOrHeader = function (aContext, anOption, aString) {
    if (this.inputOption(anOption) === 'code') {
        return this.doMapCode(aContext, aString);
    }
    if (this.inputOption(anOption) === 'header') {
        return this.doMapHeader(aContext, aString);
    }
    throw new Error(
        ' \'' + anOption + '\'\nis not a valid option'
    );
};

Process.prototype.doMapHeader = function (aContext, aString) {
    if (aContext instanceof Context) {
        if (aContext.expression instanceof SyntaxElement) {
            return aContext.expression.mapHeader(aString || '');
        }
    }
};

Process.prototype.doMapCode = function (aContext, aString) {
    if (aContext instanceof Context) {
        if (aContext.expression instanceof SyntaxElement) {
            return aContext.expression.mapCode(aString || '');
        }
    }
};

Process.prototype.doMapStringCode = function (aString) {
    Stage.prototype.codeMappings.string = aString || '<#1>';
};

Process.prototype.doMapListCode = function (part, kind, aString) {
    var key1 = '',
        key2 = 'delim';

    if (this.inputOption(kind) === 'parameters') {
        key1 = 'parms_';
    } else if (this.inputOption(kind) === 'variables') {
        key1 = 'tempvars_';
    }

    if (this.inputOption(part) === 'list') {
        key2 = 'list';
    } else if (this.inputOption(part) === 'item') {
        key2 = 'item';
    }

    Stage.prototype.codeMappings[key1 + key2] = aString || '';
};

Process.prototype.reportMappedCode = function (aContext) {
    if (aContext instanceof Context) {
        if (aContext.expression instanceof SyntaxElement) {
            return aContext.expression.mappedCode();
        }
    }
    return '';
};

// Process constant input options

Process.prototype.inputOption = function (dta) {
    // private - for localization
    return dta instanceof Array ? dta[0] : dta;
};

// Process stack

Process.prototype.pushContext = function (expression, outerContext) {
    var upvars = this.context ? this.context.upvars : null;
    this.context = new Context(
        this.context,
        expression,
        outerContext || (this.context ? this.context.outerContext : null),
            // for tail call elimination
        this.context ? // check needed due to tail call elimination
                this.context.receiver : this.homeContext.receiver
    );
    if (upvars) {
        this.context.upvars = new UpvarReference(upvars);
    }
};

Process.prototype.popContext = function () {
    this.context = this.context ? this.context.parentContext : null;
};

Process.prototype.returnValueToParentContext = function (value) {
    // if no parent context exists treat value as result
    if (value !== undefined) {
        var target = this.context ? // in case of tail call elimination
                this.context.parentContext || this.homeContext
            : this.homeContext;
        target.addInput(value);
    }
};

Process.prototype.reportStackSize = function () {
    return this.context ? this.context.stackSize() : 0;
};

Process.prototype.reportFrameCount = function () {
    return this.frameCount;
};

// Context /////////////////////////////////////////////////////////////

function Context(
    parentContext,
    expression,
    outerContext,
    receiver
) {
    this.outerContext = outerContext || null;
    this.parentContext = parentContext || null;
    this.expression = expression || null;
    this.receiver = receiver || null;
    this.variables = new VariableFrame();
    if (this.outerContext) {
        this.variables.parentFrame = this.outerContext.variables;
        this.receiver = this.outerContext.receiver;
    }
    this.upvars = null; // set to an UpvarReference in custom blocks
    this.inputs = [];
    this.pc = 0;
    this.startTime = null;
    this.isLambda = false; // marks the end of a lambda
    this.isImplicitLambda = false; // marks the end of a C-shaped slot
    this.isCustomBlock = false; // marks the end of a custom block's stack
    this.emptySlots = 0; // used for block reification
}

Context.prototype.toString = function () {
    var pref = this.isLambda ? '\u03BB-' : '',
        expr = this.expression;

    if (expr instanceof Array) {
        if (expr.length > 0) {
            expr = '[' + expr[0] + ']';
        }
    }
    return pref + 'Context >> ' + expr + ' ' + this.variables;
};

// Context continuations:

Context.prototype.continuation = function () {
    var cont;
    if (this.expression instanceof Array) {
        cont = this;
    } else if (this.parentContext) {
        cont = this.parentContext;
    } else {
        return new Context(null, 'doStop');
    }
    cont = cont.copyForContinuation();
    cont.isContinuation = true;
    return cont;
};

Context.prototype.copyForContinuation = function () {
    var cpy = copy(this),
        cur = cpy,
        isReporter = !(this.expression instanceof Array);
    if (isReporter) {
        cur.prepareContinuationForBinding();
        while (cur.parentContext) {
            cur.parentContext = copy(cur.parentContext);
            cur = cur.parentContext;
            cur.inputs = [];
        }
    }
    return cpy;
};

Context.prototype.copyForContinuationCall = function () {
    var cpy = copy(this),
        cur = cpy,
        isReporter = !(this.expression instanceof Array);
    if (isReporter) {
        this.expression = this.expression.fullCopy();
        this.inputs = [];
        while (cur.parentContext) {
            cur.parentContext = copy(cur.parentContext);
            cur = cur.parentContext;
            cur.inputs = [];
        }
    }
    return cpy;
};

Context.prototype.prepareContinuationForBinding = function () {
    var pos = this.inputs.length,
        slot;
    this.expression = this.expression.fullCopy();
    slot = this.expression.inputs()[pos];
    if (slot) {
        this.inputs = [];
        // mark slot containing the call/cc reporter with an identifier
        slot.bindingID = 1;
        // and remember the number of detected empty slots
        this.emptySlots = 1;
    }
};

// Context accessing:

Context.prototype.addInput = function (input) {
    this.inputs.push(input);
};

// Context debugging

Context.prototype.stackSize = function () {
    if (!this.parentContext) {
        return 1;
    }
    return 1 + this.parentContext.stackSize();
};



// VariableFrame ///////////////////////////////////////////////////////

function VariableFrame(parentFrame, owner) {
    this.vars = {};
    this.parentFrame = parentFrame || null;
    this.owner = owner || null;
}

VariableFrame.prototype.toString = function () {
    return 'a VariableFrame {' + this.names() + '}';
};

VariableFrame.prototype.copy = function () {
    var frame = new VariableFrame(this.parentFrame);
    frame.vars = copy(this.vars);
    return frame;
};

VariableFrame.prototype.deepCopy = function () {
    // currently unused
    var frame;
    if (this.parentFrame) {
        frame = new VariableFrame(this.parentFrame.deepCopy());
    } else {
        frame = new VariableFrame(this.parentFrame);
    }
    frame.vars = copy(this.vars);
    return frame;
};

VariableFrame.prototype.find = function (name) {
/*
    answer the closest variable frame containing
    the specified variable. otherwise throw an exception.
*/
    var frame = this.silentFind(name);
    if (frame) {return frame; }
    throw new Error(
        'a variable of name \''
            + name
            + '\'\ndoes not exist in this context'
    );
};

VariableFrame.prototype.silentFind = function (name) {
/*
    answer the closest variable frame containing
    the specified variable. Otherwise return null.
*/
    if (this.vars[name] !== undefined) {
        return this;
    }
    if (this.parentFrame) {
        return this.parentFrame.silentFind(name);
    }
    return null;
};

VariableFrame.prototype.setVar = function (name, value) {
/*
    change the specified variable if it exists
    else throw an error, because variables need to be
    declared explicitly (e.g. through a "script variables" block),
    before they can be accessed.
*/
    var frame = this.find(name);
    if (frame) {
        frame.vars[name] = value;
    }
};

VariableFrame.prototype.changeVar = function (name, delta) {
/*
    change the specified variable if it exists
    else throw an error, because variables need to be
    declared explicitly (e.g. through a "script variables" block,
    before they can be accessed.
*/
    var frame = this.find(name),
        value;
    if (frame) {
        value = parseFloat(frame.vars[name]);
        if (isNaN(value)) {
            frame.vars[name] = delta;
        } else {
            frame.vars[name] = value + parseFloat(delta);
        }
    }
};

VariableFrame.prototype.getVar = function (name, upvars) {
    var frame = this.silentFind(name),
        value,
        upvarReference;
    if (frame) {
        value = frame.vars[name];
        return (value === 0 ? 0
                : value === false ? false
                        : value === '' ? ''
                            : value || 0); // don't return null
    }
    if (typeof name === 'number') {
        // empty input with a Binding-ID called without an argument
        return '';
    }
    if (upvars) {
        upvarReference = upvars.find(name);
        if (upvarReference) {
            return upvarReference.getVar(name);
        }
    }
    throw new Error(
        'a variable of name \''
            + name
            + '\'\ndoes not exist in this context'
    );
};

VariableFrame.prototype.addVar = function (name, value) {
    this.vars[name] = (value === 0 ? 0
              : value === false ? false
                       : value === '' ? '' : value || null);
};

VariableFrame.prototype.deleteVar = function (name) {
    var frame = this.find(name);
    if (frame) {
        delete frame.vars[name];
    }
};

// VariableFrame tools

VariableFrame.prototype.names = function () {
    var each, names = [];
    for (each in this.vars) {
        if (Object.prototype.hasOwnProperty.call(this.vars, each)) {
            names.push(each);
        }
    }
    return names;
};

VariableFrame.prototype.allNamesDict = function () {
    var dict = {}, current = this;

    function addKeysToDict(srcDict, trgtDict) {
        var eachKey;
        for (eachKey in srcDict) {
            if (Object.prototype.hasOwnProperty.call(srcDict, eachKey)) {
                trgtDict[eachKey] = eachKey;
            }
        }
    }

    while (current) {
        addKeysToDict(current.vars, dict);
        current = current.parentFrame;
    }
    return dict;
};

VariableFrame.prototype.allNames = function () {
/*
    only show the names of the lexical scope, hybrid scoping is
    reserved to the daring ;-)
*/
    var answer = [], each, dict = this.allNamesDict();

    for (each in dict) {
        if (Object.prototype.hasOwnProperty.call(dict, each)) {
            answer.push(each);
        }
    }
    return answer;
};




// UpvarReference ///////////////////////////////////////////////////////////

// ... quasi-inherits some features from VariableFrame

function UpvarReference(parent) {
    this.vars = {}; // structure: {upvarName : [varName, varFrame]}
    this.parentFrame = parent || null;
}

UpvarReference.prototype.addReference = function (
    upvarName,
    varName,
    varFrame
) {
    this.vars[upvarName] = [varName, varFrame];
};

UpvarReference.prototype.find = function (name) {
/*
    answer the closest upvar reference containing
    the specified variable, or answer null.
*/
    if (this.vars[name] !== undefined) {
        return this;
    }
    if (this.parentFrame) {
        return this.parentFrame.find(name);
    }
    return null;
};

UpvarReference.prototype.getVar = function (name) {
    var varName = this.vars[name][0],
        varFrame = this.vars[name][1],
        value = varFrame.vars[varName];
    return (value === 0 ? 0 : value || 0); // don't return null
};

// UpvarReference tools

UpvarReference.prototype.toString = function () {
    return 'an UpvarReference {' + this.names() + '}';
};

// UpvarReference quasi-inheritance from VariableFrame

UpvarReference.prototype.names = VariableFrame.prototype.names;
UpvarReference.prototype.allNames = VariableFrame.prototype.allNames;
UpvarReference.prototype.allNamesDict = VariableFrame.prototype.allNamesDict;


// coming from file(s)
// objects.js

// Sprite /////////////////////////////////////////////////////////

// I am a scriptable object

// Sprite inherits from SteppingNode:

Sprite.prototype = new SteppingNode();
Sprite.prototype.constructor = Sprite;
Sprite.uber = SteppingNode.prototype;

// Sprite settings

Sprite.prototype.categories =
    [
        'control',
        'looks',
        'sensing',
        'operators',
        'variables',
        'lists',
        'other'
    ];

Sprite.prototype.useFlatLineEnds = false;

Sprite.prototype.initBlocks = function () {
    Sprite.prototype.blocks = {

        // Looks
        doSayFor: {
            type: 'command',
            category: 'looks',
            spec: 'say %s for %n secs',
            defaults: [localize('Hello!'), 2]
        },
        bubble: {
            type: 'command',
            category: 'looks',
            spec: 'say %s',
            defaults: [localize('Hello!')]
        },
        doThinkFor: {
            type: 'command',
            category: 'looks',
            spec: 'think %s for %n secs',
            defaults: [localize('Hmm...'), 2]
        },
        doThink: {
            type: 'command',
            category: 'looks',
            spec: 'think %s',
            defaults: [localize('Hmm...')]
        },

        // Looks - Debugging primitives for development mode
        alert: {
            type: 'command',
            category: 'looks',
            spec: 'alert %mult%s'
        },
        log: {
            type: 'command',
            category: 'looks',
            spec: 'console log %mult%s'
        },

        // Control
        receiveGo: {
            type: 'hat',
            category: 'control',
            spec: 'when %greenflag clicked'
        },
        receiveMessage: {
            type: 'hat',
            category: 'control',
            spec: 'when I receive %msgHat'
        },
        doBroadcast: {
            type: 'command',
            category: 'control',
            spec: 'broadcast %msg'
        },
        doBroadcastAndWait: {
            type: 'command',
            category: 'control',
            spec: 'broadcast %msg and wait'
        },
        getLastMessage: {
            type: 'reporter',
            category: 'control',
            spec: 'message'
        },
        doWait: {
            type: 'command',
            category: 'control',
            spec: 'wait %n secs',
            defaults: [1]
        },
        doWaitUntil: {
            type: 'command',
            category: 'control',
            spec: 'wait until %b'
        },
        doForever: {
            type: 'command',
            category: 'control',
            spec: 'forever %c'
        },
        doRepeat: {
            type: 'command',
            category: 'control',
            spec: 'repeat %n %c',
            defaults: [10]
        },
        doUntil: {
            type: 'command',
            category: 'control',
            spec: 'repeat until %b %c'
        },
        doIf: {
            type: 'command',
            category: 'control',
            spec: 'if %b %c'
        },
        doIfElse: {
            type: 'command',
            category: 'control',
            spec: 'if %b %c else %c'
        },
        doStopThis: {
            type: 'command',
            category: 'control',
            spec: 'stop %stopChoices'
        },
        doStopOthers: {
            type: 'command',
            category: 'control',
            spec: 'stop %stopOthersChoices'
        },
        doRun: {
            type: 'command',
            category: 'control',
            spec: 'run %cmdRing %inputs'
        },
        fork: {
            type: 'command',
            category: 'control',
            spec: 'launch %cmdRing %inputs'
        },
        evaluate: {
            type: 'reporter',
            category: 'control',
            spec: 'call %repRing %inputs'
        },
        doReport: {
            type: 'command',
            category: 'control',
            spec: 'report %s'
        },
        doCallCC: {
            type: 'command',
            category: 'control',
            spec: 'run %cmdRing w/continuation'
        },
        reportCallCC: {
            type: 'reporter',
            category: 'control',
            spec: 'call %cmdRing w/continuation'
        },
        doWarp: {
            type: 'command',
            category: 'other',
            spec: 'warp %c'
        },

        // Cloning - very experimental
        receiveOnClone: {
            type: 'hat',
            category: 'control',
            spec: 'when I start as a clone'
        },
        createClone: {
            type: 'command',
            category: 'control',
            spec: 'create a clone of %cln'
        },
        removeClone: {
            type: 'command',
            category: 'control',
            spec: 'delete this clone'
        },

        // Debugging - pausing

        doPauseAll: {
            type: 'command',
            category: 'control',
            spec: 'pause all %pause'
        },

        // Sensing

        reportStackSize: {
            type: 'reporter',
            category: 'sensing',
            spec: 'stack size'
        },
        reportFrameCount: {
            type: 'reporter',
            category: 'sensing',
            spec: 'frames'
        },
        doResetTimer: {
            type: 'command',
            category: 'sensing',
            spec: 'reset timer'
        },
        reportTimer: { // retained for legacy compatibility
            type: 'reporter',
            category: 'sensing',
            spec: 'timer'
        },
        getTimer: {
            type: 'reporter',
            category: 'sensing',
            spec: 'timer'
        },
        reportAttributeOf: {
            type: 'reporter',
            category: 'sensing',
            spec: '%att of %spr',
            defaults: [['costume #']]
        },
        reportURL: {
            type: 'reporter',
            category: 'sensing',
            spec: 'http:// %s',
            defaults: ['snap.berkeley.edu']
        },
		reportDate: {
            type: 'reporter',
            category: 'sensing',
            spec: 'current %dates'
        },

        // Operators
        reifyScript: {
            type: 'ring',
            category: 'other',
            spec: '%rc %ringparms'
        },
        reifyReporter: {
            type: 'ring',
            category: 'other',
            spec: '%rr %ringparms'
        },
        reifyPredicate: {
            type: 'ring',
            category: 'other',
            spec: '%rp %ringparms'
        },
        reportSum: {
            type: 'reporter',
            category: 'operators',
            spec: '%n + %n'
        },
        reportDifference: {
            type: 'reporter',
            category: 'operators',
            spec: '%n \u2212 %n'
        },
        reportProduct: {
            type: 'reporter',
            category: 'operators',
            spec: '%n \u00D7 %n'
        },
        reportQuotient: {
            type: 'reporter',
            category: 'operators',
            spec: '%n / %n' // '%n \u00F7 %n'
        },
        reportRound: {
            type: 'reporter',
            category: 'operators',
            spec: 'round %n'
        },
        reportMonadic: {
            type: 'reporter',
            category: 'operators',
            spec: '%fun of %n',
            defaults: [null, 10]
        },
        reportModulus: {
            type: 'reporter',
            category: 'operators',
            spec: '%n mod %n'
        },
        reportRandom: {
            type: 'reporter',
            category: 'operators',
            spec: 'pick random %n to %n',
            defaults: [1, 10]
        },
        reportLessThan: {
            type: 'predicate',
            category: 'operators',
            spec: '%s < %s'
        },
        reportEquals: {
            type: 'predicate',
            category: 'operators',
            spec: '%s = %s'
        },
        reportGreaterThan: {
            type: 'predicate',
            category: 'operators',
            spec: '%s > %s'
        },
        reportAnd: {
            type: 'predicate',
            category: 'operators',
            spec: '%b and %b'
        },
        reportOr: {
            type: 'predicate',
            category: 'operators',
            spec: '%b or %b'
        },
        reportNot: {
            type: 'predicate',
            category: 'operators',
            spec: 'not %b'
        },
        reportTrue: {
            type: 'predicate',
            category: 'operators',
            spec: 'true'
        },
        reportFalse: {
            type: 'predicate',
            category: 'operators',
            spec: 'false'
        },
        reportJoinWords: {
            type: 'reporter',
            category: 'operators',
            spec: 'join %words',
            defaults: [localize('hello') + ' ', localize('world')]
        },
        reportLetter: {
            type: 'reporter',
            category: 'operators',
            spec: 'letter %n of %s',
            defaults: [1, localize('world')]
        },
        reportStringSize: {
            type: 'reporter',
            category: 'operators',
            spec: 'length of %s',
            defaults: [localize('world')]
        },
        reportUnicode: {
            type: 'reporter',
            category: 'operators',
            spec: 'unicode of %s',
            defaults: ['a']
        },
        reportUnicodeAsLetter: {
            type: 'reporter',
            category: 'operators',
            spec: 'unicode %n as letter',
            defaults: [65]
        },
        reportIsA: {
            type: 'predicate',
            category: 'operators',
            spec: 'is %s a %typ ?',
            defaults: [5]
        },
        reportIsIdentical: {
            type: 'predicate',
            category: 'operators',
            spec: 'is %s identical to %s ?'
        },
        reportTextSplit: {
            type: 'reporter',
            category: 'operators',
            spec: 'split %s by %delim',
            defaults: [localize('hello') + ' ' + localize('world'), " "]
        },
        reportTypeOf: { // only in dev mode for debugging
            type: 'reporter',
            category: 'operators',
            spec: 'type of %s',
            defaults: [5]
        },
        reportTextFunction: { // only in dev mode - experimental
            type: 'reporter',
            category: 'operators',
            spec: '%txtfun of %s',
            defaults: [null, "Abelson & Sussman"]
        },

        // Variables
        doSetVar: {
            type: 'command',
            category: 'variables',
            spec: 'set %var to %s',
            defaults: [null, 0]
        },
        doChangeVar: {
            type: 'command',
            category: 'variables',
            spec: 'change %var by %n',
            defaults: [null, 1]
        },
        doDeclareVariables: {
            type: 'command',
            category: 'other',
            spec: 'script variables %scriptVars'
        },

        // Lists
        reportNewList: {
            type: 'reporter',
            category: 'lists',
            spec: 'list %exp'
        },
        reportCONS: {
            type: 'reporter',
            category: 'lists',
            spec: '%s in front of %l'
        },
        reportListItem: {
            type: 'reporter',
            category: 'lists',
            spec: 'item %idx of %l',
            defaults: [1]
        },
        reportCDR: {
            type: 'reporter',
            category: 'lists',
            spec: 'all but first of %l'
        },
        reportListLength: {
            type: 'reporter',
            category: 'lists',
            spec: 'length of %l'
        },
        reportListContainsItem: {
            type: 'predicate',
            category: 'lists',
            spec: '%l contains %s',
            defaults: [null, localize('thing')]
        },
        doAddToList: {
            type: 'command',
            category: 'lists',
            spec: 'add %s to %l',
            defaults: [localize('thing')]
        },
        doDeleteFromList: {
            type: 'command',
            category: 'lists',
            spec: 'delete %ida of %l',
            defaults: [1]
        },
        doInsertInList: {
            type: 'command',
            category: 'lists',
            spec: 'insert %s at %idx of %l',
            defaults: [localize('thing'), 1]
        },
        doReplaceInList: {
            type: 'command',
            category: 'lists',
            spec: 'replace item %idx of %l with %s',
            defaults: [1, null, localize('thing')]
        },

        // MAP - experimental
        reportMap: {
            type: 'reporter',
            category: 'lists',
            spec: 'map %repRing over %l'
        },

        // Code mapping - experimental
        doMapCodeOrHeader: { // experimental
            type: 'command',
            category: 'other',
            spec: 'map %cmdRing to %codeKind %code'
        },
        doMapStringCode: { // experimental
            type: 'command',
            category: 'other',
            spec: 'map String to code %code',
            defaults: ['<#1>']
        },
        doMapListCode: { // experimental
            type: 'command',
            category: 'other',
            spec: 'map %codeListPart of %codeListKind to code %code'
        },
        reportMappedCode: { // experimental
            type: 'reporter',
            category: 'other',
            spec: 'code of %cmdRing'
        }
    };
};

Sprite.prototype.initBlocks();

Sprite.prototype.initBlockMigrations = function () {
    Sprite.prototype.blockMigrations = {
        doStopAll: {
            selector: 'doStopThis',
            inputs: [['all']]
        },
        doStop: {
            selector: 'doStopThis',
            inputs: [['this script']]
        },
        doStopBlock: {
            selector: 'doStopThis',
            inputs: [['this block']]
        }
    };
};

Sprite.prototype.initBlockMigrations();

// Sprite instance creation

function Sprite(globals) {
    this.init(globals);
}

Sprite.prototype.init = function (globals) {
    this.name = localize('Sprite');
    this.variables = new VariableFrame(globals || null, this);
    this.scripts = new SteppingNode();
	this.scripts.owner = this;
    this.version = Date.now(); // for observer optimization
    this.isClone = false; // indicate a "temporary" Scratch-style clone
    this.cloneOriginName = '';

    this.blocksCache = {}; // not to be serialized (!)
    this.idx = 0; // not to be serialized (!) - used for de-serialization
    this.wasWarped = false; // not to be serialized, used for fast-tracking

    Sprite.uber.init.call(this);
};

// Sprite duplicating (fullCopy)

Sprite.prototype.fullCopy = function () {
    var c = Sprite.uber.fullCopy.call(this),
        cb;

    c.stopTalking();
    c.blocksCache = {};
    c.scripts = this.scripts.fullCopy();
    c.scripts.owner = c;
    c.variables = this.variables.copy();
    c.variables.owner = c;

    c.parts = [];

    return c;
};

// Sprite versioning

Sprite.prototype.setName = function (string) {
    this.name = string || this.name;
    this.version = Date.now();
};

// Sprite block instantiation

Sprite.prototype.blockForSelector = function (selector, setDefaults) {
    var migration, info, block, defaults, inputs, i;
    migration = this.blockMigrations[selector];
    info = this.blocks[migration ? migration.selector : selector];
    if (!info) {return null; }
    block = info.type === 'command' ? new CommandBlock()
        : info.type === 'hat' ? new HatBlock()
            : info.type === 'ring' ? new Ring()
                : new ReporterBlock(info.type === 'predicate');
    block.category = info.category;
    block.selector = selector;
    if (contains(['reifyReporter', 'reifyPredicate'], block.selector)) {
        block.isStatic = true;
    }
    block.setSpec(localize(info.spec));
    if ((setDefaults && info.defaults) || (migration && migration.inputs)) {
        defaults = migration ? migration.inputs : info.defaults;
        block.defaults = defaults;
        inputs = block.inputs();
        if (inputs[0] instanceof MultiArgument) {
            inputs[0].setContents(defaults);
            inputs[0].defaults = defaults;
        } else {
            for (i = 0; i < defaults.length; i += 1) {
                if (defaults[i]) {
                    inputs[i].setContents(defaults[i]);
                }
            }
        }
    }
    return block;
};

Sprite.prototype.variableBlock = function (varName) {
    var block = new ReporterBlock(false);
    block.selector = 'reportGetVar';
    block.category = 'variables';
    block.setSpec(varName);
    return block;
};

// Sprite variable management

Sprite.prototype.addVariable = function (name, isGlobal) {
    var ide = this.parentThatIsA(IDE_Morph);
    if (isGlobal) {
        this.variables.parentFrame.addVar(name);
        if (ide) {
            ide.flushBlocksCache('variables');
        }
    } else {
        this.variables.addVar(name);
        this.blocksCache.variables = null;
    }
};

// Sprite cloning (experimental)

Sprite.prototype.createClone = function () {
    var clone,
        hats,
        stage = this.parentThatIsA(Stage);
    if (stage) {
        if (stage.cloneCount > 300) {return; }
        stage.cloneCount += 1;
        clone = this.fullCopy();
        clone.isClone = true;
        clone.name = '';
        clone.cloneOriginName = this.isClone ?
                this.cloneOriginName : this.name;
        stage.add(clone);
        hats = clone.allHatBlocksFor('__clone__init__');
        hats.forEach(function (block) {
            stage.threads.startProcess(block, stage.isThreadSafe);
        });
    }
};

Sprite.prototype.removeClone = function () {
    if (this.isClone) {
        // this.stopTalking();
        this.parent.threads.stopAllForReceiver(this);
        this.destroy();
        this.parent.cloneCount -= 1;
    }
};

// Sprite talk

Sprite.prototype.stopTalking = function () {
	nop()
};

Sprite.prototype.doThink = function (data) {
    this.bubble(data, true);
};

Sprite.prototype.bubble = function (data, isThought, isQuestion) {
	var text = this.name;
    if (data === '' || isNil(data)) {return; }
	if (isThought) { text += ' thinks: ' + data } else { text += ' says: ' + data }
	console.log(text);
};

// Sprite message broadcasting

Sprite.prototype.allMessageNames = function () {
    var msgs = [];
    this.scripts.allChildren().forEach(function (morph) {
        var txt;
        if (morph.selector) {
            if (contains(
                    ['receiveMessage', 'doBroadcast', 'doBroadcastAndWait'],
                    morph.selector
                )) {
                txt = morph.inputs()[0].evaluate();
                if (isString(txt) && txt !== '') {
                    if (!contains(msgs, txt)) {
                        msgs.push(txt);
                    }
                }
            }
        }
    });
    return msgs;
};

Sprite.prototype.allHatBlocksFor = function (message) {
    return this.scripts.children.filter(function (morph) {
        var event;
        if (morph.selector) {
            if (morph.selector === 'receiveMessage') {
                event = morph.inputs()[0].evaluate();
                return event === message || (event instanceof Array);
            }
            if (morph.selector === 'receiveGo') {
                return message === '__shout__go__';
            }
            if (morph.selector === 'receiveOnClone') {
                return message === '__clone__init__';
            }
            if (morph.selector === 'receiveClick') {
                return message === '__click__';
            }
        }
        return false;
    });
};

// Sprite timer

Sprite.prototype.getTimer = function () {
    var stage = this.parentThatIsA(Stage);
    if (stage) {
        return stage.getTimer();
    }
    return 0;
};

// Sprite last message

Sprite.prototype.getLastMessage = function () {
    var stage = this.parentThatIsA(Stage);
    if (stage) {
        return stage.getLastMessage();
    }
    return '';
};


// Stage /////////////////////////////////////////////////////////

/*
    I inherit from SteppingNode and copy from Sprite.
*/

// Stage inherits from FrameMorph:

Stage.prototype = new SteppingNode();
Stage.prototype.constructor = Stage;
Stage.uber = SteppingNode.prototype;

// Stage preferences settings

Stage.prototype.frameRate = 0; // unscheduled per default

Stage.prototype.isCachingPrimitives
    = Sprite.prototype.isCachingPrimitives;

Stage.prototype.hiddenPrimitives = {};
Stage.prototype.codeMappings = {};
Stage.prototype.codeHeaders = {};
Stage.prototype.enableCodeMapping = false;

// Stage instance creation

function Stage(globals) {
    this.init(globals);
}

Stage.prototype.init = function (globals) {
    this.name = localize('Stage');
    this.threads = new ThreadManager();
    this.variables = new VariableFrame(globals || null, this);
    this.scripts = new SteppingNode();
	this.scripts.owner = this;
    this.customBlocks = [];
    this.globalBlocks = [];
    this.version = Date.now(); // for observers
    this.cloneCount = 0;

    this.timerStart = Date.now();
    this.lastMessage = '';

    this.blocksCache = {}; // not to be serialized (!)
    this.paletteCache = {}; // not to be serialized (!)

    this.isThreadSafe = false;

    Stage.uber.init.call(this);

    this.fps = this.frameRate;
};

// Stage timer

Stage.prototype.resetTimer = function () {
    this.timerStart = Date.now();
};

Stage.prototype.getTimer = function () {
    var elapsed = Math.floor((Date.now() - this.timerStart) / 100);
    return elapsed / 10;
};

// Stage messages

Stage.prototype.getLastMessage = function () {
    return this.lastMessage || '';
};

// Stage stepping

Stage.prototype.step = function () {
    var current, elapsed, leftover; 
    // manage threads
    if (this.isFastTracked && this.threads.processes.length) {
        this.children.forEach(function (morph) {
            if (morph instanceof Sprite) {
                morph.wasWarped = morph.isWarped;
                if (!morph.isWarped) {
                    morph.startWarp();
                }
            }
        });
        while ((Date.now() - this.lastTime) < 100) {
            this.threads.step();
        }
        this.children.forEach(function (morph) {
            if (morph instanceof Sprite) {
                if (!morph.wasWarped) {
                    morph.endWarp();
                }
            }
        });
    } else {
        this.threads.step();
    }
};

Stage.prototype.fireGreenFlagEvent = function () {
    var procs = [],
        hats = [],
        myself = this;

    this.children.concat(this).forEach(function (morph) {
        if (morph instanceof Sprite || morph instanceof Stage) {
            hats = hats.concat(morph.allHatBlocksFor('__shout__go__'));
        }
    });
    hats.forEach(function (block) {
        procs.push(myself.threads.startProcess(
            block,
            myself.isThreadSafe
        ));
    });
	return procs;
};

Stage.prototype.fireStopAllEvent = function () {
    this.threads.resumeAll(this.stage);
    this.threads.stopAll();
    this.removeAllClones();
};

Stage.prototype.removeAllClones = function () {
    var myself = this,
        clones = this.children.filter(
            function (morph) {return morph.isClone; }
        );
    clones.forEach(function (clone) {
        myself.threads.stopAllForReceiver(clone);
        clone.destroy();
    });
    this.cloneCount = 0;
};

Stage.prototype.edit = Sprite.prototype.edit;

// Stage cloning overrice

Stage.prototype.createClone = nop;

// Stage pseudo-inherited behavior

Stage.prototype.categories = Sprite.prototype.categories;
Stage.prototype.setName = Sprite.prototype.setName;

// Stage block rendering

Stage.prototype.blockForSelector
    = Sprite.prototype.blockForSelector;

// Stage message broadcasting

Stage.prototype.allMessageNames
    = Sprite.prototype.allMessageNames;

Stage.prototype.allHatBlocksFor
    = Sprite.prototype.allHatBlocksFor;

Stage.prototype.allHatBlocksForKey
    = Sprite.prototype.allHatBlocksForKey;





// ReadStream ////////////////////////////////////////////////////////////

// I am a sequential reading interface to an Array or String

/*
var ReadStream;
var XML_Element;
*/

// ReadStream instance creation:

function ReadStream(arrayOrString) {
    this.contents = arrayOrString || '';
    this.index = 0;
}

// ReadStream constants:

ReadStream.prototype.space = /[\s]/;

// ReadStream accessing:

ReadStream.prototype.next = function (count) {
    var element, start;
    if (count === undefined) {
        element = this.contents[this.index];
        this.index += 1;
        return element;
    }
    start = this.index;
    this.index += count;
    return this.contents.slice(start, this.index);
};

ReadStream.prototype.peek = function () {
    return this.contents[this.index];
};

ReadStream.prototype.skip = function (count) {
    this.index += count || 1;
};

ReadStream.prototype.atEnd = function () {
    return this.index > (this.contents.length - 1);
};

// ReadStream accessing String contents:

ReadStream.prototype.upTo = function (regex) {
    var i, start;
    if (!isString(this.contents)) {return ''; }
    i = this.contents.substr(this.index).search(regex);
    if (i === -1) {
        return '';
    }
    start = this.index;
    this.index += i;
    return this.contents.substring(start, this.index);
};

ReadStream.prototype.peekUpTo = function (regex) {
    if (!isString(this.contents)) {return ''; }
    var i = this.contents.substr(this.index).search(regex);
    if (i === -1) {
        return '';
    }
    return this.contents.substring(this.index, this.index + i);
};

ReadStream.prototype.skipSpace = function () {
    if (!isString(this.contents)) {return ''; }
    var ch = this.peek();
    while (this.space.test(ch) && ch !== '') {
        this.skip();
        ch = this.peek();
    }
};

ReadStream.prototype.word = function () {
    var i, start;
    if (!isString(this.contents)) {return ''; }
    i = this.contents.substr(this.index).search(/[\s\>\/\=]|$/);
    if (i === -1) {
        return '';
    }
    start = this.index;
    this.index += i;
    return this.contents.substring(start, this.index);
};


// coming from file(s)
// lists.js

var List;

// List instance creation:

function List(array) {
    this.contents = array || [];
    this.first = null;
    this.rest = null;
    this.isLinked = false;
    this.lastChanged = Date.now();
}

List.prototype.toString = function () {
    return 'a List [' + this.asArray + ']';
};

// List updating:

List.prototype.changed = function () {
    this.lastChanged = Date.now();
};

// Linked List ops:

List.prototype.cons = function (car, cdr) {
    var answer = new List();
    answer.first = isNil(car) ? null : car;
    answer.rest = cdr || null;
    answer.isLinked = true;
    return answer;
};

List.prototype.cdr = function () {
    function helper(i) {
        if (i > this.contents.length) {
            return new List();
        }
        return this.cons(this.at(i), helper.call(this, i + 1));
    }
    if (this.isLinked) {
        return this.rest || new List();
    }
    if (this.contents.length < 2) {
        return new List();
    }
    return helper.call(this, 2);
};

// List array setters:

List.prototype.add = function (element, index) {
/*
    insert the element before the given slot index,
    if no index is specifed, append the element
*/
    var idx = index || this.length() + 1,
        obj = element === 0 ? 0
                : element === false ? false
                        : element || null;
    this.becomeArray();
    this.contents.splice(idx - 1, 0, obj);
    this.changed();
};

List.prototype.put = function (element, index) {
    // exchange the element at the given slot for another
    var data = element === 0 ? 0
            : element === false ? false
                    : element || null;

    this.becomeArray();
    this.contents[index - 1] = data;
    this.changed();
};

List.prototype.remove = function (index) {
    // remove the given slot, shortening the list
    this.becomeArray();
    this.contents.splice(index - 1, 1);
    this.changed();
};

List.prototype.clear = function () {
    this.contents = [];
    this.first = null;
    this.rest = null;
    this.isLinked = false;
    this.changed();
};

// List getters (all hybrid):

List.prototype.length = function () {
    if (this.isLinked) {
        return (this.first === undefined ? 0 : 1)
            + (this.rest ? this.rest.length() : 0);
    }
    return this.contents.length;
};

List.prototype.at = function (index) {
    var value, idx = +index;
    if (this.isLinked) {
        return idx === 1 ? this.first : this.rest.at(idx - 1);
    }
    value = this.contents[idx - 1];
    return isNil(value) ? '' : value;
};

List.prototype.contains = function (element) {
    if (this.isLinked) {
        if (snapEquals(this.first, element)) {
            return true;
        }
        if (this.rest instanceof List) {
            return this.rest.contains(element);
        }
    }
    // in case I'm arrayed
    return this.contents.some(function (any) {
        return snapEquals(any, element);
    });
};

// List conversion:

List.prototype.asArray = function () {
    // for use in the evaluator
    this.becomeArray();
    return this.contents;
};

List.prototype.asText = function () {
    var result = '',
        length = this.length(),
        element,
        i;
    for (i = 1; i <= length; i += 1) {
        element = this.at(i);
        if (element instanceof List) {
            result = result.concat(element.asText());
        } else {
            element = isNil(element) ? '' : element.toString();
            result = result.concat(element);
        }
    }
    return result;
};

List.prototype.becomeArray = function () {
    if (this.isLinked) {
        var next = this;
        this.contents = [];
        while (next instanceof List && (next.length() > 0)) {
            this.contents.push(next.at(1));
            next = next.cdr();
        }
        this.isLinked = false;
    }
};

List.prototype.becomeLinked = function () {
    var i, stop, tail = this;
    if (!this.isLinked) {
        stop = this.length();
        for (i = 0; i < stop; i += 1) {
            tail.first = this.contents[i];
            tail.rest = new List();
            tail.isLinked = true;
            tail = tail.rest;
        }
        this.contents = [];
        this.isLinked = true;
    }
};

// List testing

List.prototype.equalTo = function (other) {
    var i;
    if (!(other instanceof List)) {
        return false;
    }
    if ((!this.isLinked) && (!other.isLinked)) {
        if (this.length() === 0 && (other.length() === 0)) {
            return true;
        }
        if (this.length() !== other.length()) {
            return false;
        }
        for (i = 0; i < this.length(); i += 1) {
            if (!snapEquals(this.contents[i], other.contents[i])) {
                return false;
            }
        }
        return true;
    }
    if ((this.isLinked) && (other.isLinked)) {
        if (snapEquals(this.at(1), other.at(1))) {
            return this.cdr().equalTo(other.cdr());
        }
        return false;
    }
    if (this.length() !== other.length()) {
        return false;
    }
    for (i = 0; i < this.length(); i += 1) {
        if (!snapEquals(this.at(i), other.at(i))) {
            return false;
        }
    }
    return true;
};



// coming from file(s)
// xml.js

// XML_Element ///////////////////////////////////////////////////////////
/*
    I am a DOM-Node which can encode itself to as well as parse itself
    from a well-formed XML string. Note that there is no separate parser
    object, all the parsing can be done in a single object.
*/

// XML_Element inherits from Node:

XML_Element.prototype = new Node();
XML_Element.prototype.constructor = XML_Element;
XML_Element.uber = Node.prototype;

// XML_Element preferences settings:

XML_Element.prototype.indentation = '  ';

// XML_Element instance creation:

function XML_Element(tag, contents, parent) {
    this.init(tag, contents, parent);
}

XML_Element.prototype.init = function (tag, contents, parent) {
    // additional properties:
    this.tag = tag || 'unnamed';
    this.attributes = {};
    this.contents = contents || '';

    // initialize inherited properties:
    XML_Element.uber.init.call(this);

    // override inherited properties
    if (parent instanceof XML_Element) {
        parent.addChild(this);
    }
};

// XML_Element DOM navigation: (aside from what's inherited from Node)

XML_Element.prototype.require = function (tagName) {
    // answer the first direct child with the specified tagName, or throw
    // an error if it doesn't exist
    var child = this.childNamed(tagName);
    if (!child) {
        throw new Error('Missing required element <' + tagName + '>!');
    }
    return child;
};

XML_Element.prototype.childNamed = function (tagName) {
    // answer the first direct child with the specified tagName, or null
    return detect(
        this.children,
        function (child) {return child.tag === tagName; }
    );
};

XML_Element.prototype.childrenNamed = function (tagName) {
    // answer all direct children with the specified tagName
    return this.children.filter(
        function (child) {return child.tag === tagName; }
    );
};

XML_Element.prototype.parentNamed = function (tagName) {
    // including myself
    if (this.tag === tagName) {
        return this;
    }
    if (!this.parent) {
        return null;
    }
    return this.parent.parentNamed(tagName);
};

// XML_Element output:

XML_Element.prototype.toString = function (isFormatted, indentationLevel) {
    var result = '',
        indent = '',
        level = indentationLevel || 0,
        key,
        i;

    // spaces for indentation, if any
    if (isFormatted) {
        for (i = 0; i < level; i += 1) {
            indent += this.indentation;
        }
        result += indent;
    }

    // opening tag
    result += ('<' + this.tag);

    // attributes, if any
    for (key in this.attributes) {
        if (Object.prototype.hasOwnProperty.call(this.attributes, key)
                && this.attributes[key]) {
            result += ' ' + key + '="' + this.attributes[key] + '"';
        }
    }

    // contents, subnodes, and closing tag
    if (!this.contents.length && !this.children.length) {
        result += '/>';
    } else {
        result += '>';
        result += this.contents;
        this.children.forEach(function (element) {
            if (isFormatted) {
                result += '\n';
            }
            result += element.toString(isFormatted, level + 1);
        });
        if (isFormatted && this.children.length) {
            result += ('\n' + indent);
        }
        result += '</' + this.tag + '>';
    }
    return result;
};

XML_Element.prototype.escape = function (string, ignoreQuotes) {
    var src = isNil(string) ? '' : string.toString(),
        result = '',
        i,
        ch;
    for (i = 0; i < src.length; i += 1) {
        ch = src[i];
        switch (ch) {
        case '\'':
            result += '&apos;';
            break;
        case '\"':
            result += ignoreQuotes ? ch : '&quot;';
            break;
        case '<':
            result += '&lt;';
            break;
        case '>':
            result += '&gt;';
            break;
        case '&':
            result += '&amp;';
            break;
        case '\n': // escape CR b/c of export to URL feature
            result += '&#xD;';
            break;
        case '~': // escape tilde b/c it's overloaded in serializer.store()
            result += '&#126;';
            break;
        default:
            result += ch;
        }
    }
    return result;
};

XML_Element.prototype.unescape = function (string) {
    var stream = new ReadStream(string),
        result = '',
        ch,
        esc;

    function nextPut(str) {
        result += str;
        stream.upTo(';');
        stream.skip();
    }

    while (!stream.atEnd()) {
        ch = stream.next();
        if (ch === '&') {
            esc = stream.peekUpTo(';');
            switch (esc) {
            case 'apos':
                nextPut('\'');
                break;
            case 'quot':
                nextPut('\"');
                break;
            case 'lt':
                nextPut('<');
                break;
            case 'gt':
                nextPut('>');
                break;
            case 'amp':
                nextPut('&');
                break;
            case '#xD':
                nextPut('\n');
                break;
            case '#126':
                nextPut('~');
                break;
            default:
                result += ch;
            }
        } else {
            result += ch;
        }
    }
    return result;
};

// XML_Element parsing:

XML_Element.prototype.parseString = function (string) {
    var stream = new ReadStream(string);
    stream.upTo('<');
    stream.skip();
    this.parseStream(stream);
};

XML_Element.prototype.parseStream = function (stream) {
    var key,
        value,
        ch,
        child;

    // tag:
    this.tag = stream.word();
    stream.skipSpace();

    // attributes:
    ch = stream.peek();
    while (ch !== '>' && ch !== '/') {
        key = stream.word();
        stream.skipSpace();
        if (stream.next() !== '=') {
            throw new Error('Expected "=" after attribute name');
        }
        stream.skipSpace();
        ch = stream.next();
        if (ch !== '"' && ch !== "'") {
            throw new Error(
                'Expected single- or double-quoted attribute value'
            );
        }
        value = stream.upTo(ch);
        stream.skip(1);
        stream.skipSpace();
        this.attributes[key] = this.unescape(value);
        ch = stream.peek();
    }

    // empty tag:
    if (stream.peek() === '/') {
        stream.skip();
        if (stream.next() !== '>') {
            throw new Error('Expected ">" after "/" in empty tag');
        }
        return;
    }
    if (stream.next() !== '>') {
        throw new Error('Expected ">" after tag name and attributes');
    }

    // contents and children
    while (!stream.atEnd()) {
        ch = stream.next();
        if (ch === '<') {
            if (stream.peek() === '/') { // closing tag
                stream.skip();
                if (stream.word() !== this.tag) {
                    throw new Error('Expected to close ' + this.tag);
                }
                stream.upTo('>');
                stream.skip();
                this.contents = this.unescape(this.contents);
                return;
            }
            child = new XML_Element(null, null, this);
            child.parseStream(stream);
        } else {
            this.contents += ch;
        }
    }
};


// coming from file(s)
// store.js

// XML_Serializer ///////////////////////////////////////////////////////
/*
    I am an abstract protype for my heirs.

    I manage object identities and keep track of circular data structures.
    Objects are "touched" and a property named "serializationID" is added
    to each, representing an index integer in the list, starting with 1.
*/

// XML_Serializer instance creation:

function XML_Serializer() {
    this.contents = [];
}

// XML_Serializer preferences settings:

XML_Serializer.prototype.idProperty = 'serializationID';
XML_Serializer.prototype.version = 1; // increment on structural change

// XML_Serializer accessing:

XML_Serializer.prototype.add = function (object) {
    // private - mark the object with a serializationID property and add it
    if (object[this.idProperty]) { // already present
        return -1;
    }
    this.contents.push(object);
    object[this.idProperty] = this.contents.length;
    return this.contents.length;
};

XML_Serializer.prototype.at = function (integer) {
    // private
    return this.contents[integer - 1];
};

XML_Serializer.prototype.flush = function () {
    // private - free all objects and empty my contents
    var myself = this;
    this.contents.forEach(function (obj) {
        delete obj[myself.idProperty];
    });
    this.contents = [];
};

// XML_Serializer formatting:

XML_Serializer.prototype.escape = XML_Element.prototype.escape;
XML_Serializer.prototype.unescape = XML_Element.prototype.unescape;

XML_Serializer.prototype.format = function (string) {
    // private
    var myself = this,
        i = -1,
        values = arguments,
        value;

    return string.replace(/[@$%]([\d]+)?/g, function (spec, index) {
        index = parseInt(index, 10);

        if (isNaN(index)) {
            i += 1;
            value = values[i + 1];
        } else {
            value = values[index + 1];
        }
        // original line of code - now frowned upon by JSLint:
        // value = values[(isNaN(index) ? (i += 1) : index) + 1];

        return spec === '@' ?
                myself.escape(value)
                    : spec === '$' ?
                        myself.escape(value, true)
                            : value;
    });
};

// XML_Serializer loading:

XML_Serializer.prototype.load = function (xmlString) {
    // public - answer a new object which is represented by the given
    // XML string.
    nop(xmlString);
    throw new Error(
        'loading should be implemented in heir of XML_Serializer'
    );
};

XML_Serializer.prototype.parse = function (xmlString) {
    // private - answer an XML_Element representing the given XML String
    var element = new XML_Element();
    element.parseString(xmlString);
    return element;
};




// SnapSerializer ////////////////////////////////////////////////////////////

/*
var SnapSerializer;
*/

// SnapSerializer inherits from XML_Serializer:

SnapSerializer.prototype = new XML_Serializer();
SnapSerializer.prototype.constructor = SnapSerializer;
SnapSerializer.uber = XML_Serializer.prototype;

// SnapSerializer constants:

SnapSerializer.prototype.app = 'Snap! 4.0, http://snap.berkeley.edu';

// SnapSerializer instance creation:

function SnapSerializer() {
    this.init();
}

// SnapSerializer initialization:

SnapSerializer.prototype.init = function () {
    this.project = {};
    this.objects = {};
};

// SnapSerializer loading:

SnapSerializer.prototype.load = function (xmlString) {
    // public - answer a new Project represented by the given XML String
    return this.loadProjectModel(this.parse(xmlString));
};

SnapSerializer.prototype.loadProjectModel = function (xmlNode) {
    // public - answer a new Project represented by the given XML top node
    var myself = this,
        project = {sprites: {}},
        model,
        nameID;

    this.project = project;

    model = {project: xmlNode };
    if (+xmlNode.attributes.version > this.version) {
        throw 'Project uses newer version of Serializer';
    }

    /* Project Info */

    this.objects = {};
    project.name = model.project.attributes.name;
    if (!project.name) {
        nameID = 1;
        while (
            Object.prototype.hasOwnProperty.call(
                localStorage,
                '-snap-project-Untitled ' + nameID
            )
        ) {
            nameID += 1;
        }
        project.name = 'Untitled ' + nameID;
    }
    model.globalVariables = model.project.childNamed('variables');
    project.globalVariables = new VariableFrame();

    /* Stage */

    model.stage = model.project.require('stage');
    Stage.prototype.frameRate = 0;
    project.stage = new Stage(project.globalVariables);
    if (Object.prototype.hasOwnProperty.call(
            model.stage.attributes,
            'id'
        )) {
        this.objects[model.stage.attributes.id] = project.stage;
    }
    if (model.stage.attributes.name) {
        project.stage.name = model.stage.attributes.name;
    }
    if (model.stage.attributes.scheduled === 'true') {
        project.stage.fps = 30;
        Stage.prototype.frameRate = 30;
    }
    Sprite.prototype.useFlatLineEnds =
        model.stage.attributes.lines === 'flat';
    project.stage.isThreadSafe =
        model.stage.attributes.threadsafe === 'true';
    Stage.prototype.enableCodeMapping =
        model.stage.attributes.codify === 'true';

    model.codeHeaders = model.project.childNamed('headers');
    if (model.codeHeaders) {
        model.codeHeaders.children.forEach(function (xml) {
            Stage.prototype.codeHeaders[xml.tag] = xml.contents;
        });
    }

    model.codeMappings = model.project.childNamed('code');
    if (model.codeMappings) {
        model.codeMappings.children.forEach(function (xml) {
            Stage.prototype.codeMappings[xml.tag] = xml.contents;
        });
    }

    model.globalBlocks = model.project.childNamed('blocks');
	this.loadObject(project.stage, model.stage);

    /* Sprites */

    model.sprites = model.stage.require('sprites');
    project.sprites[project.stage.name] = project.stage;

    model.sprites.childrenNamed('sprite').forEach(function (model) {
        myself.loadValue(model);
    });

    this.objects = {};

    /* Global Variables */

    if (model.globalVariables) {
        this.loadVariables(
            project.globalVariables,
            model.globalVariables
        );
    }

    this.objects = {};
    return project;
};

SnapSerializer.prototype.loadBlocks = function (xmlString, targetStage) {
    // represented by the given XML String
    var stage = new Stage(),
        model;

    this.project = {
        stage: stage,
        sprites: {},
        targetStage: targetStage // for secondary custom block def look-up
    };
    model = this.parse(xmlString);
    if (+model.attributes.version > this.version) {
        throw 'Module uses newer version of Serializer';
    }
    this.objects = {};
    stage.globalBlocks.forEach(function (def) {
        def.receiver = null;
    });
    this.objects = {};
    this.project = {};
    return stage.globalBlocks;
};

SnapSerializer.prototype.loadSprites = function (xmlString, ide) {
    // public - import a set of sprites represented by xmlString
    // into the current project of the ide
    var model, project, myself = this;

    project = this.project = {
        globalVariables: ide.globalVariables,
        stage: ide.stage,
        sprites: {}
    };
    project.sprites[project.stage.name] = project.stage;

    model = this.parse(xmlString);
    if (+model.attributes.version > this.version) {
        throw 'Module uses newer version of Serializer';
    }
    model.childrenNamed('sprite').forEach(function (model) {
        var sprite  = new Sprite(project.globalVariables);

        if (model.attributes.id) {
            myself.objects[model.attributes.id] = sprite;
        }
        if (model.attributes.name) {
            sprite.name = model.attributes.name;
            project.sprites[model.attributes.name] = sprite;
        }
        project.stage.add(sprite);
        ide.sprites.add(sprite);
        myself.loadObject(sprite, model);
    });
    this.objects = {};
    this.project = {};

    ide.createCorral();
};

SnapSerializer.prototype.loadObject = function (object, model) {
    // private
    var blocks = model.require('blocks');
    this.loadVariables(object.variables, model.require('variables'));
    this.loadScripts(object.scripts, model.require('scripts'));
};


SnapSerializer.prototype.loadVariables = function (varFrame, element) {
    // private
    var myself = this;

    element.children.forEach(function (child) {
        var value;
        if (child.tag !== 'variable') {
            return;
        }
        value = child.children[0];
        varFrame.vars[child.attributes.name] = value ?
                myself.loadValue(value) : 0;
    });
};

SnapSerializer.prototype.loadScripts = function (scripts, model) {
    // private
    var myself = this;
    model.children.forEach(function (child) {
        var element;
        if (child.tag === 'script') {
            element = myself.loadScript(child);
            if (!element) {
                return;
            }
            scripts.add(element);
        } else if (child.tag === 'comment') {
            if (!element) {
                return;
            }
			scripts.add(element);
        }
    });
};

SnapSerializer.prototype.loadScriptsArray = function (model) {
    // private - answer an array containting the model's scripts
    var myself = this,
        scripts = [];
    model.children.forEach(function (child) {
        var element;
        if (child.tag === 'script') {
            element = myself.loadScript(child);
            if (!element) {
                return;
            }
            scripts.push(element);
        } else if (child.tag === 'comment') {
            if (!element) {
                return;
            }
			scripts.push(element);
        }
    });
    return scripts;
};

SnapSerializer.prototype.loadScript = function (model) {
    // private
    var topBlock, block, nextBlock,
        myself = this;
    model.children.forEach(function (child) {
        nextBlock = myself.loadBlock(child);
        if (!nextBlock) {
            return;
        }
        if (block) {
            block.nextBlock(nextBlock);
        } else {
            topBlock = nextBlock;
        }
        block = nextBlock;
    });
    return topBlock;
};

SnapSerializer.prototype.loadBlock = function (model, isReporter) {
    // private
    var block, info, inputs, isGlobal, rm, receiver;
    if (model.tag === 'block') {
        if (Object.prototype.hasOwnProperty.call(
                model.attributes,
                'var'
            )) {
            return Sprite.prototype.variableBlock(
                model.attributes['var']
            );
        }
        block = Sprite.prototype.blockForSelector(model.attributes.s);
    } 
    if (block === null) {
        block = this.obsoleteBlock(isReporter);
    }
    inputs = block.inputs();
    model.children.forEach(function (child, i) {
        if (child.tag === 'comment') {
            nop(); // ignore
        } else if (child.tag === 'receiver') {
            nop(); // ignore
        } else {
            this.loadInput(child, inputs[i], block);
        }
    }, this);
    return block;
};

SnapSerializer.prototype.obsoleteBlock = function (isReporter) {
    // private
    var block = isReporter ? new ReporterBlock()
            : new CommandBlock();
    block.selector = 'nop';
    block.setSpec('Obsolete!');
    return block;
};

SnapSerializer.prototype.loadInput = function (model, input, block) {
    // private
    var inp, val, myself = this;
    if (model.tag === 'script') {
        inp = this.loadScript(model);
        if (inp) {
            input.add(inp);
        }
    } else if (model.tag === 'autolambda' && model.children[0]) {
        inp = this.loadBlock(model.children[0], true);
        if (inp) {
            input.silentReplaceInput(input.children[0], inp);
        }
    } else if (model.tag === 'list') {
        while (input.inputs().length > 0) {
            input.removeInput();
        }
        model.children.forEach(function (item) {
            input.addInput();
            myself.loadInput(
                item,
                input.children[input.children.length - 2],
                input
            );
        });
    } else if (model.tag === 'block') {
        block.silentReplaceInput(input, this.loadBlock(model, true));
    } else {
        val = this.loadValue(model);
        if (val && input) { input.setContents(val) }
    }
};

SnapSerializer.prototype.loadValue = function (model) {
    // private
    var v, items, el, center, name, option,
        myself = this;

    function record() {
        if (Object.prototype.hasOwnProperty.call(
                model.attributes,
                'id'
            )) {
            myself.objects[model.attributes.id] = v;
        }
        if (Object.prototype.hasOwnProperty.call(
                model.attributes,
                'mediaID'
            )) {
            myself.mediaDict[model.attributes.mediaID] = v;
        }
    }
    switch (model.tag) {
    case 'ref':
        if (Object.prototype.hasOwnProperty.call(model.attributes, 'id')) {
            return this.objects[model.attributes.id];
        }
        if (Object.prototype.hasOwnProperty.call(
                model.attributes,
                'mediaID'
            )) {
            return this.mediaDict[model.attributes.mediaID];
        }
        throw new Error('expecting a reference id');
    case 'l':
        option = model.childNamed('option');
        return option ? [option.contents] : model.contents;
    case 'bool':
        return model.contents === 'true';
    case 'list':
        if (model.attributes.hasOwnProperty('linked')) {
            items = model.childrenNamed('item');
            if (items.length === 0) {
                v = new List();
                record();
                return v;
            }
            items.forEach(function (item) {
                var value = item.children[0];
                if (v === undefined) {
                    v = new List();
                    record();
                } else {
                    v = v.rest = new List();
                }
                v.isLinked = true;
                if (!value) {
                    v.first = 0;
                } else {
                    v.first = myself.loadValue(value);
                }
            });
            return v;
        }
        v = new List();
        record();
        v.contents = model.childrenNamed('item').map(function (item) {
            var value = item.children[0];
            if (!value) {
                return 0;
            }
            return myself.loadValue(value);
        });
        return v;
    case 'sprite':
        v  = new Sprite(myself.project.globalVariables);
        if (model.attributes.id) {
            myself.objects[model.attributes.id] = v;
        }
        if (model.attributes.name) {
            v.name = model.attributes.name;
            myself.project.sprites[model.attributes.name] = v;
        }
        if (model.attributes.idx) {
            v.idx = +model.attributes.idx;
        }
        myself.project.stage.add(v);
		myself.loadObject(v, model);
        return v;
    case 'context':
        v = new Context(null);
        record();
        el = model.childNamed('script');
        if (el) {
            v.expression = this.loadScript(el);
        } else {
            el = model.childNamed('block')
            if (el) {
                v.expression = this.loadBlock(el);
            } else {
                el = model.childNamed('l');
                if (el) {
                    v.expression = new InputSlot(el.contents);
                }
            }
        }
        el = model.childNamed('receiver');
        if (el) {
            el = el.childNamed('ref') || el.childNamed('sprite');
            if (el) {
                v.receiver = this.loadValue(el);
            }
        }
        el = model.childNamed('inputs');
        if (el) {
            el.children.forEach(function (item) {
                if (item.tag === 'input') {
                    v.inputs.push(item.contents);
                }
            });
        }
        el = model.childNamed('variables');
        if (el) {
            this.loadVariables(v.variables, el);
        }
        el = model.childNamed('context');
        if (el) {
            v.outerContext = this.loadValue(el);
        }
        return v;
    }
    return undefined;
};

// not coming from any Snap! original files

// SnapReader ////////////////////////////////////////////////////

// I read an XML Snap project file from command line and parse it

var fs = require('fs');
var serializer = new SnapSerializer();

fs.readFile(process.argv[2], {encoding: 'utf-8'}, function(err, data) {
		var project;
		var started = false;
        if (err) throw err;
        project = serializer.load(data);
		project.stage.fireGreenFlagEvent();

		while(project.stage.threads.processes.length > 0) {
			project.stage.step();
		}
});
