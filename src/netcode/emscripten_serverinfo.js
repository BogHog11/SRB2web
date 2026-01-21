mergeInto(LibraryManager.library, {
  SRB2_ServerInfoResponse: function (
    serverName,
    map,
    mapTitle,
    ingame_players
  ) {
    if (window.SRB2_ServerInfoResponse) {
      return window.SRB2_ServerInfoResponse({
        name: UTF8ToString(serverName),
        map: UTF8ToString(map),
        mapTitle: UTF8ToString(mapTitle),
        ingamePlayers: ingame_players,
      });
    }
    return 1;
  },
});
