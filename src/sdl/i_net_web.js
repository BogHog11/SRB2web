mergeInto(LibraryManager.library, {
    // -------------------------------------------------------------------------
    // Network Initialization
    // -------------------------------------------------------------------------
    
    // Called by C: I_InitNetwork()
    JS_InitNetwork: function() {
        console.log("[Network] Initializing JS Network Driver...");
        
        // Define the global network state object if it doesn't exist
        window.SRB2Network = {
            socket: null,
            packetQueue: [],
            connected: false,
            serverAddress: "ws://localhost:9000" // Default dev address
        };

        try {
            // Check if we have a custom address in the URL (e.g. ?server=ws://...)
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('server')) {
                window.SRB2Network.serverAddress = urlParams.get('server');
            }
            
            console.log("[Network] Driver ready. Waiting for connection...");
            return 1; // Success
        } catch (e) {
            console.error("[Network] Init failed: " + e);
            return 0; // Failure
        }
    },

    // -------------------------------------------------------------------------
    // Connection Management
    // -------------------------------------------------------------------------

    // Called by C: I_NetOpenSocket
    JS_OpenSocket: function() {
        if (!window.SRB2Network) return 0;
        
        // Return a fake socket ID (e.g., 1) just to tell C we are "open"
        // The actual WebSocket connection usually happens when we try to join.
        // Or we can connect immediately here:
        
        return 1; 
    },

    // Called by C to actually connect to a server IP
    JS_Connect: function(address_ptr) {
        var address = UTF8ToString(address_ptr);
        console.log("[Network] Connecting to: " + address);

        try {
            // Close existing if open
            if (window.SRB2Network.socket) {
                window.SRB2Network.socket.close();
            }

            // Create WebSocket
            var ws = new WebSocket(address);
            ws.binaryType = 'arraybuffer';

            ws.onopen = function() {
                console.log("[Network] WebSocket Connected!");
                window.SRB2Network.connected = true;
            };

            ws.onmessage = function(event) {
                // Store received packet in a queue for the C engine to pick up
                var data = new Uint8Array(event.data);
                window.SRB2Network.packetQueue.push(data);
            };

            ws.onerror = function(e) {
                console.error("[Network] WebSocket Error", e);
            };

            ws.onclose = function() {
                console.log("[Network] Closed.");
                window.SRB2Network.connected = false;
            };

            window.SRB2Network.socket = ws;
            return 1; // Success signaling
        } catch (e) {
            console.error(e);
            return 0;
        }
    },

    // -------------------------------------------------------------------------
    // Data Transmission
    // -------------------------------------------------------------------------

    // Called by C: I_SendPacket
    JS_SendPacket: function(data_ptr, length) {
        if (!window.SRB2Network || !window.SRB2Network.socket) return 0;
        if (window.SRB2Network.socket.readyState !== 1) return 0;

        // Copy C memory to JS Array
        // HEAPU8 is the raw memory of the game
        var packet = HEAPU8.subarray(data_ptr, data_ptr + length);
        
        try {
            window.SRB2Network.socket.send(packet);
            return 1;
        } catch (e) {
            console.error(e);
            return 0;
        }
    },

    // Called by C: I_GetPacket
    // We write data INTO the pointer provided by C
    JS_GetPacket: function(buffer_ptr, max_length) {
        if (!window.SRB2Network || window.SRB2Network.packetQueue.length === 0) {
            return 0; // No packets waiting
        }

        // Pop the oldest packet
        var packet = window.SRB2Network.packetQueue.shift();
        
        // Safety check size
        var len = packet.length;
        if (len > max_length) len = max_length; // Truncate if too big

        // Write JS data into C memory
        HEAPU8.set(packet.subarray(0, len), buffer_ptr);

        return len; // Return size of packet
    }
});