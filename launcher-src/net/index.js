var { ConnectState, ListenState } = require("./state");
var attachSRB2 = require("./attach.js");

var enabled = false;
var host = "";
var curState = null;

attachSRB2.onconnect = function (address, port) {
  if (!enabled) {
    return;
  }
  if (curState) {
    curState.dispose();
  }
  curState = new ConnectState(host, { address, port });
};

attachSRB2.onlisten = function () {
  if (!enabled) {
    return;
  }
  if (curState) {
    curState.dispose();
  }
  curState = new ListenState(host);
};

function enable(h) {
  if (curState) {
    curState.dispose();
    curState = null;
  }
  enabled = true;
  if (h) {
    host = h;
  }
}

function disable() {
  if (curState) {
    curState.dispose();
    curState = null;
  }
  enabled = false;
  host = null;
}

module.exports = {
  enable,
  disable,
};
