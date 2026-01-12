// Emacs style mode select   -*- C++ -*-
//-----------------------------------------------------------------------------
//
// Copyright (C) 1993-1996 by id Software, Inc.
// Portions Copyright (C) 1998-2000 by DooM Legacy Team.
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//-----------------------------------------------------------------------------
/// \file
/// \brief SDL network interface

#include "../doomdef.h"
#include "../i_system.h"
#include "../d_event.h"
#include "../netcode/d_net.h"
#include "../m_argv.h"
#include "../doomstat.h"
#include "../netcode/i_net.h"
#include "../z_zone.h"
#include "../netcode/i_tcp.h"
#include "../netcode/net_command.h"
#include "../netcode/d_clisrv.h"

#ifdef HAVE_SDL

// --- WEBSOCKET / EMSCRIPTEN DEFINITIONS ---
#ifdef EMSCRIPTEN
#include <emscripten.h>

// Defines for our Fake Socket System
#define MAX_QUEUED_PACKETS 128
#define MAX_PACKET_SIZE 1450 

// Structure to hold a packet that arrived from JS
typedef struct {
    unsigned char data[MAX_PACKET_SIZE];
    int length;
    int from_node_id; 
} ws_packet_t;

// The Queue - VOLATILE ensures the compiler checks it every frame
static volatile ws_packet_t packet_queue[MAX_QUEUED_PACKETS];
static volatile int queue_head = 0;
static volatile int queue_tail = 0;

static int NextIndex(int index) { return (index + 1) % MAX_QUEUED_PACKETS; }

// Helper for Popups
void DebugPopup(const char *msg) {
    char buf[256];
    snprintf(buf, sizeof(buf), "console.log('C-SIDE: %s');", msg);
    emscripten_run_script(buf);
}

// --- JAVASCRIPT INTERFACE ---

// JS calls this to give us a packet
EMSCRIPTEN_KEEPALIVE
void SRB2_NetworkReceive(char *data, int length, int from_id) {
    int next_head = NextIndex(queue_head);
    if (next_head == queue_tail) return; // Drop packet if full

    if (length > MAX_PACKET_SIZE) length = MAX_PACKET_SIZE;
    
    // We must cast away volatile to memcpy
    memcpy((void*)packet_queue[queue_head].data, data, length);
    packet_queue[queue_head].length = length;
    packet_queue[queue_head].from_node_id = from_id;
    
    queue_head = next_head;
}

// We call this JS function to send data
extern void SRB2_NetworkSend(int node_id, void* data, int length);
extern int SRB2_ListenOn(int port);
extern void SRB2_SetClientIP(int clientId, const char* ip);
extern int SRB2_CloseSocket(void);
extern int SRB2_GetPort(void);
extern int SRB2_InitNetwork(void);
extern int SRB2_ConnectTo(const char* addr, char* port);

#endif
// ------------------------------------------

#ifdef HAVE_SDLNET

#ifdef EMSCRIPTEN
// Dummy types for EMSCRIPTEN
typedef struct {
    unsigned int host;
    unsigned short port;
    unsigned int relayid; // The Web Relay ID (integer)
    char ip[64];          // The actual IP string (for bans/display)
} IPaddress;

typedef struct {
    int channel;
    unsigned char *data;
    int len;
    int maxlen;
    int status;
    IPaddress address;
} UDPpacket;

typedef void* UDPsocket;
typedef void* SDLNet_SocketSet;

#define INADDR_BROADCAST 0xFFFFFFFF
#define MAXPACKETLENGTH 1450
#define SOCK_PORT 5029
#else
#include "SDL_net.h"
#endif

#define MAXBANS 20

// Global variables for SDL network driver
static boolean nodeconnected[MAXNETNODES+1];
static UINT16 sock_port = 5029;
static INT32 net_bandwidth;
static IPaddress clientaddress[MAXNETNODES+1];
static IPaddress banned[MAXBANS];
static UDPpacket mypacket;
static UDPsocket mysocket = NULL;
static SDLNet_SocketSet myset = NULL;
static size_t numbans = 0;
static boolean NET_bannednode[MAXNETNODES+1];
static boolean init_SDLNet_driver = false;

