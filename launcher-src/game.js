var elements = require("./gp2/elements.js");
if (window["Module"]) {
  var Module = window["Module"];
}
var IDBFS = null;
var gameCanvas = elements.getGPId("gameCanvas");
var didStart = false;
var loaderContent = elements.getGPId("loaderContent");
function loadScript() {
  return new Promise((resolve, reject) => {
    loaderContent.textContent = "Loading game script...";
    var script = document.createElement("script");
    script.src = "srb2.js";
    script.onload = resolve;
    script.onerror = reject;
    document.body.append(script);
  });
}

(function () {
  // 1. Create a Worker that ticks 60 times/sec (16ms)
  // This runs in a separate thread that Chrome does NOT throttle.
  const workerScript = `
        let intervalId = null;
        self.onmessage = function(e) {
            if (e.data === 'start') {
                if (intervalId) clearInterval(intervalId);
                intervalId = setInterval(() => {
                    self.postMessage('tick');
                }, 16); 
            } else if (e.data === 'stop') {
                if (intervalId) clearInterval(intervalId);
                intervalId = null;
            }
        };
    `;
  const blob = new Blob([workerScript], { type: "application/javascript" });
  const worker = new Worker(URL.createObjectURL(blob));

  const nativeRequestAnimationFrame = window.requestAnimationFrame;
  let callbackQueue = [];
  let isHidden = false;

  // 2. Detect when tab is hidden
  document.addEventListener("visibilitychange", () => {
    isHidden = document.hidden;
    console.log(
      "[Anti-Freeze] Visibility:",
      isHidden ? "HIDDEN (Worker taking over)" : "VISIBLE (Native)",
    );

    if (isHidden) {
      worker.postMessage("start"); // Start the background ticker
    } else {
      worker.postMessage("stop"); // Stop the background ticker
    }
  });

  // 3. When the worker ticks, FORCE the main thread to run the game loop
  worker.onmessage = function (e) {
    if (e.data === "tick" && isHidden) {
      // Run all queued game updates immediately
      const toRun = callbackQueue;
      callbackQueue = [];
      toRun.forEach((cb) => cb(performance.now()));
    }
  };

  // 4. Hijack requestAnimationFrame
  // This effectively tricks Emscripten into using our Worker instead of the Browser's timer
  window.requestAnimationFrame = function (callback) {
    if (isHidden) {
      callbackQueue.push(callback);
      return callbackQueue.length;
    } else {
      return nativeRequestAnimationFrame(callback);
    }
  };
})();

var CACHE_NAME = "srb2-assets-v1";
async function downloadAndSaveAssets() {
  const assetList = [
    { url: "assets/characters.pk3", filename: "characters.pk3" },
    { url: "assets/music.pk3", filename: "music.pk3" },
    { url: "assets/srb2.pk3", filename: "srb2.pk3" },
    { url: "assets/zones.pk3", filename: "zones.pk3" }, // If you have it
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
      console.log(
        `[CACHE MISS] Downloading ${asset.filename} from internet...`,
      );
      loaderContent.textContent = `Downloading ${asset.filename}...`;

      try {
        // --- NEW CODE START ---

        // 1. Manually fetch the file first to check for errors
        console.log(`[NETWORK] Fetching ${asset.url}...`);
        const request = new Request(asset.url);
        const networkResponse = await fetch(request);

        // 2. Check for 404s or Server Errors
        if (!networkResponse.ok) {
          throw new Error(
            `Server returned ${networkResponse.status} ${networkResponse.statusText} for file: ${asset.url}`,
          );
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

  FS.mkdirTree("/addons");
  FS.symlink("/home/web_user/.srb2", "/addons/.srb2");
  FS.symlink("/home/web_user/.srb2", "/addons/userdata");
  FS.mount(IDBFS, {}, "/home/web_user");
  FS.syncfs(true, (err) => {
    console.log("SyncFS done");
    console.log(err);
    Module.callMain(["-home", "/home/web_user"]);
  });
  setInterval(() => {
    FS.syncfs(false, (err) => {});
  }, 100);
}

var GetViewportWidth = () => {
  return Math.round(document.documentElement.clientWidth);
};

var GetViewportHeight = () => {
  return Math.round(document.documentElement.clientHeight);
};

window.ChangeResolution = (x, y) => {
  if (Module["calledRun"]) {
    if (typeof x === "undefined") x = GetViewportWidth();
    if (typeof y === "undefined") y = GetViewportHeight();
    gameCanvas.width = x;
    gameCanvas.height = y;
    gameCanvas.style.width = x + "px";
    gameCanvas.style.height = y + "px";
    Module.ccall("change_resolution", "number", ["number", "number"], [x, y]);
  }
};

async function startGame() {
  Module.arguments = [
    "-mb",
    "250",
    "+drawdist",
    "2048",
    "+addons_option",
    "CUSTOM",
  ];
  Module.noInitialRun = true;
  Module.print = console.log;
  Module.printErrr = console.error;
  Module.canvas = gameCanvas;
  Module.onRuntimeInitialized = initGame;
  Module.pauseOnVisibilityChange = false;
  Module.onExit = function () {
    window.location.reload();
  };

  try {
    await loadScript();
  } catch (e) {
    window.alert(
      "Error loading the game, look in the console for full error. \n" + e,
    );
    console.error("SRB2 Load error: ", e);
    return;
  }
}

window.StartedMainLoopCallback = function () {
  didStart = true;
  gameCanvas.hidden = false;
  setTimeout(() => {
    window.ChangeResolution();
  }, 10);

  // Add click listener after canvas is shown
  gameCanvas.addEventListener("click", () => {
    console.log("Canvas clicked, locking mouse");
    window.LockMouse();
  });

  // Add mousemove listener for manual mouse delta handling
  document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === gameCanvas) {
      Module.ccall(
        "SRB2_AddMouseDelta",
        "void",
        ["number", "number"],
        [Math.round(e.movementX), Math.round(e.movementY)],
      );
    }
  });

  function resumeAudio() {
    // SDL2 creates an AudioContext on the Module
    if (Module.SDL2 && Module.SDL2.audioContext) {
      if (Module.SDL2.audioContext.state === "suspended") {
        Module.SDL2.audioContext.resume().then(() => {
          console.log("AudioContext resumed!");
        });
      }
    }

    // Also try the standard web audio context just in case
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      // If there's a global context hidden somewhere
    }
  }

  // Try to resume immediately (will likely fail, but worth a shot)
  resumeAudio();
};

