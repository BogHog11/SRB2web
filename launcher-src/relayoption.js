var elements = require("./gp2/elements.js");

class RelayOption {
  static FETCHING_IMG = "images/gray.png";
  static FETCHING_TEXT = "Loading...";

  static ONLINE_IMG = "images/green.png";
  static ONLINE_TEXT = "Online!";

  static OFFLINE_IMG = "images/red.png";
  static OFFLINE_TEXT = "Offline.";

  constructor(relay, requestSave, requestSetUsed) {
    this.relay = relay;
    this.requestSave = requestSave;
    this.requestSetUsed = requestSetUsed;
    this.firstFetch = true;
    this.loadOption();
    this.createElements();
    this.updateContents();
    this.fetchStatus();
  }
  setUsed(u) {
    var { relayUseButton } = this;
    if (u) {
      this.div.setAttribute("used", "");
      relayUseButton.textContent = "Using this server";
    } else {
      this.div.removeAttribute("used");
      relayUseButton.textContent = "Use this server";
    }
  }
  dispose() {
    this.relay = null;
    this.div.remove();
  }
  loadOption() {
    this.name = this.relay.name ? this.relay.name : "";
    this.host = this.relay.host;
  }
  createElements() {
    var _this = this;
    this.div = elements.createElementsFromJSON([
      {
        element: "div",
        className: "configuredRelay",
        children: [
          //Name and stuff.
          {
            element: "div",
            style: {
              display: "flex",
              alignItems: "center",
              gap: "10px",
            },
            children: [
              {
                element: "div",
                className: "relayStatus",
                children: [
                  {
                    element: "img",
                    src: RelayOption.FETCHING_IMG,
                    className: "relayStatusImg",
                    GPWhenCreated: (elm) => (_this.statusImg = elm),
                  },
                  {
                    element: "span",
                    className: "relayStatusText",
                    GPWhenCreated: (elm) => (_this.statusText = elm),
                  },
                ],
              },
              {
                element: "span",
                className: "relayName",
                GPWhenCreated: (elm) => (_this.relayNameSpan = elm),
              },
              {
                element: "span",
                className: "relayHost",
                GPWhenCreated: (elm) => (_this.relayHostSpan = elm),
              },
            ],
          },
          //Description
          {
            element: "span",
            className: "relayDescription",
            GPWhenCreated: (elm) => (_this.relayDescriptionSpan = elm),
          },
          //Buttons
          {
            element: "div",
            className: "relayButtons",
            children: [
              {
                element: "button",
                className: "button",
                textContent: "Use this server",
                GPWhenCreated: (elm) => (_this.relayUseButton = elm),
              },
            ],
          },
        ],
      },
    ])[0];

    function copyHostText() {
      var elm = this;
      var previous = elm.textContent;
      elm.textContent = "Copied!";
      setTimeout(() => {
        elm.textContent = previous;
        elm.onclick = copyHostText;
      }, 1000);
      try {
        navigator.clipboard.writeText(previous);
      } catch (e) {}
      elm.onclick = function () {};
    }

    this.relayHostSpan.onclick = copyHostText;
    this.relayUseButton.onclick = this.requestSetUsed;
  }
  updateContents() {
    var { relayNameSpan, relayHostSpan, name, host, relayDescriptionSpan } =
      this;
    relayNameSpan.textContent = name;
    relayHostSpan.textContent = host;
    relayDescriptionSpan.textContent = "";
  }
  save() {
    return {
      host: this.relay.host,
      name: this.relay.name,
    };
  }
  getFetchURL() {
    var url = "";
    if (window.location.protocol.startsWith("https")) {
      url += "https://";
    } else {
      url += "http://";
    }
    url += this.host;
    if (!url.endsWith("/")) {
      url += "/";
    }
    return url;
  }
  async fetchStatus() {
    var { relayNameSpan, relayDescriptionSpan, statusImg, statusText } = this;
    if (this.firstFetch) {
      statusImg.src = RelayOption.FETCHING_IMG;
      statusText.textContent = RelayOption.FETCHING_TEXT;
      relayDescriptionSpan.textContent = "";
      statusText.setAttribute("state", "fetch");
      this.firstFetch = false;
    }
    var online = false;
    var url = this.getFetchURL();
    try {
      var response = await fetch(url + "status");
      if (response.ok) {
        var json = await response.json();
        if (json.status == "online") {
          relayNameSpan.textContent = json.name;
          relayDescriptionSpan.textContent = json.description;
          online = true;
        }
      }
    } catch (e) {
      console.error(e);
      online = false;
    }
    if (!online) {
      statusImg.src = RelayOption.OFFLINE_IMG;
      statusText.textContent = RelayOption.OFFLINE_TEXT;
      statusText.setAttribute("state", "offline");
      return;
    }
    statusImg.src = RelayOption.ONLINE_IMG;
    statusText.textContent = RelayOption.ONLINE_TEXT;
    statusText.setAttribute("state", "online");
  }
}

function preloadImage(h) {
  var link = document.createElement("link");
  link.rel = "preload";
  link.href = h;
  link.as = "image";
  document.head.append(link);
}

preloadImage(RelayOption.FETCHING_IMG);
preloadImage(RelayOption.OFFLINE_IMG);
preloadImage(RelayOption.ONLINE_IMG);

module.exports = RelayOption;
