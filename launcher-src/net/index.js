var { ConnectState, ListenState } = require("./state");
var attachSRB2 = require("./attach.js");

var enabled = false;
var publicEnabled = false;
var host = "";
var curState = null;
var serverRTCEnabled = true;

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
  curState = new ListenState(host, publicEnabled, serverRTCEnabled);
};

attachSRB2.onclose = function () {
  if (curState) {
    curState.dispose();
  }
  curState = null;
};

function enable(h) {
  if (curState) {
    curState.dispose();
    curState = null;
  }
  enabled = true;
  host = h;
}

function enablePublic() {
  publicEnabled = true;
}

function disable() {
  if (curState) {
    curState.dispose();
    curState = null;
  }
  enabled = false;
  host = null;
}

function disablePublic() {
  publicEnabled = false;
}

function enableServerWebRTC() {
  serverRTCEnabled = true;
}

function disableServerWebRTC() {
  serverRTCEnabled = false;
}

async function listPublicGames() {
  if (!enabled) {
    return [];
  }
  if (!host) {
    return [];
  }
  try {
    var response = await fetch(`https://${host}/public`);
    if (!response.ok) {
      throw new Error("Failed to fetch public games");
    }
  } catch (e) {
    console.warn(
      "Failed to fetch public games through https, trying http. Error message:",
      e,
    );
    try {
      var response = await fetch(`http://${host}/public`);
      if (!response.ok) {
        console.warn(
          "Failed to fetch public games, response not ok. Status:",
          response.status,
        );
        return [];
      }
    } catch (e) {
      return [];
    }
  }
  var publicNetgames = await response.json();

  return publicNetgames;
}

module.exports = {
  enable,
  disable,
  enablePublic,
  disablePublic,
  enableServerWebRTC,
  disableServerWebRTC,
  listPublicGames,
};