// -----------------------------------------------------------------------
//   ADDRESS HELPERS
// -----------------------------------------------------------------------

// New function to set client IP for banning
#ifdef EMSCRIPTEN
EMSCRIPTEN_KEEPALIVE
void SRB2_SetClientIP(int clientId, const char* ip) {
    if (!ip || !ip[0]) return;

    // Find the node associated with this Relay ID
    for (int i = 0; i < MAXNETNODES; i++) {
        if (nodeconnected[i] && clientaddress[i].relayid == (unsigned int)clientId) {
            strncpy(clientaddress[i].ip, ip, 63);
            clientaddress[i].ip[63] = '\0';
            // DebugPopup(va("IP Set for Node %d: %s", i, ip));
            return;
        }
    }
}
#endif

static const char *NET_AddrToStr(IPaddress* sk)
{
#ifdef EMSCRIPTEN
    // If we have a real IP string (populated by SRB2_SetClientIP), return that.
    // This allows the Ban system to compare "1.2.3.4" vs "1.2.3.4"
    if (sk->ip[0]) {
        return sk->ip;
    }
    // Fallback if IP hasn't arrived yet
    static char s[32];
    sprintf(s, "RelayID-%u", sk->relayid);
    return s;
#else
    static char s[22];
    strcpy(s, SDLNet_ResolveIP(sk));
    if (sk->port != 0) {
        char portstr[10];
        sprintf(portstr, ":%d", sk->port);
        strcat(s, portstr);
    }
    return s;
#endif
}

static const char *NET_GetNodeAddress(INT32 node)
{
    if (!nodeconnected[node])
        return NULL;
    return NET_AddrToStr(&clientaddress[node]);
}

static const char *NET_GetBanAddress(size_t ban)
{
    if (ban > numbans)
        return NULL;
    return NET_AddrToStr(&banned[ban]);
}

static boolean NET_cmpaddr(IPaddress* a, IPaddress* b)
{
#ifdef EMSCRIPTEN
    // For packet routing, we must still compare Relay IDs
    return (a->relayid == b->relayid);
#else
    if (a->host == b->host && a->port == b->port) return true;
    return false;
#endif
}

static boolean NET_CanGet(void)
{
#ifdef EMSCRIPTEN
    return (queue_head != queue_tail);
#else
    return myset?(SDLNet_CheckSockets(myset,0)  == 1):false;
#endif
}

// -----------------------------------------------------------------------
//   WEB RELAY NODE MAPPING
// -----------------------------------------------------------------------

#ifdef EMSCRIPTEN
static INT32 NET_WebToNode(INT32 relayid)
{
    // If we are a Client, ANY packet we receive is from the Server.
    // We map the Server to Node 1.
    if (!server) {
        if (!nodeconnected[1]) {
            nodeconnected[1] = true;
            clientaddress[1].relayid = relayid;
            clientaddress[1].host = relayid; 
            // We don't set IP here, we wait for Init or Connect to set the hostname
        }
        return 1; 
    }

    // --- Server Logic ---
    // Find existing node with this Relay ID
    for (INT32 i = 1; i < MAXNETNODES; i++) {
        if (nodeconnected[i] && clientaddress[i].relayid == (unsigned int)relayid) return i;
    }

    // Not found? Allocate new node.
    INT32 newnode = -1;
    for (INT32 i = 1; i < MAXNETNODES; i++) {
        if (!nodeconnected[i]) { newnode = i; break; }
    }

    if (newnode != -1) {
        memset(&clientaddress[newnode], 0, sizeof(IPaddress));
        clientaddress[newnode].relayid = relayid;
        clientaddress[newnode].host = relayid; 
        nodeconnected[newnode] = true; 
        
        // CONS_Printf("[WebNet] Auto-Allocated Node %d to RelayID %d\n", newnode, relayid);
        return newnode;
    }
    return -1; 
}

