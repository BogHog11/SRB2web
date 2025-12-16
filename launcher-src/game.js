var elements = require("./gp2/elements.js");
if (window["Module"]) {
    var Module = window["Module"];
}
var IDBFS = null;
var gameCanvas = elements.getGPId("gameCanvas");
var didStart = false;
function loadScript () {
    return new Promise((resolve,reject) => {
        var script = document.createElement("script");
        script.src = "srb2.js";
        script.onload = resolve;
        script.onerror = reject;
    });
}

const CACHE_NAME = 'srb2-assets-v1';

async function downloadAndSaveAssets(assetList) {
    const assets = [
            { url: "assets/characters.pk3", filename: "characters.pk3" },
            { url: "assets/music.pk3", filename: "music.pk3" },
            { url: "assets/srb2.dta", filename: "srb2.pk3" },
            { url: "assets/zones.dta", filename: "zones.pk3" } // If you have it
        ];
    const status = document.getElementById('status');
    
    // 1. Open the browser's cache storage
    const cache = await caches.open(CACHE_NAME);

    for (const asset of assetList) {
        console.log(`Checking storage for ${asset.filename}...`);
        
        // 2. Check if we already have the file in cache
        let response = await cache.match(asset.url);

        if (response) {
            // HIT: We found it!
            console.log(`[CACHE HIT] Loading ${asset.filename} from disk.`);
            if(status) status.innerText = `Loading ${asset.filename} from cache...`;
        } else {
            // MISS: We need to download it
            console.log(`[CACHE MISS] Downloading ${asset.filename} from internet...`);
            if(status) status.innerText = `Downloading ${asset.filename}...`;

            try {
                // Download and add to cache automatically
                await cache.add(asset.url);
                // Retrieve the saved response
                response = await cache.match(asset.url);
            } catch (err) {
                console.error(`Failed to download ${asset.url}`);
                throw err;
            }
        }

        // 3. Read the file from cache into a buffer
        const buffer = await response.arrayBuffer();
        const data = new Uint8Array(buffer);

        // 4. Write to the Game's Virtual RAM (MEMFS)
        // This is fast because we are reading from disk, not network
        FS.writeFile(asset.filename, data);
    }
}

async function initGame() {
    IDBFS = FS.filesystems.IDBFS;

    FS.mkdirTree('/addons');
    FS.symlink('/home/web_user/.srb2', '/addons/.srb2');
    FS.symlink('/home/web_user/.srb2', '/addons/userdata');
    FS.mount(IDBFS, {}, '/home/web_user');
    FS.syncfs(true, (err) => {
        console.log("SyncFS done");
        console.log(err);
        Module.callMain(["-home", "/home/web_user"]);
    });
}

window.LockMouse = () => {
    if (didStart) {
        Module.ccall('lock_mouse', null, [], []);
    }
};
window.UnlockMouse = (force = false) => {
    if (didStart) {
        if (force && document.pointerLockElement) {
            document.exitPointerLock();
        } else if (!document.pointerLockElement) {
            Module.ccall('unlock_mouse', null, [], []);
        }
    }
};

var GetViewportWidth = () => {
        // if (UserAgentIsAndroid()) {
        //   if (document.fullscreenElement) // chrome android weirdness
        //     return screen.width;
        //   else
        //     return window.innerWidth;
        // } else
          return document.documentElement.clientWidth;
      };

      var GetViewportHeight = () => {
        // if (UserAgentIsAndroid()) {
        //   if (document.fullscreenElement) // chrome android weirdness
        //     return screen.height;
        //   else
        //     return window.innerHeight;
        // } else
          return document.documentElement.clientHeight;
      };

window.ChangeResolution = (x, y) => {
        if (Module['calledRun']) {
          if (typeof x === 'undefined')
            x = GetViewportWidth();
          if (typeof y === 'undefined')
            y = GetViewportHeight();
          Module.ccall('change_resolution',
            'number',
            ['number', 'number'],
            [x, y]
          );
        }
      };

async function startGame() {
    Module.arguments = [];
    Module.noInitialRun = true;
    Module.print = console.log;
    Module.printErrr = console.error;
    Module.canvas = gameCanvas;
    Module.onRuntimeInitialized = initGame;
    try{
        await loadScript();
    }catch(e){
        window.alert("Error loading the game, look in the console for full error. \n"+e);
        console.error("SRB2 Load error: ",e);
        return;
    }
}
