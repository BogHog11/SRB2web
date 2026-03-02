var Module = window["Module"] || {};

function loadScript() {
  return new Promise((resolve, reject) => {
    var script = document.createElement("script");
    script.src = "srb2.js";
    script.onload = resolve;
    script.onerror = reject;
    document.body.append(script);
  });
}

var FS = null;

async function loadFilesystem() {
  Module.noInitialRun = true;
  Module.canvas = document.createElement("canvas");
  
  await loadScript();
  FS = Module.FS;

  // 1. Prepare the mount point
  FS.mkdirTree("/home/web_user");
  FS.mount(FS.filesystems.IDBFS, {}, "/home/web_user");

  // 2. Sync from IndexedDB to MEMFS
  await new Promise((resolve) => {
    FS.syncfs(true, (err) => {
      if (err) console.error("Sync Error:", err);
      
      // --- SETUP START (Inside callback to ensure persistence awareness) ---
      
      // Create the internal game folder
      if (!FS.analyzePath("/home/web_user/.srb2").exists) {
        FS.mkdir("/home/web_user/.srb2");
      }

      // Create the default subfolders
      const subFolders = ["/home/web_user/.srb2/addons", "/home/web_user/.srb2/logs"];
      subFolders.forEach(path => {
        if (!FS.analyzePath(path).exists) FS.mkdir(path);
      });

      // 3. Setup the /addons/userdata symlink
      // We do NOT mkdir /addons/userdata; we link the name directly to the target.
      if (!FS.analyzePath("/addons").exists) FS.mkdir("/addons");
      
      try {
        if (!FS.analyzePath("/addons/userdata").exists) {
          FS.symlink("/home/web_user/.srb2", "/addons/userdata");
        }
      } catch (e) {
        console.warn("Symlink issue:", e);
      }

      // --- SETUP END ---
      resolve();
    });
  });

  console.log("Filesystem ready. Default path: /addons/userdata");
}

module.exports = { loadFilesystem };