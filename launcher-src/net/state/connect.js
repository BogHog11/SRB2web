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
    this.isReady = false;
    this.initialQueue = [];
    this.initWebsocket();
  }

  initWebsocket() {
    var { wsHost, address, port } = this;
    var connectURL = ConnectState.createConnectURL(wsHost, { address, port });
    this.url = connectURL;
    var socket = new WebSocket(connectURL);
    var _this = this;
    this.isOpen = false;
    this.isReady = false;
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
    var _this = this;
    var { socket } = this;
    this.isOpen = true;
    this.isReady = false;
    socket.onmessage = function (event) {
      if (event.data instanceof ArrayBuffer) {
        var uint8array = new Uint8Array(event.data);
      } else {
        try {
          var json = JSON.parse(event.data);
          if (json.ready) {
            _this.isReady = true;
            for (var msg of _this.initialQueue) {
              socket.send(msg);
            }
            _this.initialQueue = [];
            return;
          }
        } catch (e) {
          var uint8array = new Uint8Array(event.data);
        }
      }

      attachSRB2.emitPacket(uint8array, 0, PLACEHOLDER_IP);
    };

    attachSRB2.onpacket = this.handleSRB2Packet.bind(this);
  }

  handleSRB2Packet(data) {
    var { socket } = this;
    if (!socket) {
      this.initialQueue.push(data);
      return;
    }
    if (!this.isOpen) {
      this.initialQueue.push(data);
      return;
    }
    if (!this.isReady) {
      this.initialQueue.push(data);
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
      this.initialQueue = null;
    }
    attachSRB2.onpacket = null;
  }
}

module.exports = ConnectState;
