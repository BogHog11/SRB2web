mergeInto(LibraryManager.library, {
  SRB2_InitNetwork: function () {
    // If Module.WebNet exists and has Init, call it. Otherwise return 1 (Success)
    if (window.SRB2WebNet && window.SRB2WebNet.InitNetwork) {
      return window.SRB2WebNet.InitNetwork();
    }
    return 1;
  },
  ////////////////////////////////
  SRB2_NetworkSend: function (node_id, data_ptr, len) {
    if (window.SRB2WebNet && window.SRB2WebNet.SendPacket) {
      // For now, ignore node_id, assume single connection
      return window.SRB2WebNet.SendPacket(node_id, data_ptr, len);
    }
    return 1;
  },
  SRB2_ListenOn: function (port) {
    if (window.SRB2WebNet && window.SRB2WebNet.ListenOn) {
      return window.SRB2WebNet.ListenOn(port);
    }
    return 1;
  },
  SRB2_ConnectTo: function (addr, port) {
    if (window.SRB2WebNet && window.SRB2WebNet.ConnectTo) {
      return window.SRB2WebNet.ConnectTo(UTF8ToString(addr,port));
    }
    return 1;
  },
  SRB2_CloseSocket: function () {
    if (window.SRB2WebNet && window.SRB2WebNet.CloseSocket) {
      return window.SRB2WebNet.CloseSocket();
    }
    return 1;
  },
  SRB2_GetPort: function () {
    if (window.SRB2WebNet && window.SRB2WebNet.GetPort) {
      return window.SRB2WebNet.GetPort();
    }
    return 5029; // Default port
  },

});
