if (window["Module"]) {
  var Module = window["Module"];
}

class SRB2Relay {
  constructor(url) {
    this.url = url;
    this.isOpen = false;
    this.hasActiveNetgame = false;
    this.attemptConnection();
    this.addListeners();
  }

  attemptConnection() {
    this.myIP = "0.0.0.0";
    this.ws = new WebSocket(this.url);
    var _this = this;
    this.ws.onopen = (event) => {
      _this.isOpen = true;
      console.log("Relay connected!");
    };
    this.ws.onmessage = this.onRelayMessage.bind(this);
    this.ws.onclose = () => {
      _this.isOpen = false;
      if (_this.pingInterval) clearInterval(_this.pingInterval);
      console.log("Relay disconnected, attempting reconnect...");
      setTimeout(() => _this.attemptConnection(), 1000); // Reconnect after 1s
    };
    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  startNetgame() {
    this.hasActiveNetgame = true;
    if (this.isOpen) {
      this.ws.send(JSON.stringify({ method: "listen" }));
    }
  }

  endNetgame() {
    this.hasActiveNetgame = false;
    if (this.isOpen) {
      this.ws.send(JSON.stringify({ method: "close" }));
    }
  }

  onRelayMessage(event) {
    var json = JSON.parse(event.data);
    if (json.method == "ready") {
      this.myIP = json.ip;
      console.log("Relay ready, my IP: " + this.myIP);
      if (this.hasActiveNetgame) {
        this.ws.send(JSON.stringify({ method: "listen" }));
      }
    }
    if (json.method == "listening") {
      Module.ccall(
        "SRB2_LOG",
        "void",
        ["char"],
        ["RELAY: Now listening on " + json.listening],
      );
    }
    if (json.method == "connected") {
    }
    if (json.method == "error") {
    }
    if (json.method == "join") {
      // A client joined, set their IP for banning
      Module.ccall(
        "SRB2_SetClientIP",
        null,
        ["number", "string"],
        [json.id, json.ip],
      );
    }
    if (json.method == "leave") {
      // A client left, notify SRB2 to disconnect them
      //Module.ccall("SRB2_ClientDisconnected", null, ["number"], [json.id]);
    }
    /*if (json.method == "pong") {}*/
    if (json.method == "data") {
      var binaryString = json.data;
      var data = [];
      for (var i = 0; i < binaryString.length; i++) {
        data.push(binaryString.charCodeAt(i));
      }
      var uint8array = new Uint8Array(data);

      var dataPtr = Module._malloc(uint8array.length);
      Module.HEAPU8.set(uint8array, dataPtr);
      Module.ccall(
        "SRB2_NetworkReceive",
        "void",
        ["number", "number", "number"],
        [dataPtr, uint8array.length, json.id || 0],
      );
      Module._free(dataPtr);
    }
  }

  closeRelay() {
    if (this.ws) {
      this.ws.close();
    }
    window.SRB2WebNet = null;
  }

  addListeners() {
    var _this = this;
    window.SRB2WebNet = {
      InitNetwork: function () {
        return 0;
      },
      ConnectTo: function (address) {
        if (_this.hasActiveNetgame) {
          return 1; // Can't connect if already in netgame
        }
        var id = address;
        if (id.indexOf(":") == -1) {
          id += ":5029";
        }
        _this.ws.send(
          JSON.stringify({
            method: "connect",
            id: id,
          }),
        );
        return 0;
      },
      SendPacket: function (node_id, data_ptr, length) {
        // Extract the binary data from the heap
        var data = new Uint8Array(Module.HEAPU8.buffer, data_ptr, length);

        // Convert to Base64
        var base64Data = String.fromCharCode.apply(null, data);

        // Send as JSON
        _this.ws.send(
          JSON.stringify({
            method: "data",
            id: node_id,
            data: base64Data,
          }),
        );
        return 1;
      },
      ListenOn: function (port) {
        _this.startNetgame();
        return 0; // Success
      },
      CloseSocket: function () {
        _this.endNetgame();
        return 0;
      },
      GetPort: function () {
        // Return the current netgame port
        return 5029; // Or get from somewhere
      },
    };
  }
}

module.exports = { SRB2Relay };
