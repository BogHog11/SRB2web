mergeInto(LibraryManager.library, {
  JS_InitNetwork: function () {
    // If Module.WebNet exists and has Init, call it. Otherwise return 1 (Success)
    if (Module.WebNet && Module.WebNet.Init) {
      return Module.WebNet.Init();
    }
    return 1;
  },

  JS_OpenSocket: function () {
    if (Module.WebNet && Module.WebNet.OpenSocket) {
      return Module.WebNet.OpenSocket();
    }
    return 1;
  },

  JS_Connect: function (addr_ptr) {
    if (Module.WebNet && Module.WebNet.Connect) {
      return Module.WebNet.Connect(UTF8ToString(addr_ptr));
    }
    return 1;
  },

  JS_SendPacket: function (data_ptr, len) {
    if (Module.WebNet && Module.WebNet.SendPacket) {
      // We pass the raw pointer and length to the main JS
      return Module.WebNet.SendPacket(data_ptr, len);
    }
    return 1;
  },

  JS_GetPacket: function (buf_ptr, max_len) {
    if (Module.WebNet && Module.WebNet.GetPacket) {
      return Module.WebNet.GetPacket(buf_ptr, max_len);
    }
    return 0;
  },
});
