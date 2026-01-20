var attach = {};
var Module = {};
if (window["Module"]) {
  var Module = window["Module"];
}

class SRB2WebNet {
  static InitNetwork() {
    if (attach.oninit) {
      attach.oninit();
    }
    return 0;
  }

  static ConnectTo(address, port) {
    if (attach.onconnect) {
      attach.onconnect(address, port);
    }
    return 0;
  }

  static SendPacket(node_id, data_ptr, length) {
    if (attach.onpacket) {
      var data = new Uint8Array(Module.HEAPU8.buffer, data_ptr, length);
      attach.onpacket(data, node_id);
    }
    return 0;
  }

  static ListenOn(port) {
    if (attach.onlisten) {
      attach.onlisten(port);
    }
    return 0;
  }

  static CloseSocket() {
    if (attach.onclose) {
      attach.onclose();
    }
    return 0;
  }
}
window.SRB2WebNet = SRB2WebNet;

attach.emitPacket = function (data, id, ip) {
  var dataPtr = Module._malloc(data.length);
  Module.HEAPU8.set(data, dataPtr);
  Module.ccall(
    "SRB2_NetworkReceive",
    "void",
    ["number", "number", "number", "string"],
    [dataPtr, data.length, +id || 0, ip]
  );
  Module._free(dataPtr);
};

attach.emitClose = function (id) {
  Module.ccall("SRB2_NetworkClosed", "null", ["number"], [id || 0]);
};

attach.logInSRB2 = function (msg) {
  try {
    Module.ccall("SRB2_LOG", "void", ["string"], [msg + "\n"]);
  } catch (e) {}
};

module.exports = attach;
