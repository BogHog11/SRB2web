var { TouchControlButton } = require("./button.js");
var { KeyName, KeyNum } = require("./keydef.js");
var dialog = require("../dialog.js");
var elements = require("../gp2/elements.js");
var processRate = 1/60;
var processInterval = null;
var inEditMode = false;
var buttons = [];

var touchControlsDialogDiv = elements.getGPId("touchControlsDialog");
var touchControlsContainer = elements.getGPId("touchControlsContainer");

function destroyButtons () {
    buttons.forEach(button => button.destroy());
}

function createButton(data) {
    var button = data ? (TouchControlButton.fromSavedData(data)) : (new TouchControlButton());
    button.editMode = inEditMode;
    button.append(touchControlsContainer);
    return button;
}

function saveButtons() {
    var data = buttons.map(button => button.save());
    dialog.alert(JSON.stringify(data));
}

function loadButtons(data) {
    var buttonsArray = [];
    if (typeof data == "string") {
        try{
            buttonsArray = JSON.parse(data);
        }catch(e){
            dialog.alert("Invalid data. "+e);
        }
    } else {
        buttonsArray = data;
    }

    if (!Array.isArray(buttonsArray)) {
        buttonsArray = [];
        dialog.alert("Invalid data, button data should be an array.");
    }

    destroyButtons();
    buttons = buttonsArray.map(buttonData => createButton(buttonData));
}

function startInputProcessor(editMode) {
    stopInputProcessor();

    inEditMode = !!editMode;

    if (editMode) {
        touchControlsDialogDiv.hidden = false;
    }
    touchControlsContainer.hidden = false;

    processInterval = setInterval(() => {
        
    },processRate);
}

function stopInputProcessor() {
    clearInterval(processInterval);
    inEditMode = false;
    touchControlsDialogDiv.hidden = true;
    touchControlsContainer.hidden = true;
    destroyButtons();
}

elements.getGPId("touchControlsClose").addEventListener("click", function () {
    stopInputProcessor();
});

var touchControlsAddDropdown = elements.getGPId("touchControlsAddDropdown");

module.exports = {
    startInputProcessor,
    stopInputProcessor
};