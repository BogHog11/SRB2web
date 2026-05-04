var { TouchControlButton } = require("./button.js");
var { KeyName, KeyNum, getButtonLabels } = require("./keydef.js");
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

var touchPositions = [];
var touches = [];
var processState = {};
document.addEventListener("touchstart", function (e) {
    touches = e.touches;
    updateTouchPositions();
});
document.addEventListener("touchmove", function (e) {
    touches = e.touches;
    updateTouchPositions();
});
document.addEventListener("touchend", function (e) {
    touches = e.touches;
    updateTouchPositions();
});

function updateTouchPositions() {
    touchPositions = [];
    for (var i = 0; i < touches.length; i++) {
        var touch = touches[i];
        touchPositions.push({
            left: touch.clientX,
            top: touch.clientY,
            width: touch.radiusX < 2 ? 2 : touch.radiusX,
            height: touch.radiusY < 2 ? 2 : touch.radiusY
        });
    }
}

function startInputProcessor(editMode) {
    stopInputProcessor();

    inEditMode = !!editMode;

    if (editMode) {
        touchControlsDialogDiv.hidden = false;
    }
    touchControlsContainer.hidden = false;

    processInterval = setInterval(() => {
        updateTouchPositions();
        buttons.forEach(button => {
            button.process(touchPositions, processState);
        });
    },processRate);
}

function stopInputProcessor() {
    clearInterval(processInterval);
    inEditMode = false;
    touchControlsDialogDiv.hidden = true;
    touchControlsContainer.hidden = true;
    processState = {};
    destroyButtons();
}

elements.getGPId("touchControlsClose").addEventListener("click", function () {
    stopInputProcessor();
});

var touchControlsAddDropdown = elements.getGPId("touchControlsAddDropdown");
var touchControlsAdd = elements.getGPId("touchControlsAdd");
function closeAddDropdown() {
    touchControlsAddDropdown.hidden = true;
    elements.removeAllChildren(touchControlsAddDropdown);
}
touchControlsAdd.addEventListener("click", function (e) {
    e.stopPropagation();
    if (touchControlsAddDropdown.hidden) {
        touchControlsAddDropdown.hidden = false;
        elements.removeAllChildren(touchControlsAddDropdown);
        function clickHandler(event, keyid) {
            var button = createButton(TouchControlButton.createEmptyButtonData(keyid));
            buttons.push(button);
            closeAddDropdown();
            event.stopPropagation();
        }
        elements.setInnerJSON(
            touchControlsAddDropdown,
            getButtonLabels().map((key) => {
                if (!key.label) {
                    return;
                }
                return {
                    element: "div",
                    className: "option",
                    textContent: key.label,
                    eventListeners: [
                        {
                            event: "click",
                            func: (e) => {clickHandler(e, key.id)}
                        }
                    ]
                };
            })
        );
    } else {
        closeAddDropdown();
    }
});
document.addEventListener("click", function () { //Allow the user to tap off.
    closeAddDropdown();
});

module.exports = {
    startInputProcessor,
    stopInputProcessor
};