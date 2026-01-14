var Module = {};
if (window["Module"]) {
  var Module = window["Module"];
}

window.SRB2WebNet = {};
var SRB2WebNet = window.SRB2WebNet;
var dialog = require("../dialog.js");
var net = {};
var socket = null;
var resumeID = ""; //Intentionally a empty string.
var enabled = false;
var open = false;
var isListening = false; //Tell game if we're listening.
var LZString = require("../lzstring.js");
var openIDs = {};

net.getSocket = function () {
  return socket;
};

function logInSRB2(msg) {
  try {
    Module.ccall("SRB2_LOG", "void", ["string"], [msg + "\n"]);
  } catch (e) {}
}

function messageHandler(e) {
  try {
    var json = JSON.parse(e.data);
  } catch (e) {
    console.error("JSON parse error for websocket: ", e);
    return;
  }

  if (json.method == "resumable") {
    resumeID = json.id;
  }
  if (json.method == "joined") {
    openIDs[json.id] = { ip: json.ip };
  }
  if (json.method == "leave") {
    openIDs[json.id] = 0;
    delete openIDs[json.id];
  }
  if (json.method == "data") {
    var addr = openIDs[json.id];
    var binaryString = LZString.decompress(json.data);
    if (!binaryString) return;

    var len = binaryString.length;

    var uint8array = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      uint8array[i] = binaryString.charCodeAt(i);
    }

    var ip = "0.0.0.0";
    if (addr) {
      ip = addr.ip;
    }

    var dataPtr = Module._malloc(len);
    Module.HEAPU8.set(uint8array, dataPtr);
    Module.ccall(
      "SRB2_NetworkReceive",
      "void",
      ["number", "number", "number", "string"],
      [dataPtr, len, json.id || 0, ip || "0.0.0.0"]
    );
    Module._free(dataPtr);

    return;
  }
}

SRB2WebNet.SendPacket = function () {
  if (!open) {
    return;
  }
  var data = new Uint8Array(Module.HEAPU8.buffer, data_ptr, length);
  var stringData = "";

  var chunk = 4096;
  for (var i = 0; i < length; i += chunk) {
    var end = Math.min(i + chunk, length);
    stringData += String.fromCharCode.apply(null, data.subarray(i, end));
  }

  socket.send(
    JSON.stringify({
      method: "data",
      id: isListening ? node_id : undefined,
      data: LZString.compress(stringData),
    })
  );
  return 0;
};

SRB2WebNet.ConnectTo = function (address, port) {
  var url = address;
  if (port) {
    url += ":" + port;
  } else {
    url += ":5029";
  }
  socket.send(
    JSON.stringify({
      method: "connect",
      url,
    })
  );
  isListening = false;
  return 0;
};

SRB2WebNet.ListenOn = function () {
  socket.send(
    JSON.stringify({
      method: "listen",
    })
  );
  return 0;
};

SRB2WebNet.CloseSocket = function () {
  socket.send(
    JSON.stringify({
      method: "close",
    })
  );
  isListening = false;
  return 0;
};

function openHandler() {
  if (isListening) {
    socket.send(
      JSON.stringify({
        method: "listen",
      })
    );
  }
}

function connectLoop() {
  try {
    var url = "";
    if (window.location.protocol.startsWith("https")) {
      url += "wss://";
    } else {
      url += "ws://";
    }
    url += host + "/";
    url += resumeID; //Allows resuming from the websocket connection.
    socket = new WebSocket(host);
    socket.onerror = function () {
      console.error("Failed to connect to relay.");
    };
    socket.onopen = function () {
      open = true;
      openHandler();
    };
    socket.onclose = function () {
      open = false;
      connectLoop();
    };
    socket.onmessage = messageHandler;
  } catch (e) {
    dialog.alert(`Failed to connect to relay server [${host}]: ${e}`);
    console.error(e);
    socket = null;
    enabled = false;
    open = false;
    isListening = false;
    resumeID = "";
    return;
  }
}
function stopConnectLoop() {
  if (socket) {
    socket.onclose = function () {};
    socket.onmessage = function () {};
    socket.close();
  }
  socket = null;
  resumeID = "";
  open = false;
  isListening = null;
}

net.enable = function (h) {
  if (!h) {
    return;
  }
  enabled = true;
  host = h;
  if (!host.endsWith("/")) {
    host += "/";
  }
  connectLoop();
};
net.disable = function () {
  enabled = false;
  stopConnectLoop();
};

module.exports = net;
