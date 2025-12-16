mergeInto(LibraryManager.library, {
  JS_InitNetwork: function () {
    // If Module.WebNet exists and has Init, call it. Otherwise return 1 (Success)
    if (window.WebNet && window.WebNet.Init) {
      return window.WebNet.Init();
    }
    return 1;
  },

  JS_OpenSocket: function () {
    if (window.WebNet && window.WebNet.OpenSocket) {
      return window.WebNet.OpenSocket();
    }
    return 1;
  },

  JS_Connect: function (addr_ptr) {
    if (window.WebNet && window.WebNet.Connect) {
      return window.WebNet.Connect(UTF8ToString(addr_ptr));
    }
    return 1;
  },

  JS_SendPacket: function (data_ptr, len) {
    if (window.WebNet && window.WebNet.SendPacket) {
      // We pass the raw pointer and length to the main JS
      return window.WebNet.SendPacket(data_ptr, len);
    }
    return 1;
  },

  JS_GetPacket: function (buf_ptr, max_len) {
    if (window.WebNet && window.WebNet.GetPacket) {
      return window.WebNet.GetPacket(buf_ptr, max_len);
    }
    return 0;
  },
});
