var { KeyNum, KeyName } = require("./keydef.js");
var { sendInput, getInputNames } = require("./handler.js");
var { TouchControlButton } = require("./button.js");
var { startInputProcessor, stopInputProcessor } = require("./processor.js");

function startupTouchControls() {
    
}

function startTouchCustomization() {
    startInputProcessor(true);
}

module.exports = {
    startupTouchControls,
    startTouchCustomization
};