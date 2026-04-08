module.exports = [
  {
    element: "div",
    style: {
      lineHeight: "20px",
    },
    children: [
      /////////////////////////////////////////////////////////

      {
        element: "h2",
        textContent: "What is a relay server?",
      },
      "Relay servers mock the behavior of port-forwarded routers, allowing people to host & join netgames without needing to configure your internet settings.",
      {
        element: "br",
      },
      "Connection speeds depend on the hosts method (WebRTC or Websocket), how fast their game is running, and your internet connection.",

      /////////////////////////////////////////////////////////

      {
        element: "h2",
        textContent: "Having trouble connecting to a server?",
      },
      'To get started, click "Use this server" next to your preferred relay. If you run into connection issues, click the "Add default servers" button above to refresh the list.',
      {
        element: "br",
      },
      'Our default servers are hosted on free tiers, so they may take a moment to "wake up" if they have been inactive for a while.',
      {
        element: "br",
      },
      "Enabling WebRTC provides a much faster connection. This setting only applies if you are the host, clients will automatically use WebRTC if the host has it enabled.",

      /////////////////////////////////////////////////////////

      {
        element: "h2",
        textContent: "Source code",
      },

      {
        element: "a",
        href: "https://github.com/gvbvdxxalt2/SRB2Web-Relay/",
        target: "_blank",
        textContent: "Source code for SRB2web relay servers",
      },
      {
        element: "br",
      },
      {
        element: "a",
        href: "https://github.com/gvbvdxxalt2/SRB2web/",
        target: "_blank",
        textContent: "Source code for SRB2web",
      },
      {
        element: "br",
      },

      /////////////////////////////////////////////////////////

      ...require("./relay-status-details.js"),
    ],
  },
];