EMSCRIPTEN_KEEPALIVE
void SRB2_NetworkClosed(int relay_id) {
    if (!server) return; // Clients don't manage connections this way

    // Find the internal node ID based on the Relay ID
    int node = -1;
    for (INT32 i = 1; i < MAXNETNODES; i++) {
        if (nodeconnected[i] && clientaddress[i].relayid == (unsigned int)relay_id) {
            node = i;
            break;
        }
    }

    if (node == -1) return;

    // Trigger game-side disconnect logic
    if (netnodes[node].ingame) {
        if (netnodes[node].player) {
             // KICK_MSG_PLAYER_QUIT is standard for clean disconnects
             // Use 0 or NULL for generic message if needed
            SendKicksForNode(node, KICK_MSG_PLAYER_QUIT); 
        }
    }
}
#endif

// -----------------------------------------------------------------------

static boolean NET_Get(void)
{
#ifdef EMSCRIPTEN
    if (queue_head == queue_tail) {
        doomcom->remotenode = -1;
        return false;
    }

    int tail = queue_tail;
    ws_packet_t *pkt = (ws_packet_t*)&packet_queue[tail];

    // Map Web ID to Internal Node ID
    INT32 node = NET_WebToNode(pkt->from_node_id);

    if (node != -1)
    {
        if (server && clientaddress[node].ip[0] == 0) {
            // Discard the packet from the queue
            queue_tail = NextIndex(tail);
            // Return false to tell the game "no packet received"
            doomcom->remotenode = -1;
            return false;
        }

        mypacket.len = pkt->length;
        memcpy(mypacket.data, pkt->data, pkt->length);
        
        mypacket.address.relayid = pkt->from_node_id;
        mypacket.address.host = pkt->from_node_id; 
        
        // If node has an IP string, ensure packet address has it too? 
        // Not strictly necessary for 'mypacket', but good for consistency
        if (clientaddress[node].ip[0]) {
             strncpy(mypacket.address.ip, clientaddress[node].ip, 63);
        }

        doomcom->remotenode = node;
        doomcom->datalength = mypacket.len;
        
        queue_tail = NextIndex(tail);
        return true;
    }
    
    // If we couldn't map the node, drop the packet
    queue_tail = NextIndex(tail);
    doomcom->remotenode = -1;
    return false;
#else
    if (!NET_CanGet()) {
        doomcom->remotenode = -1;
        return false;
    }

    if (SDLNet_UDP_Recv(mysocket,&mypacket))
    {
        INT32 i;
        doomcom->remotenode = -1;
        for (i=0; i<MAXNETNODES; i++)
        {
            if (NET_cmpaddr(&mypacket.address,&clientaddress[i]))
            {
                doomcom->remotenode = i;
                break;
            }
        }
        
        if (doomcom->remotenode == -1)
            doomcom->remotenode = MAXNETNODES; 
        
        doomcom->datalength = mypacket.len;
        return true;
    }
    return false;
#endif
}

static void NET_Send(void)
{
    if (!doomcom->remotenode) return;
    
    mypacket.len = doomcom->datalength;

#ifdef EMSCRIPTEN
    if (doomcom->remotenode < 0 || doomcom->remotenode >= MAXNETNODES) return;

    int target_relay_id = clientaddress[doomcom->remotenode].relayid;
    SRB2_NetworkSend(target_relay_id, mypacket.data, mypacket.len);
#else
    if (SDLNet_UDP_Send(mysocket,doomcom->remotenode-1,&mypacket) == 0)
        I_OutputMsg("SDL_Net: %s",SDLNet_GetError());
#endif
}

static void NET_FreeNodenum(INT32 numnode)
{
    if (!numnode) return;
    DEBFILE(va("Free node %d (%s)\n", numnode, NET_GetNodeAddress(numnode)));
#ifndef EMSCRIPTEN
    SDLNet_UDP_Unbind(mysocket,numnode-1);
#endif
    memset(&clientaddress[numnode], 0, sizeof (IPaddress));
    nodeconnected[numnode] = false; 
}

