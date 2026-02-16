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

function closePublicList() {
  publicNetgameBrowserContainer.hidden = true;
}

function getCloseButton() {
  return {
    element: "div",
    className: "button publicNetgameBrowserCloseButton",
    textContent: "Close",
    onclick: closePublicList
  };
}

function getHostButton(hostClicked) {
  return {
      element: "div",
      className: "publicNetgameItem",
      onclick: hostClicked,
      children: [
        {
          element: "div",
          style: {display: "flex", fontSize: "32px", alignItems: "center", justifyContent: "center"},
          children: [
            {
              element: "img",
              src: "images/host.svg",
              className: "refreshIcon"
            },
            "Host public"
          ]
        }
      ]
    };
}

function getReloadButton(reload) {
  return {
      element: "div",
      className: "publicNetgameItem",
      onclick: reload,
      children: [
        {
          element: "div",
          style: {display: "flex", fontSize: "32px", alignItems: "center", justifyContent: "center"},
          children: [
            {
              element: "img",
              src: "images/refresh.svg",
              className: "refreshIcon"
            },
            "Refresh"
          ]
        }
      ]
    };
}

function gameToButton(game, selectedURL, onClick) {
  return {
    element: "div",
    className: "publicNetgameItem",
    onclick: onClick,
    children: [
      {
        element: "div",
        style: {
          display: "flex",
          alignItems: "center",
          gap: "2px"
        },
        children: [
          {
            element: "img",
            className: "netgameCommunicationType",
            src: game.usesWebRTC ? "images/webrtc.svg" : "images/websocket.svg"
          },
          {
            element: "span",
            className: "netgameServerName",
            textContent: game.name
          },
        ]
      },
      {
        element: "span",
        className: "netgameServerURL",
        textContent: game.url
      },
    ]
  };
}

var { startGame } = require("./game.js");

async function launchToNetgame(game) {
  var confirmed = await dialog.confirm(`Launch game to join ${game.name}?`);
  if (!confirmed) return;

  closePublicList();
  startGame({
    joinURL: game.url
  });
}

async function launchToHost() {
  var confirmed = await dialog.confirm(`Launch game to host publicly?`);
  if (!confirmed) return;

  var autoStart = await dialog.confirm(`Skip multiplayer menu?`);

  closePublicList();
  if (autoStart) {
    startGame({
      host: true
    });
  } else {
    startGame();
  }
}

function displayPublicGames(games, selectedURL){
  publicNetgameBrowser.hidden = false;
  elements.setInnerJSON(publicNetgameBrowserLeft, [
    getReloadButton(loadPublicList),
    getHostButton(launchToHost),
    {
      element: "div",
      className: "publicGameSeparator",
    }
  ].concat(games.map((game) => {
    return gameToButton(game, selectedURL, () => {
      displayPublicGames(games, game.url, () => launchToNetgame(game));
    });
  })));


  var game = games.find((g) => selectedURL == g.url);
  
  if (!game) {
    elements.setInnerJSON(publicNetgameBrowserRight, [
      {
        element: "span",
        className: "viewPublicNetgameDetails",
        textContent: "Click on a netgame to view it's details"
      },
      getCloseButton()
    ]);

    return;
  }

  elements.setInnerJSON(publicNetgameBrowserRight, [
    {
      element: "div",
      className: "publicNetgameDetails",
      children: [
        {
          element: "span",
          className: "netgameServerName",
          textContent: game.name
        },
        {
          element: "br"
        },
        {
          element: "span",
          className: "netgameServerURL",
          textContent: game.url
        },
        {
          element: "div",
          className: "publicGameSeparator"
        },
        {
          element: "br"
        },
        {
          element: "li",
          children: [
            {
              element: "ri",
              textContent: game.mapTitle ? "Map Title: "+game.mapTitle : "(No map title)"
            },
          ]
        },
        {
          element: "li",
          children: [
            {
              element: "ri",
              textContent: game.map ? "Map: "+game.map : "(No map)"
            },
          ]
        },

        {
          element: "br"
        },
        {
          element: "div",
          className: "publicGameSeparator"
        },
        {
          element: "span",
          textContent: "Players: "+game.ingamePlayers
        },
        game.playerNames.map((name) => {
          return {
            element: "li",
            textContent: name
          };
        })
      ]
    },
    getCloseButton(),
  ]);

}

async function loadPublicList() {
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
}

browsePublicGames.addEventListener("click", async () => {
  if (!relayEnabled) {
    dialog.alert("You don't have the relay server enabled!");
  }
  if (usedRelay < 0) {
    dialog.alert("You don't have a relay server selected");
  }

  loadPublicList();
});