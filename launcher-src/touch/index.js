var { KeyNum, KeyName } = require("./keydef.js");
var { sendInput, getInputNames } = require("./handler.js");
var { TouchControlButton } = require("./button.js");
var { startInputProcessor, stopInputProcessor } = require("./processor.js");

var state = {
    ingameTouch: false,
    UnlockMouse: () => {},
};

function startupTouchControls() {
    function activate(e) {
        if (state.ingameTouch) {
            return;
        }
        if (state.UnlockMouse) {
            state.UnlockMouse();
        }
        state.ingameTouch = true;
        startInputProcessor();
        e.preventDefault();
        e.stopPropagation();
    }
    function deactivate(e) {
        if (!state.ingameTouch) {
            return;
        }
        state.ingameTouch = false;
        stopInputProcessor();
    }
    document.addEventListener("touchstart", activate);
    document.addEventListener("keydown", deactivate);
    document.addEventListener("gamepadconnected", deactivate);
}

function startTouchCustomization() {
    startInputProcessor(true);
}

module.exports = {
    startupTouchControls,
    startTouchCustomization,
    state
};