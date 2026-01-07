
class SRB2Relay {
    constructor (url) {
        this.url = url;
        this.isOpen = false;
        this.hasActiveNetgame = false;
        this.attemptConnection();
    }

    attemptConnection() {
        this.myIP = "0.0.0.0";
        this.ws = new WebSocket(this.url);
        var _this = this;
        this.ws.onopen = (event) => {
            _this.isOpen = true;
        };
        this.ws.onmessage = this.onRelayMessage.bind(this);
        this.ws.onclose = this.attemptConnection.bind(this);
    }

    startNetgame() {
        this.hasActiveNetgame = true;
        if (this.isOpen) {
            this.ws.send(JSON.stringify({method: "start_netgame"}));
        }
    }

    onRelayMessage(event) {
        var json = JSON.parse(event.data);
        if (json.method == "ready") {
            this.myIP = json.ip;
            if (this.hasActiveNetgame) {
                this.ws.send(JSON.stringify({method: "start_netgame"}));
            }
        }
        if (json.method == "data") {
            
        }
    }

    closeRelay() {
        window.SRB2WebNet = null;
    }

    addListeners() {
        window.SRB2WebNet = {
            InitNetwork: function () {
                window.alert("Network initialized from Main JS!");
                return 0;
            },
            ConnectTo: function (address) {
                window.alert("Game trying to connect to: " + address);
                // You can put real WebSocket logic here later!
                return 1;
            },
            SendPacket: function (ptr, length) {
                window.alert("Sending " + length + " bytes...");
                return 1;
            },
            ListenOn: function (port) {
                window.alert("Listening on port: " + port);
                return 0; // Success
            },
            CloseSocket: function () {
                console.log("Closing socket");
                // Close WebSocket or relay connection
                return 0;
            },
            GetPort: function () {
                // Return the current netgame port
                return 5029; // Or get from somewhere
            }
        };
    }
}

module.exports = {SRB2Relay};