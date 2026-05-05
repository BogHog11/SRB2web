var { TouchControlButton } = require("./button.js");
var { KeyName, KeyNum, getButtonLabels } = require("./keydef.js");
var dialog = require("../dialog.js");
var elements = require("../gp2/elements.js");
var processRate = 1000/60;
var processInterval = null;
var inEditMode = false;
var buttons = [];

var defaultPreset = [{"id":"UI_JOYSTICK","side":"left","xPos":2.3032555642972756,"yPos":6.405970807465565,"width":22.107455922429768,"height":48.776241041384075},{"id":"GC_JUMP","side":"left","xPos":77.95130449018576,"yPos":6.35752988379069,"width":18.549890476299414,"height":32.48455168607836},{"id":"GC_SPIN","side":"left","xPos":71.91969060269491,"yPos":40.010837561300086,"width":24.75001680030655,"height":19.114005927848496},{"id":"GC_TURNLEFT","side":"left","xPos":78.3445523040012,"yPos":65.56221734303266,"width":10.60757683101894,"height":10.033380830029214},{"id":"GC_TURNRIGHT","side":"left","xPos":66.50842356646916,"yPos":65.56292041912302,"width":10.893052465570097,"height":10},{"id":"GC_PAUSE","side":"left","xPos":77.40271192693082,"yPos":88.83235975975585,"width":10,"height":10},{"id":"GC_SYSTEMMENU","side":"left","xPos":87.66887882618045,"yPos":88.86195773473366,"width":10,"height":10},{"id":"UI_SHOW_KEYBOARD","side":"left","xPos":77.29218735701868,"yPos":79.30181181689534,"width":20.438477277406662,"height":10},{"id":"GC_TALKKEY","side":"left","xPos":55.771904494367966,"yPos":31.181241196264608,"width":10,"height":10},{"id":"GC_TEAMKEY","side":"left","xPos":66.5833145074579,"yPos":24.83782378182387,"width":10,"height":10},{"id":"GC_FIRE","side":"left","xPos":50.00228770131771,"yPos":20.779424040066772,"width":10,"height":10},{"id":"GC_TOSSFLAG","side":"left","xPos":60.81479520783767,"yPos":13.134786004017101,"width":10,"height":10}];

var touchControlsDialogDiv = elements.getGPId("touchControlsDialog");
var touchControlsContainer = elements.getGPId("touchControlsContainer");

function destroyButtons () {
    buttons.forEach((button) => {button.destroy();});
    buttons = [];
}

function createButton(data) {
    var button = data ? (TouchControlButton.fromSavedData(data)) : (new TouchControlButton());
    button.editMode = inEditMode;
    button.append(touchControlsContainer);
    return button;
}

function saveButtons() {
    var data = buttons.map((button) => {return button.save();});
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
function generateTouchRandomId() {
    return Date.now()+"_"+(Math.random()*100000);
}
document.addEventListener("touchstart", function (e) {
    if (!active) {
        return;
    }
    for (var touch of e.changedTouches) {
        if (!touches.find(t => t.id == touch.identifier)) {
            touches.push({
                id: touch.identifier,
                rid: generateTouchRandomId(),
                clientX: touch.clientX,
                clientY: touch.clientY,
                radiusX: touch.radiusX,
                radiusY: touch.radiusY,
                top: touch.clientY,
                left: touch.clientX,
                width: touch.radiusX < 2 ? 2 : touch.radiusX,
                height: touch.radiusY < 2 ? 2 : touch.radiusY,
                touching: true
            });
        }
    }
    if (processState.disableDefault) {
        e.preventDefault();
    }
}, { passive: false });
document.addEventListener("touchmove", function (e) {
    if (!active) {
        return;
    }
    for (var touch of e.changedTouches) {
        var t = touches.find(t => t.id == touch.identifier);
        if (t) {
            t.clientX = touch.clientX;
            t.clientY = touch.clientY;
            t.radiusX = touch.radiusX;
            t.radiusY = touch.radiusY;
            t.left = touch.clientX;
            t.top = touch.clientY;
            t.width = touch.radiusX < 2 ? 2 : touch.radiusX;
            t.height = touch.radiusY < 2 ? 2 : touch.radiusY;
        }
    }
    if (processState.disableDefault) {
        e.preventDefault();
    }
}, { passive: false });
document.addEventListener("touchend", function (e) {
    if (!active) {
        return;
    }
    for (var touch of e.changedTouches) {
        var t = touches.find(t => t.id == touch.identifier);
        if (t) {
            t.touching = false;
            touches = touches.filter(t => t.id !== touch.identifier);
        }
    }
    if (processState.disableDefault) {
        e.preventDefault();
    }
}, { passive: false });

function updateTouchPositions() {
    touchPositions = touches;
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
        Array.from(buttons).reverse().forEach(button => {
            if (button.destroyed) {
                buttons = buttons.filter(b => b.randomId !== button.randomId);
            } else {
                button.process(touchPositions, processState);
            }
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

var touchControlsReset = elements.getGPId("touchControlsReset");
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
touchControlsSave.addEventListener("click", function (event) {
    if (!active) {
        return;
    }
    if (event.shiftKey) {
        var data = buttons.map(button => button.save());
        dialog.alert(JSON.stringify(data));
    } else {
        saveButtons();
    }
});

module.exports = {
    startInputProcessor,
    stopInputProcessor
};