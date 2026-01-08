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
              height: "32px"
            }
          },
          {
            element: "span",
            textContent: "Play",
          }
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
              height: "32px"
            }
          },
          {
            element: "span",
            textContent: "Manage files & addons",
          }
        ],
        gid: "fsButton",
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