static UDPsocket NET_Socket(void)
{
#ifdef EMSCRIPTEN
    static int dummy_socket;
    return (UDPsocket)&dummy_socket;
#else
    UDPsocket temp = NULL;
    Uint16 portnum = 0;
    IPaddress tempip = {INADDR_BROADCAST,0};

    if (M_CheckParm("-clientport"))
    {
        if (!M_IsNextParm()) I_Error("syntax: -clientport <portnum>");
        portnum = atoi(M_GetNextParm());
    }
    else portnum = sock_port;
        
    temp = SDLNet_UDP_Open(portnum);
    if (!temp) return NULL;
    if (SDLNet_UDP_Bind(temp,BROADCASTADDR-1,&tempip) == -1)
    {
        SDLNet_UDP_Close(temp);
        return NULL;
    }
    clientaddress[BROADCASTADDR].port = sock_port;
    clientaddress[BROADCASTADDR].host = INADDR_BROADCAST;
    doomcom->extratics = 1; 
    return temp;
#endif
}

static void I_ShutdownSDLNetDriver(void)
{
#ifndef EMSCRIPTEN
    if (myset) SDLNet_FreeSocketSet(myset);
    myset = NULL;
    SDLNet_Quit();
#endif
    init_SDLNet_driver = false;
}

static void I_InitSDLNetDriver(void)
{
    if (init_SDLNet_driver) I_ShutdownSDLNetDriver();

#ifndef EMSCRIPTEN
    if (SDLNet_Init() == -1) return; 
#endif
    D_SetDoomcom();
    mypacket.data = doomcom->data;
    init_SDLNet_driver = true;
}

static void NET_CloseSocket(void)
{
#ifdef EMSCRIPTEN
    SRB2_CloseSocket();
    mysocket = NULL;
#endif
#ifndef EMSCRIPTEN
    if (mysocket) SDLNet_UDP_Close(mysocket);
#endif
    mysocket = NULL;
}

EMSCRIPTEN_KEEPALIVE
void SRB2_ForceCloseSocket(void)  {
    NET_CloseSocket();
}

static SINT8 NET_NetMakeNodewPort(const char *hostname, const char *port)
{
    INT32 newnode;
    IPaddress hostnameIP;

#ifdef EMSCRIPTEN
    DebugPopup("Connect: Client attempting connection...");
    
    if (SRB2_ConnectTo(hostname, port) != 0) {
        DebugPopup("Connect: SRB2_ConnectTo failed");
        return -1;
    }

    // FIX: Map the Server to Node 1
    newnode = 1; 
    
    hostnameIP.relayid = hostname ? atoi(hostname) : 0;
    hostnameIP.host = hostnameIP.relayid; 
    hostnameIP.port = 0;
    // For clients, "hostname" is the ID of the server. 
    // We can store it as the IP string for display purposes.
    if (hostname) {
        strncpy(hostnameIP.ip, hostname, 63);
        hostnameIP.ip[63] = '\0';
    } else {
        hostnameIP.ip[0] = '\0';
    }

    M_Memcpy(&clientaddress[newnode], &hostnameIP, sizeof(IPaddress));
    nodeconnected[newnode] = true; 
    
    return (SINT8)newnode;
#else
    UINT16 portnum = sock_port;
    if (port && !port[0]) portnum = atoi(port);
    if (SDLNet_ResolveHost(&hostnameIP,hostname,portnum) == -1) return -1;
    newnode = SDLNet_UDP_Bind(mysocket,-1,&hostnameIP);
    if (newnode == -1) return newnode;
    newnode++;
    M_Memcpy(&clientaddress[newnode],&hostnameIP,sizeof (IPaddress));
    return (SINT8)newnode;
#endif
}


