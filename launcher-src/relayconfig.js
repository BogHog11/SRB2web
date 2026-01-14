var elements = require("./gp2/elements.js");
var relayConfig = elements.getGPId("relayConfig");
var lstorageName = "SRB2WebRelayConfig";

var relays = [];

class RelayOption {
  constructor() {}
}

var defaultRelays = [
  {
    host: "rczylh-3000.csb.app",
    name: "Debug relay server",
  },
];

if (localStorage.getItem("relayConfig")) {
}
