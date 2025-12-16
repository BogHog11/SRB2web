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
                textContent: "Play"
            }
        ]
    }
];