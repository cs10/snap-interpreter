// StageMorph /////////////////////////////////////////////////////////

/*
    I inherit from FrameMorph and copy from SpriteMorph.
*/

// StageMorph inherits from FrameMorph:

StageMorph.prototype = new SteppingMorph();
StageMorph.prototype.constructor = StageMorph;
StageMorph.uber = SteppingMorph.prototype;

// StageMorph preferences settings

StageMorph.prototype.dimensions = new Point(480, 360); // unscaled extent

StageMorph.prototype.frameRate = 0; // unscheduled per default

StageMorph.prototype.isCachingPrimitives
    = SpriteMorph.prototype.isCachingPrimitives;

StageMorph.prototype.sliderColor
    = SpriteMorph.prototype.sliderColor;

StageMorph.prototype.paletteTextColor
    = SpriteMorph.prototype.paletteTextColor;

StageMorph.prototype.hiddenPrimitives = {};
StageMorph.prototype.codeMappings = {};
StageMorph.prototype.codeHeaders = {};
StageMorph.prototype.enableCodeMapping = false;

// StageMorph instance creation

function StageMorph(globals) {
    this.init(globals);
}

StageMorph.prototype.init = function (globals) {
    this.name = localize('Stage');
    this.threads = new ThreadManager();
    this.variables = new VariableFrame(globals || null, this);
    this.scripts = new ScriptsMorph(this);
    this.customBlocks = [];
    this.globalBlocks = [];
    this.costumes = new List();
    this.costume = null;
    this.sounds = new List();
    this.version = Date.now(); // for observers
    this.isFastTracked = false;
    this.cloneCount = 0;

    this.timerStart = Date.now();
    this.tempo = 60; // bpm
    this.lastMessage = '';

    this.watcherUpdateFrequency = 2;
    this.lastWatcherUpdate = Date.now();

    this.scale = 1; // for display modes, do not persist

    this.keysPressed = {}; // for handling keyboard events, do not persist
    this.blocksCache = {}; // not to be serialized (!)
    this.paletteCache = {}; // not to be serialized (!)
    this.lastAnswer = null; // last user input, do not persist
    this.activeSounds = []; // do not persist

    this.trailsCanvas = null;
    this.isThreadSafe = false;

    StageMorph.uber.init.call(this);

    this.acceptsDrops = false;
    this.setColor(new Color(255, 255, 255));
    this.fps = this.frameRate;
};

// StageMorph scaling

StageMorph.prototype.setScale = function (number) {
    var delta = number / this.scale,
        pos = this.position(),
        relativePos,
        bubble,
        oldFlag = Morph.prototype.trackChanges,
        myself = this;

    if (delta === 1) {return; }
    Morph.prototype.trackChanges = false;
    this.scale = number;
    this.setExtent(this.dimensions.multiplyBy(number));

    // now move and resize all children - sprites, bubbles, watchers etc..
    this.children.forEach(function (morph) {
        relativePos = morph.position().subtract(pos);
        morph.drawNew();
        morph.setPosition(
            relativePos.multiplyBy(delta).add(pos),
            true // just me (for nested sprites)
        );
        if (morph instanceof SpriteMorph) {
            bubble = morph.talkBubble();
            if (bubble) {
                bubble.setScale(number);
                morph.positionTalkBubble();
            }
        } else if (morph instanceof StagePrompterMorph) {
            if (myself.scale < 1) {
                morph.setWidth(myself.width() - 10);
            } else {
                morph.setWidth(myself.dimensions.x - 20);
            }
            morph.fixLayout();
            morph.setCenter(myself.center());
            morph.setBottom(myself.bottom());
        }
    });
    Morph.prototype.trackChanges = oldFlag;
    this.changed();
};

// StageMorph rendering

StageMorph.prototype.drawNew = function () {
    var ctx;
    StageMorph.uber.drawNew.call(this);
    if (this.costume) {
        ctx = this.image.getContext('2d');
        ctx.scale(this.scale, this.scale);
        ctx.drawImage(
            this.costume.contents,
            (this.width() / this.scale - this.costume.width()) / 2,
            (this.height() / this.scale - this.costume.height()) / 2
        );
    }
};

