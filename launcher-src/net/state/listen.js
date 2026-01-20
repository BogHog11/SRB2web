var { getWebsocketURL, PLACEHOLDER_IP } = require("./util.js");
var ErrorCodes = require("./errors.js");
var attachSRB2 = require("../attach.js");
var ListenChannel = require("./listench.js");

class ListenState {
  static getChannelURL(wsHost, code) {
    return getWebsocketURL(wsHost) + "listench/" + code;
  }

  constructor(wsHost) {
    this.wsHost = wsHost;
    this.isOpen = false;
    this.connections = {};
    this.address = PLACEHOLDER_IP + ":5029";
    this.openSocket();
  }

  attachConnection(code, ip) {
    var id = 1;
    while (this.connections[id]) {
      id += 1;
    }
    var ch = new ListenChannel(
      ListenState.getChannelURL(this.wsHost, code),
      id,
      ip
    );
    this.connections[id] = ch;
    var _this = this;

    ch.requestDispose = () => {
      ch.dispose();
      delete _this.connections[id];
    };

    ch.ondata = (data) => {
      attachSRB2.emitPacket(data, id, ip);
    };
  }

  disconnectAll() {
    for (var id of Object.keys(this.connections)) {
      this.connections[id].requestDispose();
    }
  }

  openSocket() {
    var _this = this;
    var { wsHost } = this;
    this.socket = new WebSocket(getWebsocketURL(wsHost) + "listen");

    this.socket.onclose = function () {
      console.warn(
        `[Relay Connection]: Lost connection, connection might become unstable temporarily. Reconnecting...`
      );
      _this.openSocket();
    };
    this.socket.onmessage = function (event) {
      var json = JSON.parse(event.data);

      if (json.method == "listening") {
        _this.address = json.url;
        attachSRB2.logInSRB2("[RELAY CONNECTION]: Now active on: " + json.url);
      }

      if (json.method == "incoming") {
        _this.attachConnection(json.channel, json.ip);
      }
    };
  }

  handleSRB2Send(data, id) {
    var ch = this.connections[id];
    if (!ch) {
      return;
    }
    ch.send(data);
  }

  dispose() {
    if (this.socket) {
      this.socket.onclose = () => {};
      this.socket.close();
    }
    this.socket = null;
    this.disconnectAll();
  }
}

module.exports = ListenState;
