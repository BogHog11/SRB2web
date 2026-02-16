var elements = require("./gp2/elements.js");
var dialog = require("./dialog.js");
var relayConfig = elements.getGPId("relayConfig");
var relayServerCheckbox = elements.getGPId("relayServerCheckbox");
var webrtcHostCheckbox = elements.getGPId("webrtcHostCheckbox");
var lstorageName = "SRB2WebRelayConfig";
var RelayOption = require("./relayoption.js");
var net = require("./net");

var relays = [];
var relayOpts = [];

var usedRelay = 0;
var relayEnabled = true;
var webrtcHostEnabled = true;
var defaultRelays = [
  {
    host: "srb2web-relay1.onrender.com",
    name: "Public relay",
  },
];

function saveRelays() {
  relays = relayOpts.map((r) => r.save());
  localStorage.setItem(
    lstorageName,
    JSON.stringify({
      relays,
      used: usedRelay,
      enabled: relayEnabled,
      webrtc: webrtcHostEnabled,
    }),
  );
}

var currentHost = null;

function updateRelayUsed() {
  relayOpts.forEach((r, i) => {
    r.setUsed(usedRelay == i);
    if (usedRelay == i) {
      currentHost = r.relay.host;
    }
  });
  if (relayEnabled) {
    net.disable();
    net.enable(currentHost);
  } else {
    net.disable();
  }
  if (webrtcHostEnabled) {
    net.enableServerWebRTC();
  } else {
    net.disableServerWebRTC();
  }
}

var addRelayButton = elements.getGPId("addRelayButton");

addRelayButton.onclick = async function () {
  var relay = await RelayOption.relayAddDialog();
  if (!relay) {
    return;
  }
  if (relays.find((r) => r.host == relay.host)) {
    dialog.alert("This relay server was already added!");
    return;
  }
  relays.push(relay);
  reloadRelayConfig();
  saveRelays();
};

function reloadRelayConfig() {
  elements.setInnerJSON(relayConfig, []);
  relayOpts.forEach((r) => {
    r.dispose();
  });
  relayOpts = [];
  relays.forEach((relay, i) => {
    var opt = new RelayOption(
      relay,
      saveRelays,
      () => {
        //Use button clicked.
        usedRelay = i;
        updateRelayUsed();
        saveRelays();
      },
      () => {
        //Remove accepted.
        relayOpts = relayOpts.filter((r) => r.relay.host !== relay.host);
        opt.dispose();
        saveRelays();
        reloadRelayConfig();
      },
    );
    relayConfig.append(opt.div);
    relayOpts.push(opt);
  });
  updateRelayUsed();
  if (usedRelay > relayOpts.length - 1) {
    usedRelay = relayOpts.length - 1;
    updateRelayUsed();
    saveRelays();
  }

  relayServerCheckbox.checked = relayEnabled;
  webrtcHostCheckbox.checked = webrtcHostEnabled;

  if (relayOpts.length == 0) {
    elements.setInnerJSON(relayConfig, [
      {
        element: "div",
        className: "noRelayContainer",
        children: [
          {
            element: "div",
            className: "noRelayText",
            textContent: "No relay servers!",
          },
        ],
      },
    ]);
  }
}

relayServerCheckbox.onchange = function () {
  relayEnabled = relayServerCheckbox.checked;
  saveRelays();
  reloadRelayConfig();
};

webrtcHostCheckbox.onchange = async function () {
  if (!webrtcHostCheckbox.checked) {
    var confirm = await dialog.confirm(
      "Disabling WebRTC hosting will cause your hosted games to have slower connections and more input lag. Are you sure you want to disable it?",
    );
    if (!confirm) {
      webrtcHostCheckbox.checked = true;
      return;
    }
  }
  webrtcHostEnabled = webrtcHostCheckbox.checked;
  saveRelays();
  reloadRelayConfig();
};

setInterval(() => {
  relayOpts.forEach((r) => {
    r.fetchStatus();
  });
}, 5000);

var storedConfig = localStorage.getItem(lstorageName);
if (storedConfig) {
  try {
    var json = JSON.parse(storedConfig);
    usedRelay = json.used;
    relays = json.relays;
    relayEnabled = json.enabled;
    webrtcHostEnabled = json.webrtc;
  } catch (e) {
    relays = Array.from(defaultRelays);
    dialog.alert(
      `Unable to load your relay configuration, it may have been corrupted.`,
    );
    console.error(e);
  }
} else {
  relays = Array.from(defaultRelays);
}

reloadRelayConfig();

net.enablePublic();




var browsePublicGames = elements.getGPId("browsePublicGames");
var publicNetgameBrowserContainer = elements.getGPId("publicNetgameBrowserContainer");
var publicNetgameBrowser = elements.getGPId("publicNetgameBrowser");
var publicNetgameBrowserLeft = elements.getGPId("publicNetgameBrowserLeft");
var publicNetgameBrowserRight = elements.getGPId("publicNetgameBrowserRight");



function displayPublicGames(games){
  publicNetgameBrowser.hidden = false;
  elements.setInnerJSON(publicNetgameBrowserLeft, []);
}

browsePublicGames.addEventListener("click", async () => {
  if (!relayEnabled) {
    dialog.alert("You don't have the relay server enabled!");
  }
  if (usedRelay < 0) {
    dialog.alert("You don't have a relay server selected");
  }

  publicNetgameBrowserContainer.hidden = false;
  publicNetgameBrowser.hidden = true;
  try{
    var games = await net.listPublicGames();
  }catch(e){
    dialog.alert("Failed to fetch public hosted games. Make sure your selected relay server is working and try again.");
    console.error(e);
    publicNetgameBrowserContainer.hidden = true;
    return;
  }

  displayPublicGames(games);
});