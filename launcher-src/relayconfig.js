var elements = require("./gp2/elements.js");
var dialog = require("./dialog.js");
var relayConfig = elements.getGPId("relayConfig");
var lstorageName = "SRB2WebRelayConfig";
var RelayOption = require("./relayoption.js");

var relays = [];
var relayOpts = [];

var usedRelay = 0;
var defaultRelays = [
  {
    host: "srb2web-relay1.onrender.com",
    name: "Public relay",
  },
  {
    host: "rczylh-3000.csb.app",
    name: "Debug relay server",
  },
];

function saveRelays() {
  var savedRelays = relayOpts.map((r) => r.save());
  localStorage.setItem(
    lstorageName,
    JSON.stringify({
      relays: savedRelays,
      used: usedRelay,
    })
  );
}

function reloadRelayConfig() {
  relayOpts.forEach((r) => {
    r.dispose();
  });
  relayOpts = [];
  relays.forEach((relay, i) => {
    var opt = new RelayOption(relay, saveRelays, () => {});
    relayConfig.append(opt.div);
    relayOpts.push(opt);
  });
}

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
