var elements = require("./gp2/elements.js");
var Module = window["Module"];
function loadScript () {
    return new Promise((resolve,reject) => {
        var script = document.createElement("script");
        script.src = "srb2.js";
        script.onload = resolve;
        script.onerror = reject;
    });
}

async function startGame() {
    Module.arguments = [];
    try{
        await loadScript();
    }catch(e){
        window.alert("Error loading the game, look in the console for full error. \n"+e);
        console.error("SRB2 Load error: ",e);
    }
}
