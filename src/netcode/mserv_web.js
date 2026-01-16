mergeInto(LibraryManager.library, {
  SRB2_RequestServerList: function (name) {
    if (window.SRB2RequestServerList) {
      return SRB2RequestServerList(name);
    }
    return 1;
  },
});