StageMorph.prototype.drawOn = function (aCanvas, aRect) {
    // make sure to draw the pen trails canvas as well
    var rectangle, area, delta, src, context, w, h, sl, st, ws, hs;
    if (!this.isVisible) {
        return null;
    }
    rectangle = aRect || this.bounds;
    area = rectangle.intersect(this.bounds).round();
    if (area.extent().gt(new Point(0, 0))) {
        delta = this.position().neg();
        src = area.copy().translateBy(delta).round();
        context = aCanvas.getContext('2d');
        context.globalAlpha = this.alpha;

        sl = src.left();
        st = src.top();
        w = Math.min(src.width(), this.image.width - sl);
        h = Math.min(src.height(), this.image.height - st);

        if (w < 1 || h < 1) {
            return null;
        }
        context.drawImage(
            this.image,
            src.left(),
            src.top(),
            w,
            h,
            area.left(),
            area.top(),
            w,
            h
        );

        // pen trails
        ws = w / this.scale;
        hs = h / this.scale;
        context.save();
        context.scale(this.scale, this.scale);
        context.drawImage(
            this.penTrails(),
            src.left() / this.scale,
            src.top() / this.scale,
            ws,
            hs,
            area.left() / this.scale,
            area.top() / this.scale,
            ws,
            hs
        );
        context.restore();
    }
};

StageMorph.prototype.clearPenTrails = function () {
    this.trailsCanvas = newCanvas(this.dimensions);
    this.changed();
};

StageMorph.prototype.penTrails = function () {
    if (!this.trailsCanvas) {
        this.trailsCanvas = newCanvas(this.dimensions);
    }
    return this.trailsCanvas;
};

StageMorph.prototype.penTrailsMorph = function () {
    // for collision detection purposes
    var morph = new Morph(),
        trails = this.penTrails(),
        ctx;
    morph.bounds = this.bounds.copy();
    morph.image = newCanvas(this.extent());
    ctx = morph.image.getContext('2d');
    ctx.drawImage(
        trails,
        0,
        0,
        trails.width,
        trails.height,
        0,
        0,
        this.image.width,
        this.image.height
    );
    return morph;
};

StageMorph.prototype.colorFiltered = function (aColor, excludedSprite) {
    // answer a new Morph containing my image filtered by aColor
    // ignore the excludedSprite, because its collision is checked
    // ignore transparency (alpha)
    var morph = new Morph(),
        ext = this.extent(),
        img = this.thumbnail(ext, excludedSprite),
        ctx,
        src,
        clr,
        i,
        dta;

    src = img.getContext('2d').getImageData(0, 0, ext.x, ext.y);
    morph.bounds = this.bounds.copy();
    morph.image = newCanvas(ext);
    ctx = morph.image.getContext('2d');
    dta = ctx.createImageData(ext.x, ext.y);
    for (i = 0; i < ext.x * ext.y * 4; i += 4) {
        clr = new Color(
            src.data[i],
            src.data[i + 1],
            src.data[i + 2]
        );
        if (clr.eq(aColor)) {
            dta.data[i] = src.data[i];
            dta.data[i + 1] = src.data[i + 1];
            dta.data[i + 2] = src.data[i + 2];
            dta.data[i + 3] = 255;
        }
    }
    ctx.putImageData(dta, 0, 0);
    return morph;
};

// StageMorph accessing

StageMorph.prototype.watchers = function (leftPos) {
/*
    answer an array of all currently visible watchers.
    If leftPos is specified, filter the list for all
    shown or hidden watchers whose left side equals
    the given border (for automatic positioning)
*/
    return this.children.filter(function (morph) {
        if (morph instanceof WatcherMorph) {
            if (leftPos) {
                return morph.left() === leftPos;
            }
            return morph.isVisible;
        }
        return false;
    });
};

// StageMorph timer

StageMorph.prototype.resetTimer = function () {
    this.timerStart = Date.now();
};

StageMorph.prototype.getTimer = function () {
    var elapsed = Math.floor((Date.now() - this.timerStart) / 100);
    return elapsed / 10;
};

// StageMorph tempo

StageMorph.prototype.setTempo = function (bpm) {
    this.tempo = Math.max(20, (+bpm || 0));
};

StageMorph.prototype.changeTempo = function (delta) {
    this.setTempo(this.getTempo() + (+delta || 0));
};

StageMorph.prototype.getTempo = function () {
    return +this.tempo;
};

