var { TouchControlButton } = require("./button.js");
var { KeyName, KeyNum, getButtonLabels } = require("./keydef.js");
var dialog = require("../dialog.js");
var elements = require("../gp2/elements.js");
var processRate = 1000/60;
var processInterval = null;
var inEditMode = false;
var buttons = [];

var defaultPreset = [
    {"id":"UI_JOYSTICK","side":"left","xPos":1.1403353287569775,"yPos":7.67374946199395,"width":22.195300078496754,"height":47.54102296144616},
    {"id":"GC_FORWARD","side":"left","xPos":55.30791387376463,"yPos":38.65620353584098,"width":6.076422449784956,"height":7.880072744939483},
    {"id":"GC_BACKWARD","side":"left","xPos":55.23218738561494,"yPos":9.989447744939483,"width":6.486349929653184,"height":9.382383317899624},
    {"id":"GC_STRAFELEFT","side":"left","xPos":47.923960204005766,"yPos":21.96407668379591,"width":5.820220008950631,"height":12.203389519642112},
    {"id":"GC_STRAFERIGHT","side":"left","xPos":62.53229590844619,"yPos":21.709389917440518,"width":6.090697348554173,"height":12.186699104627504},
    {"id":"GC_JUMP","side":"left","xPos":76.95432246865849,"yPos":8.209951970732462,"width":17.48846855554539,"height":24.95631350101732},
    {"id":"GC_PAUSE","side":"left","xPos":79.66868008212847,"yPos":86.72850390706516,"width":6.95483720145498,"height":8.53108044657763},
    {"id":"GC_SYSTEMMENU","side":"left","xPos":74.65383325802983,"yPos":70.71779789232053,"width":11.105335062454246,"height":10.717774456450856},
    {"id":"GC_CONSOLE","side":"left","xPos":88.72702837339432,"yPos":85.81520297093464,"width":10,"height":10},
    {"id":"GC_TALKKEY","side":"left","xPos":87.7018985776217,"yPos":59.1738387220889,"width":10,"height":10}
];

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
    localStorage.setItem("touchControls", JSON.stringify(data));
    dialog.alert("Touch controls saved.");
}

function loadButtonsData(data) {
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
function loadButtons() {
    var data = localStorage.getItem("touchControls");
    if (!data) {
        loadButtonsData(defaultPreset);
    } else {
        loadButtonsData(data);
    }
}

var touchPositions = [];
var touches = [];
var active = false;
var processState = {};
document.addEventListener("touchstart", function (e) {
    if (!active) {
        return;
    }
    touches = e.touches;
    if (processState.disableDefault) {
        e.preventDefault();
    }
}, { passive: false });
document.addEventListener("touchmove", function (e) {
    if (!active) {
        return;
    }
    touches = e.touches;
    if (processState.disableDefault) {
        e.preventDefault();
    }
}, { passive: false });
document.addEventListener("touchend", function (e) {
    if (!active) {
        return;
    }
    touches = e.touches;
    if (processState.disableDefault) {
        e.preventDefault();
    }
}, { passive: false });

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
    active = true;
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

    loadButtons();
}

function stopInputProcessor() {
    active = false;
    clearInterval(processInterval);
    inEditMode = false;
    touchControlsDialogDiv.hidden = true;
    touchControlsContainer.hidden = true;
    processState = {};
    destroyButtons();
}

elements.getGPId("touchControlsClose").addEventListener("click", async function () {
    var promise = dialog.confirm("Are you sure you want to exit? Unsaved changes will be lost.");
    promise.then((result) => {
        if (result) {
            stopInputProcessor();
        }
    });
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

var touchControlsReset = elements.getGPId("touchControlsSave");
touchControlsReset.addEventListener("click", function () {
    if (!active) {
        return;
    }
    var promise = dialog.confirm("Are you sure you want to reset? This cannot be undone.");
    promise.then((result) => {
        if (result) {
            loadButtonsData(defaultPreset);
        }
    });
});

var touchControlsSave = elements.getGPId("touchControlsSave");
touchControlsSave.addEventListener("click", function () {
    if (!active) {
        return;
    }
    saveButtons();
});

module.exports = {
    startInputProcessor,
    stopInputProcessor
};