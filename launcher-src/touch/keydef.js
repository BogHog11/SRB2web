//////////////////////////////////////////////////////////////

var KeyNum = {
	//Purely custom key numbers, not used by the C logic, but are added to keep the UI for them consistent with the rest of the controls:
	UI_SHOW_KEYBOARD: 1000,
	UI_JOYSTICK: 1001,

	///////////////////////////////////////////
	//Source: g_input.h

    GC_NULL: 0, // a key/button mapped to GC_NULL has no effect
	GC_FORWARD: 1,
	GC_BACKWARD: 2,
	GC_STRAFELEFT: 3,
	GC_STRAFERIGHT: 4,
	GC_TURNLEFT: 5,
	GC_TURNRIGHT: 6,
	GC_WEAPONNEXT: 7,
	GC_WEAPONPREV: 8,
	GC_WEPSLOT1: 9,
	GC_WEPSLOT2: 10,
	GC_WEPSLOT3: 11,
	GC_WEPSLOT4: 12,
	GC_WEPSLOT5: 13,
	GC_WEPSLOT6: 14,
	GC_WEPSLOT7: 15,
	GC_WEPSLOT8: 16,
	GC_WEPSLOT9: 17,
	GC_WEPSLOT10: 18,
	GC_FIRE: 19,
	GC_FIRENORMAL: 20,
	GC_TOSSFLAG: 21,
	GC_SPIN: 22,
	GC_CAMTOGGLE: 23,
	GC_CAMRESET: 24,
	GC_LOOKUP: 25,
	GC_LOOKDOWN: 26,
	GC_CENTERVIEW: 27,
	GC_MOUSEAIMING: 28, // mouse aiming is momentary (toggleable in the menu)
	GC_TALKKEY: 29,
	GC_TEAMKEY: 30,
	GC_SCORES: 31,
	GC_JUMP: 32,
	GC_CONSOLE: 33,
	GC_PAUSE: 34,
	GC_SYSTEMMENU: 35,
	GC_SCREENSHOT: 36,
	GC_RECORDGIF: 37,
	GC_VIEWPOINTNEXT: 38,
	GC_VIEWPOINTPREV: 39,
	GC_CUSTOM1: 40, // Lua scriptable
	GC_CUSTOM2: 41, // Lua scriptable
	GC_CUSTOM3: 42, // Lua scriptable
};

//////////////////////////////////////////////////////////////

var KeyName = {
	//Purely custom key names, not used by C logic, but are added to keep the UI for them consistent with the rest of the controls:
	UI_SHOW_KEYBOARD: "Show touch keyboard",
	UI_JOYSTICK: "Virtual joystick",

	///////////////////////////////////////////
	//Source: m_menu.c

    //GC_NULL: "Nothing",
    GC_FORWARD: "Move Forward",
	GC_BACKWARD: "Move Backward",
	GC_STRAFELEFT: "Move Left",
	GC_STRAFERIGHT: "Move Right",
	GC_JUMP: "Jump",
	GC_SPIN: "Spin",

	GC_LOOKUP: "Look Up",
	GC_LOOKDOWN: "Look Down",
	GC_TURNLEFT: "Look Left",
	GC_TURNRIGHT: "Look Right",
	GC_CENTERVIEW: "Center View",
	GC_MOUSEAIMING: "Toggle Mouselook",
	GC_CAMTOGGLE: "Toggle Third-Person",
	GC_CAMRESET: "Reset Camera"
};

//////////////////////////////////////////////////////////////

function getButtonLabels() {
	return Object.keys(KeyName).map(key => {
		return {id: key, label: KeyName[key]};
	});
}

//////////////////////////////////////////////////////////////

module.exports = {
    KeyNum,
    KeyName,
	getButtonLabels
};