// StageMorph messages

StageMorph.prototype.getLastMessage = function () {
    return this.lastMessage || '';
};

// StageMorph Mouse Corridnates

StageMorph.prototype.reportMouseX = function () {
    var world = this.world();
    if (world) {
        return (world.hand.position().x - this.center().x) / this.scale;
    }
    return 0;
};

StageMorph.prototype.reportMouseY = function () {
    var world = this.world();
    if (world) {
        return (this.center().y - world.hand.position().y) / this.scale;
    }
    return 0;
};

// StageMorph drag & drop

StageMorph.prototype.wantsDropOf = function (aMorph) {
    return aMorph instanceof SpriteMorph ||
        aMorph instanceof WatcherMorph ||
        aMorph instanceof ListWatcherMorph ||
        aMorph instanceof SpriteIconMorph;
};

StageMorph.prototype.reactToDropOf = function (morph, hand) {
    if (morph instanceof SpriteIconMorph) { // detach sprite from anchor
        if (morph.object.anchor) {
            morph.object.anchor.detachPart(morph.object);
        }
        this.world().add(morph);
        morph.slideBackTo(hand.grabOrigin);
    }
};

// StageMorph stepping

StageMorph.prototype.step = function () {
    var current, elapsed, leftover, world = this.world();

    // handle keyboard events
    if (world.keyboardReceiver === null) {
        world.keyboardReceiver = this;
    }
    if (world.currentKey === null) {
        this.keyPressed = null;
    }

    // manage threads
    if (this.isFastTracked && this.threads.processes.length) {
        this.children.forEach(function (morph) {
            if (morph instanceof SpriteMorph) {
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
            if (morph instanceof SpriteMorph) {
                if (!morph.wasWarped) {
                    morph.endWarp();
                }
            }
        });
        this.changed();
    } else {
        this.threads.step();
    }

    // update watchers
    current = Date.now();
    elapsed = current - this.lastWatcherUpdate;
    leftover = (1000 / this.watcherUpdateFrequency) - elapsed;
    if (leftover < 1) {
        this.watchers().forEach(function (w) {
            w.update();
        });
        this.lastWatcherUpdate = Date.now();
    }
};

StageMorph.prototype.developersMenu = function () {
    var myself = this,
        menu = StageMorph.uber.developersMenu.call(this);
    menu.addItem(
        "stop",
        function () {
            myself.threads.stopAll();
        },
        'terminate all running threads'
    );
    return menu;
};

// StageMorph keyboard events

StageMorph.prototype.processKeyDown = function (event) {
    this.processKeyEvent(
        event,
        this.fireKeyEvent
    );
};

StageMorph.prototype.processKeyUp = function (event) {
    this.processKeyEvent(
        event,
        this.removePressedKey
    );
};

StageMorph.prototype.processKeyEvent = function (event, action) {
    var keyName;

    // this.inspectKeyEvent(event);
    switch (event.keyCode) {
    case 13:
        keyName = 'enter';
        if (event.ctrlKey || event.metaKey) {
            keyName = 'ctrl enter';
        }
        break;
    case 27:
        keyName = 'esc';
        break;
    case 32:
        keyName = 'space';
        break;
    case 37:
        keyName = 'left arrow';
        break;
    case 39:
        keyName = 'right arrow';
        break;
    case 38:
        keyName = 'up arrow';
        break;
    case 40:
        keyName = 'down arrow';
        break;
    default:
        keyName = String.fromCharCode(event.keyCode || event.charCode);
    }
    action.call(this, keyName);
};

StageMorph.prototype.fireKeyEvent = function (key) {
    var evt = key.toLowerCase(),
        hats = [],
        procs = [],
        myself = this;

    this.keysPressed[evt] = true;
    if (evt === 'ctrl enter') {
        return this.fireGreenFlagEvent();
    }
    if (evt === 'esc') {
        return this.fireStopAllEvent();
    }
    this.children.concat(this).forEach(function (morph) {
        if (morph instanceof SpriteMorph || morph instanceof StageMorph) {
            hats = hats.concat(morph.allHatBlocksForKey(evt));
        }
    });
    hats.forEach(function (block) {
        procs.push(myself.threads.startProcess(block, myself.isThreadSafe));
    });
    return procs;
};

StageMorph.prototype.removePressedKey = function (key) {
    delete this.keysPressed[key.toLowerCase()];
};

StageMorph.prototype.processKeyPress = function (event) {
    nop(event);
};

StageMorph.prototype.inspectKeyEvent
    = CursorMorph.prototype.inspectKeyEvent;

StageMorph.prototype.fireGreenFlagEvent = function () {
    var procs = [],
        hats = [],
        ide = this.parentThatIsA(IDE_Morph),
        myself = this;

    this.children.concat(this).forEach(function (morph) {
        if (morph instanceof SpriteMorph || morph instanceof StageMorph) {
            hats = hats.concat(morph.allHatBlocksFor('__shout__go__'));
        }
    });
    hats.forEach(function (block) {
        procs.push(myself.threads.startProcess(
            block,
            myself.isThreadSafe
        ));
    });
    if (ide) {
        ide.controlBar.pauseButton.refresh();
    }
    return procs;
};

StageMorph.prototype.fireStopAllEvent = function () {
    var ide = this.parentThatIsA(IDE_Morph);
    this.threads.resumeAll(this.stage);
    this.keysPressed = {};
    this.threads.stopAll();
    this.stopAllActiveSounds();
    this.children.forEach(function (morph) {
        if (morph.stopTalking) {
            morph.stopTalking();
        }
    });
    this.removeAllClones();
    if (ide) {
        ide.nextSteps([
            nop,
            function () {ide.controlBar.pauseButton.refresh(); }
        ]);
    }
};

StageMorph.prototype.removeAllClones = function () {
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

// StageMorph block templates

StageMorph.prototype.blockTemplates = function (category) {
    var blocks = [], myself = this, varNames, button,
        cat = category || 'motion', txt;

    function block(selector) {
        if (myself.hiddenPrimitives[selector]) {
            return null;
        }
        var newBlock = SpriteMorph.prototype.blockForSelector(selector, true);
        newBlock.isTemplate = true;
        return newBlock;
    }

    function variableBlock(varName) {
        var newBlock = SpriteMorph.prototype.variableBlock(varName);
        newBlock.isDraggable = false;
        newBlock.isTemplate = true;
        return newBlock;
    }

    function watcherToggle(selector) {
        if (myself.hiddenPrimitives[selector]) {
            return null;
        }
        var info = SpriteMorph.prototype.blocks[selector];
        return new ToggleMorph(
            'checkbox',
            this,
            function () {
                myself.toggleWatcher(
                    selector,
                    localize(info.spec),
                    myself.blockColor[info.category]
                );
            },
            null,
            function () {
                return myself.showingWatcher(selector);
            },
            null
        );
    }

    function variableWatcherToggle(varName) {
        return new ToggleMorph(
            'checkbox',
            this,
            function () {
                myself.toggleVariableWatcher(varName);
            },
            null,
            function () {
                return myself.showingVariableWatcher(varName);
            },
            null
        );
    }

    if (cat === 'motion') {

        txt = new TextMorph(localize(
            'Stage selected:\nno motion primitives'
        ));
        txt.fontSize = 9;
        txt.setColor(this.paletteTextColor);
        blocks.push(txt);

    } else if (cat === 'looks') {

        blocks.push(block('doSwitchToCostume'));
        blocks.push(block('doWearNextCostume'));
        blocks.push(watcherToggle('getCostumeIdx'));
        blocks.push(block('getCostumeIdx'));
        blocks.push('-');
        blocks.push(block('changeEffect'));
        blocks.push(block('setEffect'));
        blocks.push(block('clearEffects'));

    // for debugging: ///////////////

        if (this.world().isDevMode) {
            blocks.push('-');
            txt = new TextMorph(localize(
                'development mode \ndebugging primitives:'
            ));
            txt.fontSize = 9;
            txt.setColor(this.paletteTextColor);
            blocks.push(txt);
            blocks.push('-');
            blocks.push(block('log'));
            blocks.push(block('alert'));
        }

    /////////////////////////////////

    } else if (cat === 'sound') {

        blocks.push(block('playSound'));
        blocks.push(block('doPlaySoundUntilDone'));
        blocks.push(block('doStopAllSounds'));
        blocks.push('-');
        blocks.push(block('doRest'));
        blocks.push('-');
        blocks.push(block('doPlayNote'));
        blocks.push('-');
        blocks.push(block('doChangeTempo'));
        blocks.push(block('doSetTempo'));
        blocks.push(watcherToggle('getTempo'));
        blocks.push(block('getTempo'));

    } else if (cat === 'pen') {

        blocks.push(block('clear'));

    } else if (cat === 'control') {

        blocks.push(block('receiveGo'));
        blocks.push(block('receiveKey'));
        blocks.push(block('receiveClick'));
        blocks.push(block('receiveMessage'));
        blocks.push('-');
        blocks.push(block('doBroadcast'));
        blocks.push(block('doBroadcastAndWait'));
        blocks.push(watcherToggle('getLastMessage'));
        blocks.push(block('getLastMessage'));
        blocks.push('-');
        blocks.push(block('doWarp'));
        blocks.push('-');
        blocks.push(block('doWait'));
        blocks.push(block('doWaitUntil'));
        blocks.push('-');
        blocks.push(block('doForever'));
        blocks.push(block('doRepeat'));
        blocks.push(block('doUntil'));
        blocks.push('-');
        blocks.push(block('doIf'));
        blocks.push(block('doIfElse'));
        blocks.push('-');
        blocks.push(block('doReport'));
        blocks.push('-');
    /*
    // old STOP variants, migrated to a newer version, now redundant
        blocks.push(block('doStopBlock'));
        blocks.push(block('doStop'));
        blocks.push(block('doStopAll'));
    */
        blocks.push(block('doStopThis'));
        blocks.push(block('doStopOthers'));
        blocks.push('-');
        blocks.push(block('doRun'));
        blocks.push(block('fork'));
        blocks.push(block('evaluate'));
        blocks.push('-');
    /*
    // list variants commented out for now (redundant)
        blocks.push(block('doRunWithInputList'));
        blocks.push(block('forkWithInputList'));
        blocks.push(block('evaluateWithInputList'));
        blocks.push('-');
    */
        blocks.push(block('doCallCC'));
        blocks.push(block('reportCallCC'));
        blocks.push('-');
        blocks.push(block('createClone'));
        blocks.push('-');
        blocks.push(block('doPauseAll'));

    } else if (cat === 'sensing') {

        blocks.push(block('doAsk'));
        blocks.push(watcherToggle('getLastAnswer'));
        blocks.push(block('getLastAnswer'));
        blocks.push('-');
        blocks.push(watcherToggle('reportMouseX'));
        blocks.push(block('reportMouseX'));
        blocks.push(watcherToggle('reportMouseY'));
        blocks.push(block('reportMouseY'));
        blocks.push(block('reportMouseDown'));
        blocks.push('-');
        blocks.push(block('reportKeyPressed'));
        blocks.push('-');
        blocks.push(block('doResetTimer'));
        blocks.push(watcherToggle('getTimer'));
        blocks.push(block('getTimer'));
        blocks.push('-');
        blocks.push(block('reportAttributeOf'));
        blocks.push('-');
        blocks.push(block('reportURL'));
        blocks.push('-');
        blocks.push(block('reportIsFastTracking'));
        blocks.push(block('doSetFastTracking'));
        blocks.push('-');
        blocks.push(block('reportDate'));

    // for debugging: ///////////////

        if (this.world().isDevMode) {

            blocks.push('-');
            txt = new TextMorph(localize(
                'development mode \ndebugging primitives:'
            ));
            txt.fontSize = 9;
            txt.setColor(this.paletteTextColor);
            blocks.push(txt);
            blocks.push('-');
            blocks.push(block('colorFiltered'));
            blocks.push(block('reportStackSize'));
            blocks.push(block('reportFrameCount'));
        }

    /////////////////////////////////

    } else if (cat === 'operators') {

        blocks.push(block('reifyScript'));
        blocks.push(block('reifyReporter'));
        blocks.push(block('reifyPredicate'));
        blocks.push('#');
        blocks.push('-');
        blocks.push(block('reportSum'));
        blocks.push(block('reportDifference'));
        blocks.push(block('reportProduct'));
        blocks.push(block('reportQuotient'));
        blocks.push('-');
        blocks.push(block('reportModulus'));
        blocks.push(block('reportRound'));
        blocks.push(block('reportMonadic'));
        blocks.push(block('reportRandom'));
        blocks.push('-');
        blocks.push(block('reportLessThan'));
        blocks.push(block('reportEquals'));
        blocks.push(block('reportGreaterThan'));
        blocks.push('-');
        blocks.push(block('reportAnd'));
        blocks.push(block('reportOr'));
        blocks.push(block('reportNot'));
        blocks.push('-');
        blocks.push(block('reportTrue'));
        blocks.push(block('reportFalse'));
        blocks.push('-');
        blocks.push(block('reportJoinWords'));
        blocks.push(block('reportTextSplit'));
        blocks.push(block('reportLetter'));
        blocks.push(block('reportStringSize'));
        blocks.push('-');
        blocks.push(block('reportUnicode'));
        blocks.push(block('reportUnicodeAsLetter'));
        blocks.push('-');
        blocks.push(block('reportIsA'));
        blocks.push(block('reportIsIdentical'));

    // for debugging: ///////////////

        if (this.world().isDevMode) {
            blocks.push('-');
            txt = new TextMorph(
                'development mode \ndebugging primitives:'
            );
            txt.fontSize = 9;
            txt.setColor(this.paletteTextColor);
            blocks.push(txt);
            blocks.push('-');
            blocks.push(block('reportTypeOf'));
            blocks.push(block('reportTextFunction'));
        }

    //////////////////////////////////

    } else if (cat === 'variables') {

        button = new PushButtonMorph(
            null,
            function () {
                new VariableDialogMorph(
                    null,
                    function (pair) {
                        if (pair && !myself.variables.silentFind(pair[0])) {
                            myself.addVariable(pair[0], pair[1]);
                            myself.toggleVariableWatcher(pair[0], pair[1]);
                            myself.blocksCache[cat] = null;
                            myself.paletteCache[cat] = null;
                            myself.parentThatIsA(IDE_Morph).refreshPalette();
                        }
                    },
                    myself
                ).prompt(
                    'Variable name',
                    null,
                    myself.world()
                );
            },
            'Make a variable'
        );
        blocks.push(button);

        if (this.variables.allNames().length > 0) {
            button = new PushButtonMorph(
                null,
                function () {
                    var menu = new MenuMorph(
                        myself.deleteVariable,
                        null,
                        myself
                    );
                    myself.variables.allNames().forEach(function (name) {
                        menu.addItem(name, name);
                    });
                    menu.popUpAtHand(myself.world());
                },
                'Delete a variable'
            );
            blocks.push(button);
        }

        blocks.push('-');

        varNames = this.variables.allNames();
        if (varNames.length > 0) {
            varNames.forEach(function (name) {
                blocks.push(variableWatcherToggle(name));
                blocks.push(variableBlock(name));
            });
            blocks.push('-');
        }

        blocks.push(block('doSetVar'));
        blocks.push(block('doChangeVar'));
        blocks.push(block('doShowVar'));
        blocks.push(block('doHideVar'));
        blocks.push(block('doDeclareVariables'));

        blocks.push('=');

        blocks.push(block('reportNewList'));
        blocks.push('-');
        blocks.push(block('reportCONS'));
        blocks.push(block('reportListItem'));
        blocks.push(block('reportCDR'));
        blocks.push('-');
        blocks.push(block('reportListLength'));
        blocks.push(block('reportListContainsItem'));
        blocks.push('-');
        blocks.push(block('doAddToList'));
        blocks.push(block('doDeleteFromList'));
        blocks.push(block('doInsertInList'));
        blocks.push(block('doReplaceInList'));

    // for debugging: ///////////////

        if (this.world().isDevMode) {
            blocks.push('-');
            txt = new TextMorph(localize(
                'development mode \ndebugging primitives:'
            ));
            txt.fontSize = 9;
            txt.setColor(this.paletteTextColor);
            blocks.push(txt);
            blocks.push('-');
            blocks.push(block('reportMap'));
        }

    /////////////////////////////////

        blocks.push('=');

        if (StageMorph.prototype.enableCodeMapping) {
            blocks.push(block('doMapCodeOrHeader'));
            blocks.push(block('doMapStringCode'));
            blocks.push(block('doMapListCode'));
            blocks.push('-');
            blocks.push(block('reportMappedCode'));
            blocks.push('=');
        }

        button = new PushButtonMorph(
            null,
            function () {
                var ide = myself.parentThatIsA(IDE_Morph);
                new BlockDialogMorph(
                    null,
                    function (definition) {
                        if (definition.spec !== '') {
                            if (definition.isGlobal) {
                                myself.globalBlocks.push(definition);
                            } else {
                                myself.customBlocks.push(definition);
                            }
                            ide.flushPaletteCache();
                            ide.refreshPalette();
                            new BlockEditorMorph(definition, myself).popUp();
                        }
                    },
                    myself
                ).prompt(
                    'Make a block',
                    null,
                    myself.world()
                );
            },
            'Make a block'
        );
        blocks.push(button);
    }
    return blocks;
};

// StageMorph primitives

StageMorph.prototype.clear = function () {
    this.clearPenTrails();
};

// StageMorph user menu

StageMorph.prototype.userMenu = function () {
    var ide = this.parentThatIsA(IDE_Morph),
        menu = new MenuMorph(this),
        shiftClicked = this.world().currentKey === 16,
        myself = this;

    if (ide && ide.isAppMode) {
        menu.addItem('help', 'nop');
        return menu;
    }
    menu.addItem("edit", 'edit');
    menu.addItem("show all", 'showAll');
    menu.addItem(
        "pic...",
        function () {
            window.open(myself.fullImageClassic().toDataURL());
        },
        'open a new window\nwith a picture of the stage'
    );
    if (shiftClicked) {
        menu.addLine();
        menu.addItem(
            "turn pen trails into new costume...",
            function () {
                var costume = new Costume(
                    myself.trailsCanvas,
                    Date.now().toString()
                ).copy();
                ide.currentSprite.addCostume(costume);
                ide.currentSprite.wearCostume(costume);
                ide.hasChangedMedia = true;
            },
            'turn all pen trails and stamps\n' +
                'into a new costume for the\ncurrently selected sprite',
            new Color(100, 0, 0)
        );
    }
    return menu;
};

StageMorph.prototype.showAll = function () {
    var myself = this;
    this.children.forEach(function (m) {
        m.show();
        m.keepWithin(myself);
        if (m.fixLayout) {m.fixLayout(); }
    });
};

StageMorph.prototype.edit = SpriteMorph.prototype.edit;

// StageMorph thumbnail

StageMorph.prototype.thumbnail = function (extentPoint, excludedSprite) {
/*
    answer a new Canvas of extentPoint dimensions containing
    my thumbnail representation keeping the originial aspect ratio
*/
    var myself = this,
        src = this.image,
        scale = Math.min(
            (extentPoint.x / src.width),
            (extentPoint.y / src.height)
        ),
        trg = newCanvas(extentPoint),
        ctx = trg.getContext('2d'),
        fb,
        fimg;

    ctx.scale(scale, scale);
    ctx.drawImage(
        src,
        0,
        0
    );
    ctx.drawImage(
        this.penTrails(),
        0,
        0,
        this.dimensions.x * this.scale,
        this.dimensions.y * this.scale
    );
    this.children.forEach(function (morph) {
        if (morph !== excludedSprite) {
            fb = morph.fullBounds();
            fimg = morph.fullImage();
            if (fimg.width && fimg.height) {
                ctx.drawImage(
                    morph.fullImage(),
                    fb.origin.x - myself.bounds.origin.x,
                    fb.origin.y - myself.bounds.origin.y
                );
            }
        }
    });
    return trg;
};

// StageMorph cloning overrice

StageMorph.prototype.createClone = nop;

// StageMorph pseudo-inherited behavior

StageMorph.prototype.categories = SpriteMorph.prototype.categories;
StageMorph.prototype.blockColor = SpriteMorph.prototype.blockColor;
StageMorph.prototype.paletteColor = SpriteMorph.prototype.paletteColor;
StageMorph.prototype.setName = SpriteMorph.prototype.setName;
StageMorph.prototype.palette = SpriteMorph.prototype.palette;
StageMorph.prototype.freshPalette = SpriteMorph.prototype.freshPalette;
StageMorph.prototype.showingWatcher = SpriteMorph.prototype.showingWatcher;
StageMorph.prototype.addVariable = SpriteMorph.prototype.addVariable;
StageMorph.prototype.deleteVariable = SpriteMorph.prototype.deleteVariable;

// StageMorph block rendering

StageMorph.prototype.blockForSelector
    = SpriteMorph.prototype.blockForSelector;

// StageMorph variable watchers (for palette checkbox toggling)

StageMorph.prototype.findVariableWatcher
    = SpriteMorph.prototype.findVariableWatcher;

StageMorph.prototype.toggleVariableWatcher
    = SpriteMorph.prototype.toggleVariableWatcher;

StageMorph.prototype.showingVariableWatcher
    = SpriteMorph.prototype.showingVariableWatcher;

StageMorph.prototype.deleteVariableWatcher
    = SpriteMorph.prototype.deleteVariableWatcher;

// StageMorph background management

StageMorph.prototype.addCostume
    = SpriteMorph.prototype.addCostume;

StageMorph.prototype.wearCostume
    = SpriteMorph.prototype.wearCostume;

StageMorph.prototype.getCostumeIdx
    = SpriteMorph.prototype.getCostumeIdx;

StageMorph.prototype.doWearNextCostume
    = SpriteMorph.prototype.doWearNextCostume;

StageMorph.prototype.doWearPreviousCostume
    = SpriteMorph.prototype.doWearPreviousCostume;

StageMorph.prototype.doSwitchToCostume
    = SpriteMorph.prototype.doSwitchToCostume;

// StageMorph graphic effects

StageMorph.prototype.setEffect
    = SpriteMorph.prototype.setEffect;

StageMorph.prototype.getGhostEffect
    = SpriteMorph.prototype.getGhostEffect;

StageMorph.prototype.changeEffect
    = SpriteMorph.prototype.changeEffect;

StageMorph.prototype.clearEffects
    = SpriteMorph.prototype.clearEffects;

// StageMorph sound management

StageMorph.prototype.addSound
    = SpriteMorph.prototype.addSound;

StageMorph.prototype.playSound
    = SpriteMorph.prototype.playSound;

StageMorph.prototype.stopAllActiveSounds = function () {
    this.activeSounds.forEach(function (audio) {
        audio.pause();
    });
    this.activeSounds = [];
};

StageMorph.prototype.pauseAllActiveSounds = function () {
    this.activeSounds.forEach(function (audio) {
        audio.pause();
    });
};

StageMorph.prototype.resumeAllActiveSounds = function () {
    this.activeSounds.forEach(function (audio) {
        audio.play();
    });
};

// StageMorph non-variable watchers

StageMorph.prototype.toggleWatcher
    = SpriteMorph.prototype.toggleWatcher;

StageMorph.prototype.showingWatcher
    = SpriteMorph.prototype.showingWatcher;

StageMorph.prototype.watcherFor =
    SpriteMorph.prototype.watcherFor;

StageMorph.prototype.getLastAnswer
    = SpriteMorph.prototype.getLastAnswer;

// StageMorph message broadcasting

StageMorph.prototype.allMessageNames
    = SpriteMorph.prototype.allMessageNames;

StageMorph.prototype.allHatBlocksFor
    = SpriteMorph.prototype.allHatBlocksFor;

StageMorph.prototype.allHatBlocksForKey
    = SpriteMorph.prototype.allHatBlocksForKey;

// StageMorph events

StageMorph.prototype.mouseClickLeft
    = SpriteMorph.prototype.mouseClickLeft;

// StageMorph custom blocks

StageMorph.prototype.deleteAllBlockInstances
    = SpriteMorph.prototype.deleteAllBlockInstances;

StageMorph.prototype.allBlockInstances
    = SpriteMorph.prototype.allBlockInstances;

StageMorph.prototype.allLocalBlockInstances
    = SpriteMorph.prototype.allLocalBlockInstances;

StageMorph.prototype.allEditorBlockInstances
    = SpriteMorph.prototype.allEditorBlockInstances;

StageMorph.prototype.paletteBlockInstance
    = SpriteMorph.prototype.paletteBlockInstance;

StageMorph.prototype.usesBlockInstance
    = SpriteMorph.prototype.usesBlockInstance;

StageMorph.prototype.doubleDefinitionsFor
    = SpriteMorph.prototype.doubleDefinitionsFor;

StageMorph.prototype.replaceDoubleDefinitionsFor
    = SpriteMorph.prototype.replaceDoubleDefinitionsFor;
