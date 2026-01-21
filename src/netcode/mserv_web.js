mergeInto(LibraryManager.library, {
  SRB2_RequestServerList: function (name) {
    if (window.SRB2RequestServerList) {
      return window.SRB2RequestServerList(name);
    }
    return 1;
  },
  SRB2_ServerInfoResponse: function (serverName, map, mapTitle) {
    if (window.SRB2_ServerInfoResponse) {
      return window.SRB2_ServerInfoResponse({
        name: UTF8ToString(serverName),
        map: UTF8ToString(map),
        mapTitle: UTF8ToString(mapTitle),
      });
    }
    return 1;
  },
});