static boolean NET_OpenSocket(void)
{
    memset(clientaddress, 0, sizeof (clientaddress));
    for(int i=0; i<MAXNETNODES+1; i++) nodeconnected[i] = false;

    I_NetSend = NET_Send;
    I_NetGet = NET_Get;
    I_NetCloseSocket = NET_CloseSocket;
    I_NetFreeNodenum = NET_FreeNodenum;
    I_NetMakeNodewPort = NET_NetMakeNodewPort;

    NET_CloseSocket();
    mysocket = NET_Socket();

    #ifdef EMSCRIPTEN
        if (server) {
            DebugPopup("Socket: Opening Port 5029 (Server Mode)");
            if (SRB2_ListenOn(sock_port) != 0)
                return false;
        }
    #endif

    if (!mysocket) return false;

#ifndef EMSCRIPTEN
    myset = SDLNet_AllocSocketSet(1);
    if (!myset) return false;
    if (SDLNet_UDP_AddSocket(myset,mysocket) == -1) return false;
#endif
    return true;
}

static boolean NET_Ban(INT32 node)
{
    if (numbans == MAXBANS) return false;
    // This Memcpy will now copy the 'ip' string field as well
    M_Memcpy(&banned[numbans], &clientaddress[node], sizeof (IPaddress));
    banned[numbans].port = 0;
    numbans++;
    return true;
}

static boolean NET_SetBanAddress(const char *address, const char *mask)
{
    (void)mask;
    if (numbans == MAXBANS) return false;

#ifdef EMSCRIPTEN
    // Store the IP string directly in the ban list
    strncpy(banned[numbans].ip, address, 63);
    banned[numbans].ip[63] = '\0';
    
    // Set dummy host/relayid
    banned[numbans].host = 0; 
    banned[numbans].relayid = 0; 
    banned[numbans].port = 0;
    
    numbans++;
    return true;
#else
    if (SDLNet_ResolveHost(&banned[numbans], address, 0) == -1) return false;
    numbans++;
    return true;
#endif
}

static void NET_ClearBans(void)
{
    numbans = 0;
}
#endif

//
// I_InitNetwork
//
boolean I_InitNetwork(void)
{
#ifdef HAVE_SDLNET
    char serverhostname[255];
    boolean ret = false;
    
    I_InitSDLNetDriver();
    I_AddExitFunc(I_ShutdownSDLNetDriver);
    if (!init_SDLNet_driver) return false;

#ifdef EMSCRIPTEN
    SRB2_InitNetwork();
#endif

    if (M_CheckParm("-udpport"))
    {
        if (M_IsNextParm()) sock_port = (UINT16)atoi(M_GetNextParm());
        else sock_port = 0;
    }

    if (M_CheckParm("-server") || dedicated)
    {
        server = true;
        if (dedicated) doomcom->numnodes = 0;
        else doomcom->numnodes = 1;

        if (doomcom->numnodes < 0) doomcom->numnodes = 0;
        if (doomcom->numnodes > MAXNETNODES) doomcom->numnodes = MAXNETNODES;

        servernode = 0;
        net_bandwidth = 16000;
        hardware_MAXPACKETLENGTH = INETPACKETLENGTH;
        ret = true;
    }
    else if (M_CheckParm("-connect"))
    {
        if (M_IsNextParm()) strcpy(serverhostname, M_GetNextParm());
        else serverhostname[0] = 0; 

        if (serverhostname[0])
        {
            COM_BufAddText("connect \"");
            COM_BufAddText(serverhostname);
            COM_BufAddText("\"\n");
            hardware_MAXPACKETLENGTH = INETPACKETLENGTH;
        }
        else
        {
            COM_BufAddText("connect any\n");
            net_bandwidth = 800000;
            hardware_MAXPACKETLENGTH = MAXPACKETLENGTH;
        }
        ret = true;
    }

    mypacket.maxlen = hardware_MAXPACKETLENGTH;
    I_NetOpenSocket = NET_OpenSocket;
    I_Ban = NET_Ban;
    I_ClearBans = NET_ClearBans;
    I_GetNodeAddress = NET_GetNodeAddress;
    I_GetBanAddress = NET_GetBanAddress;
    I_SetBanAddress = NET_SetBanAddress;
    bannednode = NET_bannednode;

    return ret;
#else
    if ( M_CheckParm ("-net") ) I_Error("-net not supported\n");
    return false;
#endif
}
#endif