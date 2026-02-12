var { getWebsocketURL, PLACEHOLDER_IP } = require("./util.js");
var ErrorCodes = require("./errors.js");
var attachSRB2 = require("../attach.js");
var peer = require("simple-peer");
var rtcConfig = require("../rtc-config.js");

class ListenChannel {
  constructor(url, id, ip, useRTC) {
    this.url = url;
    this.id = id;
    this.ip = ip;
    this.useRTC = useRTC;
    this.socket = new WebSocket(url);
    this.socket.binaryType = "arraybuffer";
    this.socket.onopen = this.handleOpen.bind(this);
    this.socket.onmessage = this.handleMessage.bind(this);
    this.socket.onclose = this.handleClose.bind(this);

    this.isOpen = false;
    this.rtcOpen = false;
  }

  handleOpen() {
    var { socket } = this;
    this.isOpen = true;
    if (this.useRTC) {
      this.send(JSON.stringify({ webrtc: true }));
    }
  }

  handleMessage(event) {
    var { socket } = this;
    if (event.data instanceof ArrayBuffer) {
      if (this.ondata && !this.useRTC) {
        this.ondata(event.data);
      }
    } else {
      var json = JSON.parse(event.data);

      if (json.rtcReady) {
        var _this = this;
        this.peer = new peer({
          initiator: true,
          trickle: false,
          config: rtcConfig,
        });

        this.peer.on("signal", (data) => {
          _this.send(JSON.stringify({ signal: data }));
        });
        
        this.peer.on("connect", () => {
          _this.rtcOpen = true;
        });

        this.peer.on("close", () => {
          _this.rtcOpen = false;
          _this.handleClose();
        });

        this.peer.on("data", (data) => {
          if (_this.ondata) {
            _this.ondata(data);
          }
          if (_this.socket) {
            _this.socket.onclose = () => {};
            _this.socket.close(); //Won't be needing this anymore.
            _this.socket = null;
          }
        });
      }
    }
  }

  handleClose() {
    var { socket } = this;
    if (this.useRTC && !this.rtcOpen) {
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }
      
      this.isOpen = false;
      this.rtcOpen = false;
      if (this.requestDispose) {
        this.requestDispose();
      }

      return;
    } else {
      if (this.useRTC) {
        return;
      }
    }

    this.isOpen = false;
    if (this.requestDispose) {
      this.requestDispose();
    }
  }

  dispose() {
    if (this.isOpen && this.socket) {
      this.socket.onclose = () => {};
      this.isOpen = false;
      this.socket.close();
    }
    this.socket = null;
    this.requestDispose = null;
  }

  send(data) {
    var { socket } = this;
    if (!this.isOpen) {
      return;
    }
    if (this.useRTC && this.rtcOpen) {
      this.peer.send(data);
      return;
    }
    if (!socket) {
      return;
    }
    socket.send(data);
  }
}

module.exports = ListenChannel;
