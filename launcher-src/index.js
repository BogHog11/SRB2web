var elements = require("./gp2/elements.js");
elements.appendElementsFromJSON(document.body, require("./elms.js"));

var gameCanvas = elements.getGPId("gameCanvas");
var launcherMain = elements.getGPId("launcherMain");
var loaderMain = elements.getGPId("loaderMain");

gameCanvas.hidden = true;
loaderMain.hidden = true;
launcherMain.hidden = false;

var playButton = elements.getGPId("playButton");
var { startGame } = require("./game.js");

playButton.addEventListener("click", function () {
  loaderMain.hidden = false;
  launcherMain.hidden = true;
  startGame();
});

var relay = require("./net");
var relayURL = "wss://hys8ss-3000.csb.app/";
var relayConnect = new relay.SRB2Relay(relayURL);
