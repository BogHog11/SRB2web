var Module = {};
if (window["Module"]) {
  var Module = window["Module"];
}

function loadScript() {
  return new Promise((resolve, reject) => {
    var script = document.createElement("script");
    script.src = "srb2.js";
    script.onload = resolve;
    script.onerror = reject;
    document.body.append(script);
  });
}
var IDBFS = null;
var FS = null;
async function loadFilesystem() {
  Module.noInitialRun = true;
  Module.canvas = document.createElement("canvas");
  await loadScript();
  FS = Module.FS;
  IDBFS = FS.filesystems.IDBFS;

  FS.mkdirTree("/addons");
  FS.symlink("/home/web_user/.srb2", "/addons/.srb2");
  FS.symlink("/home/web_user/.srb2", "/addons/userdata");
  FS.mount(IDBFS, {}, "/home/web_user");
}

module.exports = { loadFilesystem };
