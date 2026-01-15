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
        gid: "relayConfig",
        className: "relayConfig",
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
            href: "https://github.com/gvbvdxxalt2/SRB2Web",
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
    element: "canvas",
    className: "gameCanvas",
    gid: "gameCanvas",
    tabindex: "0",
  },
];
