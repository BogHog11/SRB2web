var elements = require("./gp2/elements.js");
var dialog = require("./dialog.js");
var relayConfig = elements.getGPId("relayConfig");
var lstorageName = "SRB2WebRelayConfig";
var RelayOption = require("./relayoption.js");
var net = require("./net");

var relays = [];
var relayOpts = [];

var usedRelay = 0;
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
    })
  );
}

function updateRelayUsed() {
  net.disable();
  relayOpts.forEach((r, i) => {
    r.setUsed(usedRelay == i);
    if (usedRelay == i) {
      net.enable(r.relay.host);
    }
  });
}

var addRelayButton = elements.getGPId("addRelayButton");

addRelayButton.onclick = async function () {
  var relay = await RelayOption.relayAddDialog();
  if (!relay) {
    return;
  }
  relays.push(relay);
  reloadRelayConfig();
  saveRelays();
};

function reloadRelayConfig() {
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
      }
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
}

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
  } catch (e) {
    relays = Array.from(defaultRelays);
    dialog.alert(
      `Unable to load your relay configuration, it may have been corrupted.`
    );
    console.error(e);
  }
} else {
  relays = Array.from(defaultRelays);
}

reloadRelayConfig();
