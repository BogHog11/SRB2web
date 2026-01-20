var { getWebsocketURL, PLACEHOLDER_IP } = require("./util.js");
var ErrorCodes = require("./errors.js");
var attachSRB2 = require("../attach.js");

class ConnectState {
  static createConnectURL(wsHost, { address, port }) {
    var connectURL = address;
    if (port) {
      connectURL += ":" + port;
    } else {
      connectURL += ":5029";
    }

    return `${getWebsocketURL(wsHost)}connect/${connectURL.trim()}`;
  }

  constructor(wsHost, { address, port }) {
    this.address = address;
    this.port = port;

    this.wsHost = wsHost;
    this.disposed = false;
    this.isOpen = false;
    this.initWebsocket();
  }

  initWebsocket() {
    var { wsHost, address, port } = this;
    var connectURL = ConnectState.createConnectURL(wsHost, { address, port });
    this.url = connectURL;
    var socket = new WebSocket(connectURL);
    var _this = this;
    this.isOpen = false;
    socket.onclose = function (event) {
      _this.isOpen = false;
      var code = event.code;
      if (code == ErrorCodes.NETGAME_NOT_FOUND) {
        console.warn(`[Relay Connection]: Connection not found, not retrying.`);
        return;
      }
      console.warn(
        `[Relay Connection]: Disconnected unexpectedly, reconnecting...`
      );
      socket.onmessage = () => {};
      _this.initWebsocket();
    };
    socket.binaryType = "arraybuffer";
    socket.onopen = this.handleOpen.bind(this);
    this.socket = socket;
  }

  handleOpen() {
    var { socket } = this;
    this.isOpen = true;
    socket.onmessage = function (event) {
      try {
        var uint8array = new Uint8Array(event.data);
      } catch (e) {
        return;
      }

      attachSRB2.emitPacket(uint8array, 0, PLACEHOLDER_IP);
    };

    attachSRB2.onpacket = this.handleSRB2Packet.bind(this);
  }

  handleSRB2Packet(data) {
    var { socket } = this;
    if (!socket) {
      return;
    }
    if (!this.isOpen) {
      return;
    }
    socket.send(data);
  }

  dispose() {
    if (!this.disposed) {
      this.disposed = true;
      this.socket.onclose = () => {};
      this.socket.close();
      this.socket = null;
      this.initWebsocket = () => {};
    }
  }
}

module.exports = ConnectState;
