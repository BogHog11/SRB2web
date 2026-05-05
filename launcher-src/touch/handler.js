var { KeyNum, KeyName } = require("./keydef.js");

if (window["Module"]) {
  var Module = window["Module"];
}

function sendInput(nameid, down) {
    var number = KeyNum[nameid];

    if (number == KeyNum.UI_SHOW_KEYBOARD) {
        //Does nothing for now.
        return;
    }
    if (number == KeyNum.UI_JOYSTICK) {
        //Won't do anything because it's not a button.
        return;
    }

    var downNumber = down ? 1 : 0;

    if (!Module.ccall) {
        return;
    }
    Module.ccall(
        'SRB2_SetDirectAction',
        'void',
        ['number','number'],
        [number, downNumber]
    );
    //window.alert("sent direct action: "+nameid+","+down);
}

function sendJoystick(x,y) {
    if (!Module.ccall) {
        return;
    }
    Module.ccall(
        'SRB2_SetAnalogStick',
        'void',
        ['number','number'],
        [Math.round(x*127), Math.round(y*127)]
    );
}

module.exports = {
    sendInput,
    sendJoystick
}