var elements = require("./gp2/elements.js");
if (window["Module"]) {
  var Module = window["Module"];
}
var dialog = require("./dialog.js");
var IDBFS = null;
var gameCanvas = elements.getGPId("gameCanvas");
var didStart = false;
var loaderContent = elements.getGPId("loaderContent");
var serverOpts = null;
var launcherMain = elements.getGPId("launcherMain");
var loaderMain = elements.getGPId("loaderMain");

async function keepAlive() {
  if (navigator.requestWakeLock) {
    await navigator.requestWakeLock("screen");
  }

  if (navigator.locks) {
    navigator.locks.request(
      "srb2_game_running",
      { mode: "exclusive" },
      async () => {
        await new Promise((resolve) => {});
      },
    );
  }

  startAudioKeepAlive();
}

function startAudioKeepAlive() {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = 0.0001; // Inaudible
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
}

function enableStartServer(dedicated = false) {
  serverOpts = {
    dedicated: !!dedicated,
  };
}

function disableStartServer() {
  serverOpts = null;
}

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
    //console.log(`Checking storage for ${asset.filename}...`);

    // 2. Check if we already have the file in cache
    let response = await cache.match(asset.url);

    if (response) {
      // HIT: We found it!
      //console.log(`[CACHE HIT] Loading ${asset.filename} from disk.`);
      loaderContent.textContent = `Loading ${asset.filename} from cache...`;
    } else {
      // MISS: We need to download it
      //console.log(
      //  `[CACHE MISS] Downloading ${asset.filename} from internet...`,
      //);
      loaderContent.textContent = `Downloading ${asset.filename}... (This may take a few minutes on first load!)`;

      try {
        // --- NEW CODE START ---

        // 1. Manually fetch the file first to check for errors
        //console.log(`[NETWORK] Fetching ${asset.url}...`);
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

const RUNNING_CHECK_NAME = "srb2web_running_check";

async function initGame() {
  IDBFS = FS.filesystems.IDBFS;

  await downloadAndSaveAssets();

  loaderContent.textContent = "SRB2 is starting...";

  keepAlive(); // Try to keep the screen awake while playing

  FS.mkdirTree("/addons");
  FS.symlink("/home/web_user/.srb2", "/addons/.srb2");
  FS.symlink("/home/web_user/.srb2", "/addons/userdata");
  FS.mount(IDBFS, {}, "/home/web_user");
  FS.syncfs(true, (err) => {
    //console.log("SyncFS done");
    //console.log(err);
    Module.callMain(["-home", "/home/web_user"].concat(Module.arguments));
  });
  var isSyncing = false;
  setInterval(() => {
    if (!isSyncing) {
      isSyncing = true;
      FS.syncfs(false, (err) => {
        isSyncing = false;
      });
    }
    localStorage.setItem(RUNNING_CHECK_NAME, Date.now());
  }, 100);
}

var GetViewportWidth = () => {
  return Math.round(document.documentElement.clientWidth);
};

var GetViewportHeight = () => {
  return Math.round(document.documentElement.clientHeight);
};

function getTargetSize(x, y) {
  // Use devicePixelRatio to fix the "tiny box in the corner" issue
  const dpr = window.devicePixelRatio || 1;
  const targetX = Math.floor((x || GetViewportWidth()) * dpr);
  const targetY = Math.floor((y || GetViewportHeight()) * dpr);

  gameCanvas.width = targetX;
  gameCanvas.height = targetY;

  // Match the CSS size to the viewport size
  gameCanvas.style.width = targetX / dpr + "px";
  gameCanvas.style.height = targetY / dpr + "px";

  return { targetX, targetY };
}

window.ChangeResolution = (x, y) => {
  if (didStart) {
    if (typeof x === "undefined") x = GetViewportWidth();
    if (typeof y === "undefined") y = GetViewportHeight();
    gameCanvas.width = x;
    gameCanvas.height = y;
    gameCanvas.style.width = x + "px";
    gameCanvas.style.height = y + "px";
    Module.ccall("change_resolution", "number", ["number", "number"], [x, y]);
  }
};

async function startGame(options = {}) {
  loaderMain.hidden = false;
  launcherMain.hidden = true;
  var { targetX, targetY } = getTargetSize();

  Module.arguments = [
    /*'-width',
    ""+targetX,
    '-height',
    ""+targetY*/
  ];
  if (serverOpts) {
    Module.arguments.push("-server");
    if (serverOpts.dedicated) {
      Module.arguments.push("-dedicated");
    }
  }
  if (options) {
    if (options.host) {
      Module.arguments.push("-server");
    }
    if (options.joinURL) {
      Module.arguments.push("-connect");
      Module.arguments.push(options.joinURL);
    }
  }
  /*Module.arguments.push("-mb");
  Module.arguments.push("250");
  Module.arguments.push("+drawdist");
  Module.arguments.push("2048");
  Module.arguments.push("+addons_option");
  Module.arguments.push("CUSTOM");*/

  Module.noInitialRun = true;
  Module.print = () => {};
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
    dialog.alert(
      "Error loading the game, look in the console for full error. \n" + e,
    );
    console.error("SRB2 Load error: ", e);
    return;
  }
}

window.StartedMainLoopCallback = function () {
  didStart = true;
  gameCanvas.hidden = false;
  window.ChangeResolution();

  // Add click listener after canvas is shown
  gameCanvas.addEventListener("click", () => {
    //console.log("Canvas clicked, locking mouse");
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
          //console.log("AudioContext resumed!");
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
      ip: "152.26.89.206:5029",
      name: "Classic Co-op Adventure",
      version: "2.2.13",
      players: 2,
      max_players: 8,
      gametype: GT_COOP,
    },
  ];
}

// ----------------------------------------------------
// THE CRITICAL FUNCTION CALLED BY C
// ----------------------------------------------------
window.SRB2RequestServerList = function () {
  //dialog.alert("JS: C code requested server list...");

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
var mouseMoveX = 0;
var mouseMoveY = 0;
setInterval(() => {
  if (didStart) {
    Module.ccall(
      "SRB2_AddMouseDelta",
      "void",
      ["number", "number"],
      [mouseMoveX, mouseMoveY],
    );
    mouseMoveX = 0;
    mouseMoveY = 0;
  }
}, 1000 / 55);
gameCanvas.addEventListener(
  "mousemove",
  (e) => {
    if (document.pointerLockElement === gameCanvas) {
      mouseMoveX += e.movementX;
      mouseMoveY += e.movementY;
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

const wakeupWorker = new Worker(
  URL.createObjectURL(
    new Blob(
      [
        `
  setInterval(() => {
    self.postMessage('ping');
  }, 15); // Send a message every 15ms
`,
      ],
      { type: "text/javascript" },
    ),
  ),
);

wakeupWorker.onmessage = () => {
  //Empty so it keeps tab alive.
};

//Intentional debug logic, keep the if so it can be turned on and off.
if (false) {
  window.addEventListener("keydown", (e) => {
    if (e.key === "q") {
      var gl =
        gameCanvas.getContext("webgl2") || gameCanvas.getContext("webgl");
      window.alert(gl.getError());
    }
  });
}

module.exports = { startGame, enableStartServer, disableStartServer };