window.addEventListener("resize", () => {
  window.ChangeResolution();
});
// SRB2 Gametype Constants
const GT_COOP = 0;
const GT_COMPETITION = 1;
const GT_RACE = 2;
const GT_MATCH = 3;
const GT_TAG = 4;
const GT_CTF = 5;

// Mock Server Fetch
async function fetchMS() {
  return [
    {
      ip: "192.168.1.10:5029",
      name: "Classic Co-op Adventure",
      version: "2.2.13",
      players: 2,
      max_players: 8,
      gametype: GT_COOP,
    },
    {
      ip: "192.168.1.11:5029",
      name: "Monday Night Race",
      version: "2.2.13",
      players: 6,
      max_players: 12,
      gametype: GT_RACE,
    },
    {
      ip: "192.168.1.12:5029",
      name: "CTF Chaos",
      version: "2.2.13",
      players: 8,
      max_players: 16,
      gametype: GT_CTF,
    },
  ];
}

// ----------------------------------------------------
// THE CRITICAL FUNCTION CALLED BY C
// ----------------------------------------------------
Module.fetchServerList = function () {
  window.alert("JS: C code requested server list...");

  // 1. Clear the old list in C
  try {
    Module.ccall("SRB2_ClearServerList", "void", [], []);
  } catch (e) {
    console.error("Could not clear list:", e);
  }

  // 2. Fetch and Populate
  fetchMS()
    .then((data) => {
      data.forEach((server) => {
        Module.ccall(
          "SRB2_AddServerToList",
          "void",
          [
            "string",
            "string",
            "string",
            "number",
            "number",
            "number",
            "number",
          ],
          [
            server.ip,
            server.name,
            server.version,
            server.players,
            server.max_players,
            100,
            server.gametype,
          ],
        );
      });

      // 3. Tell C we are done
      Module.ccall("SRB2_FinishServerList", "void", [], []);
    })
    .catch((err) => {
      console.error("JS: Error fetching servers:", err);
    });
};

var LockMouse = () => {
  if (didStart) {
    Module.ccall("lock_mouse", null, [], []);
    gameCanvas.focus();
    if (gameCanvas.requestPointerLock) {
      try {
        gameCanvas.requestPointerLock().catch((e) => {});
      } catch (e) {
        console.warn("Mouse lock request failed: ", e);
      }
    }
  }
};
window.LockMouse = LockMouse;

var UnlockMouse = (force = false) => {
  if (didStart) {
    if (force && document.pointerLockElement)
      document.exitPointerLock(); // this method should fire again, so don't unlock_mouse right now
    else if (!document.pointerLockElement)
      Module.ccall("unlock_mouse", null, [], []);
  }
};
window.UnlockMouse = UnlockMouse;

var CaptureFullscreenKey = (e) => {
  // Let F11 do fullscreen
  if (e instanceof KeyboardEvent && e.key === "F11") e.stopPropagation();
};

window.addEventListener("mousedown", LockMouse, false);
document.addEventListener("pointerlockchange", (_) => UnlockMouse(), false);
document.addEventListener(
  "mousedown",
  (e) => {
    if (document.pointerLockElement === gameCanvas) {
      Module.ccall("mouse_button_down", "void", ["number"], [e.button]);
      e.preventDefault();
    }
  },
  true,
);
document.addEventListener(
  "mouseup",
  (e) => {
    if (document.pointerLockElement === gameCanvas) {
      Module.ccall("mouse_button_up", "void", ["number"], [e.button]);
      e.preventDefault();
    }
  },
  true,
);
document.addEventListener(
  "wheel",
  (e) => {
    if (document.pointerLockElement === gameCanvas) {
      Module.ccall(
        "mouse_wheel_xy",
        "void",
        ["number", "number"],
        [Math.round(e.deltaX), Math.round(e.deltaY)],
      );
      e.preventDefault();
    }
  },
  true,
);
gameCanvas.addEventListener(
  "mousemove",
  (e) => {
    if (document.pointerLockElement === gameCanvas) {
      Module.ccall(
        "SRB2_AddMouseDelta",
        "void",
        ["number", "number"],
        [e.movementX, e.movementY],
      );
      e.preventDefault();
    }
  },
  true,
);
window.addEventListener(
  "load",
  (_) => {
    document.addEventListener("keydown", CaptureFullscreenKey, true);
    document.addEventListener("keyup", CaptureFullscreenKey, true);
    document.addEventListener("keypress", CaptureFullscreenKey, true);
  },
  { once: true },
);

module.exports = { startGame };
