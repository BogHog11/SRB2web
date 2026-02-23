var RelayOption = require("./relayoption.js");

module.exports = [
  {
    element: "style",
    textContent: require("./styles.css"),
  },
  {
    element: "style",
    textContent: "[hidden] { display: none !important; }",
  },
  {
    element: "div",
    className: "srb2BG",
  },
  {
    element: "div",
    className: "launcherMain",
    gid: "launcherMain",
    children: [
      {
        element: "img",
        style: {
          width: "100%",
          height: "200px",
          objectFit: "contain",
        },
        src: "images/srb2logo.png",
      },
      {
        element: "button",
        className: "button playButton",
        children: [
          {
            element: "img",
            src: "images/play.svg",
            style: {
              height: "32px",
            },
          },
          {
            element: "span",
            textContent: "Play",
          },
        ],
        gid: "playButton",
      },
      {
        element: "a",
        className: "button fsButton",
        href: "file.html",
        target: "_blank",
        children: [
          {
            element: "img",
            src: "images/folder.svg",
            style: {
              height: "32px",
            },
          },
          {
            element: "span",
            textContent: "Manage files & addons",
          },
        ],
        gid: "fsButton",
      },
      { element: "div", className: "sep" },
      {
        element: "span",
        className: "sectionHeader",
        textContent: "Relay server configuration:",
      },
      {
        element: "div",
        style: {
          display: "flex",
        },
        children: [
          {
            element: "span",
            style: { fontWeight: "bold" },
            textContent: "Enable relay server:",
          },
          {
            element: "input",
            type: "checkbox",
            gid: "relayServerCheckbox",
          },
        ],
      },
      {
        element: "div",
        style: {
          display: "flex",
        },
        children: [
          {
            element: "span",
            style: { fontWeight: "bold" },
            textContent: "Enable WebRTC hosting (faster connection):",
          },
          {
            element: "input",
            type: "checkbox",
            gid: "webrtcHostCheckbox",
          },
        ],
      },
      {
        element: "button",
        className: "button",
        gid: "addRelayButton",
        textContent: "Add relay server",
      },
      {
        element: "button",
        className: "button",
        gid: "browsePublicGames",
        textContent: "Browse public netgames",
      },
      {
        element: "div",
        gid: "relayConfig",
        className: "relayConfig",
      },
      {
        element: "button",
        className: "button",
        gid: "addDefaultServers",
        textContent: "Add default servers",
      },
      {
        element: "div",
        style: {
          lineHeight: "20px"
        },
        children: [
          "Relay servers make it easy to host and join netgames without needing to set up port forwarding.",
          {
            element: "br",
          },
          "Keep in mind that connection speeds depend on both the relay server and the host's hardware.",
          {
            element: "br",
          },
          "To get started, click \"Use this server\" next to your preferred relay. If you run into connection issues, click the \"Add default servers\" button above to refresh the list.",
          {
            element: "br",
          },
          "Our default servers are hosted on free tiers, so they may take a moment to \"wake up\" if they have been inactive for a while.",
          {
            element: "br"
          },
          "Enabling WebRTC provides a much faster connection. This setting only applies if you are the host (clients will automatically use WebRTC if the host has it enabled).",
          {
            element: "br"
          },
          {
            element: "a",
            href: "https://github.com/gvbvdxxalt2/SRB2Web-Relay/",
            target: "_blank",
            textContent: "Source code for Relay Server.",
          },
          {
            element: "br",
          },
          
          {
            element: "h2",
            textContent: "Status details"
          },
          
          {
            element: "li",
            children: [
              {
                element: "img",
                className: "relayStatusImg",
                src: RelayOption.FETCHING_IMG
              },
              {
                element: "span",
                textContent: " - Fetching: Attempting to connect to the server."
              }
            ]
          },
          {
            element: "li",
            children: [
              {
                element: "img",
                className: "relayStatusImg",
                src: RelayOption.ONLINE_IMG
              },
              {
                element: "span",
                textContent: " - Online: The server is active and ready to go!"
              }
            ]
          },
          {
            element: "li",
            children: [
              {
                element: "img",
                className: "relayStatusImg",
                src: RelayOption.OFFLINE_IMG
              },
              {
                element: "span",
                textContent: " - Offline: The server is offline, unreachable, or blocked."
              }
            ]
          },
        ],
      },
      { element: "div", className: "sep" },
      {
        element: "div",
        children: [
          "Sonic Robo Blast 2 is a 3D Sonic the Hedgehog fangame built on a heavily modified Doom Legacy engine.",
          {
            element: "br",
          },
          " Visit ",
          {
            element: "a",
            href: "https://www.srb2.org/",
            target: "_blank",
            textContent: "srb2.org",
          },
          " for more information.",
          {
            element: "br",
          },
          "SRB2Web is developed by ",
          {
            element: "a",
            href: "https://github.com/gvbvdxxalt2",
            target: "_blank",
            textContent: "Gvbvdxx",
          },
          ", with the help of Google Gemini and other AI tools.",
          {
            element: "br",
          },
          {
            element: "a",
            href: "https://github.com/gvbvdxxalt2/SRB2web",
            target: "_blank",
            textContent: "Click here to view the source code on GitHub.",
          },
          {
            element: "br",
          },
          "Sonic Robo Blast 2, its name, characters, and all related elements are trademarks of their respective owners. This fangame is not affiliated with or endorsed by SEGA Corporation.",
        ],
        style: {
          marginTop: "20px",
          fontSize: "14px",
          color: "#ffffff",
        },
        gid: "launcherInfo",
      },
    ],
  },
  {
    element: "div",
    className: "loaderMain",
    gid: "loaderMain",
    children: [
      {
        element: "img",
        style: {
          width: "300px",
          height: "160px",
          objectFit: "contain",
        },
        src: "images/srb2logo.png",
      },
      {
        element: "div",
        gid: "loaderContent",
        textContent: "Loading...",
        style: {
          textAlign: "center",
          fontWeight: "bold",
          color: "#ffffff",
        },
      },
    ],
  },
  {
    element: "div",
    className: "logsContainer",
    gid: "dedicatedServerLogs",
    hidden: true,
  },
  {
    element: "canvas",
    className: "gameCanvas",
    gid: "gameCanvas",
    tabindex: "0",
  },

  {
    element: "div",
    gid: "publicNetgameBrowserContainer",
    className: "publicNetgameBrowserContainer",
    hidden: true,

    children: [
      {
        element: "div",
        gid: "netgameLoadingListsContainer",
        className: "netgameLoadingListsContainer",
        children: [
          {
            element: "img",
            src: "images/loading.gif",
            className: "netgameLoadingListsImg"
          },
          "Loading..."
        ]
      },
      
      {
        element: "div",
        gid: "publicNetgameBrowser",
        className: "publicNetgameBrowserDialog",
        hidden: true,
        children: [
          {
            element: "div",
            gid: "publicNetgameBrowserLeft",
            className: "publicNetgameBrowserLeft"
          },
          {
            element: "div",
            gid: "publicNetgameBrowserRight",
            className: "publicNetgameBrowserRight",
          }
        ]
      }
    ]
  }
];
