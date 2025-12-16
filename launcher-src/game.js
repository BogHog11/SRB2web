var elements = require("./gp2/elements.js");
if (window["Module"]) {
    var Module = window["Module"];
}
var IDBFS = null;
var gameCanvas = elements.getGPId("gameCanvas");
var didStart = false;
var loaderContent = elements.getGPId("loaderContent");
function loadScript () {
    return new Promise((resolve,reject) => {
        loaderContent.textContent = "Loading game script...";
        var script = document.createElement("script");
        script.src = "srb2.js";
        script.onload = resolve;
        script.onerror = reject;
        document.body.append(script);
    });
}

var CACHE_NAME = 'srb2-assets-v1';
async function downloadAndSaveAssets() {
    const assetList = [
        { url: "assets/characters.pk3", filename: "characters.pk3" },
        { url: "assets/music.pk3", filename: "music.pk3" },
        { url: "assets/srb2.pk3", filename: "srb2.pk3" },
        { url: "assets/zones.pk3", filename: "zones.pk3" } // If you have it
    ];    
    // 1. Open the browser's cache storage
    const cache = await caches.open(CACHE_NAME);

    for (const asset of assetList) {
        console.log(`Checking storage for ${asset.filename}...`);
        
        // 2. Check if we already have the file in cache
        let response = await cache.match(asset.url);

        if (response) {
            // HIT: We found it!
            console.log(`[CACHE HIT] Loading ${asset.filename} from disk.`);
            loaderContent.textContent = `Loading ${asset.filename} from cache...`;
        } else {
            // MISS: We need to download it
            console.log(`[CACHE MISS] Downloading ${asset.filename} from internet...`);
            loaderContent.textContent = `Downloading ${asset.filename}...`;

            try {
                // --- NEW CODE START ---
                
                // 1. Manually fetch the file first to check for errors
                console.log(`[NETWORK] Fetching ${asset.url}...`);
                const request = new Request(asset.url);
                const networkResponse = await fetch(request);

                // 2. Check for 404s or Server Errors
                if (!networkResponse.ok) {
                    throw new Error(`Server returned ${networkResponse.status} ${networkResponse.statusText} for file: ${asset.url}`);
                }

                // 3. Put the successful response into the cache
                // We must clone() it because the response body can only be read once
                await cache.put(request, networkResponse.clone());

                // 4. Use the network response immediately so we don't have to look it up again
                response = networkResponse;
                
                // --- NEW CODE END ---

            } catch (err) {
                console.error(`FATAL ERROR: Could not load ${asset.url}`);
                // Update the loading screen so you can see it without opening console
                loaderContent.textContent = `ERROR: ${err.message}`;
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

    await downloadAndSaveAssets();

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
          return Math.round(document.documentElement.clientWidth);
      };

      var GetViewportHeight = () => {
          return Math.round(document.documentElement.clientHeight);
      };

window.ChangeResolution = (x, y) => {
    if (Module['calledRun']) {
          if (typeof x === 'undefined')
            x = GetViewportWidth();
          if (typeof y === 'undefined')
            y = GetViewportHeight();
        gameCanvas.width = x;
        gameCanvas.height = y;
          Module.ccall('change_resolution',
            'number',
            ['number', 'number'],
            [x, y]
          );
        }
};

async function startGame() {
    Module.arguments = ["-mb", "250", "+drawdist", "2048", "+addons_option", "CUSTOM"];
    Module.noInitialRun = true;
    Module.print = console.log;
    Module.printErrr = console.error;
    Module.canvas = gameCanvas;
    Module.onRuntimeInitialized = initGame;
    Module.WebNet = {
        Init: function() {
            window.alert("Network initialized from Main JS!");
            return 1;
        },
        OpenSocket: function() {
            window.alert("Socket Open requested.");
            return 1;
        },
        Connect: function(address) {
            window.alert("Game trying to connect to: " + address);
            // You can put real WebSocket logic here later!
            return 1;
        },
        SendPacket: function(ptr, length) {
            // console.log("Sending " + length + " bytes...");
            return 1;
        },
        GetPacket: function(ptr, maxlen) {
            return 0; // No data received
        }
    };
    try{
        await loadScript();
    }catch(e){
        window.alert("Error loading the game, look in the console for full error. \n"+e);
        console.error("SRB2 Load error: ",e);
        return;
    }
}

window.StartedMainLoopCallback = function () {
    didStart = true;
    gameCanvas.hidden = false;
    window.ChangeResolution();
};

window.addEventListener("resize", () => {
    window.ChangeResolution();
});

module.exports = {startGame};