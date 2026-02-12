mergeInto(LibraryManager.library, {
  SRB2_ServerInfoResponse: function (
    serverName,
    map,
    mapTitle,
    ingame_players,
    playerNameList
  ) {
    if (window.SRB2_ServerInfoResponse) {
      return window.SRB2_ServerInfoResponse({
        name: UTF8ToString(serverName),
        map: UTF8ToString(map),
        mapTitle: UTF8ToString(mapTitle),
        ingamePlayers: ingame_players,
        playerNames: UTF8ToString(playerNameList),
      });
    }
    return 1;
  },
});
