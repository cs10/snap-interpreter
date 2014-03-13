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
