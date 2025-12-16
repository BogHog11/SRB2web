module.exports = [
    {
        element: "style",
        textContent: require("./styles.css")
    },
    {
        element: "style",
        textContent: "[hidden] { display: none !important; }"
    },
    {
        element: "div",
        className: "srb2BG"
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
                    objectFit: "contain"
                },
                src: "images/srb2logo.png"
            },
            {
                element: "button",
                className: "button playButton",
                textContent: "Play",
                gid: "playButton"
            },
        ]
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
                    objectFit: "contain"
                },
                src: "images/srb2logo.png"
            },
            {
                element: "div",
                gid: "loaderContent",
                textContent: "Loading...",
                style: {
                    textAlign: "center",
                    fontWeight: "bold",
                    color: "#ffffff"
                }
            }
        ]
    },
    {
        element: "canvas",
        className: "gameCanvas",
        gid: "gameCanvas"
    }
];