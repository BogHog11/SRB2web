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
    int from_node_id; // The connection ID from the Relay
} ws_packet_t;

// The Queue
static ws_packet_t packet_queue[MAX_QUEUED_PACKETS];
static int queue_head = 0;
static int queue_tail = 0;

static int NextIndex(int index) { return (index + 1) % MAX_QUEUED_PACKETS; }

// --- JAVASCRIPT INTERFACE ---

// JS calls this to give us a packet
EMSCRIPTEN_KEEPALIVE
void SRB2_NetworkReceive(char *data, int length, int from_id) {
    int next_head = NextIndex(queue_head);
    if (next_head == queue_tail) return; // Drop packet if full

    if (length > MAX_PACKET_SIZE) length = MAX_PACKET_SIZE;
    
    memcpy(packet_queue[queue_head].data, data, length);
    packet_queue[queue_head].length = length;
    packet_queue[queue_head].from_node_id = from_id;
    
    queue_head = next_head;
}

// We call this JS function to send data
// You must implement "SRB2_NetworkSend(node_id, ptr, length)" in your HTML/JS
extern void SRB2_NetworkSend(int node_id, void* data, int length);
extern int SRB2_ListenOn(int port);
extern void SRB2_SetClientIP(int clientId, const char* ip);
extern int SRB2_CloseSocket(void);
extern int SRB2_GetPort(void);


// Other JS functions
extern int SRB2_InitNetwork(void);
extern int SRB2_ConnectTo(const char* addr, char* port);

#endif
// ------------------------------------------

#ifdef HAVE_SDLNET

#ifdef EMSCRIPTEN
// Dummy types for EMSCRIPTEN since SDL_net is not available
typedef struct {
    unsigned int host;
    unsigned short port;
    unsigned int relayid;
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

// New function to set client IP for banning
#ifdef EMSCRIPTEN
EMSCRIPTEN_KEEPALIVE
void SRB2_SetClientIP(int clientId, const char* ip) {
    // Find the node for this clientId
    for (int i = 1; i < MAXNETNODES; i++) {
        if (nodeconnected[i] && clientaddress[i].relayid == (unsigned int)clientId) {
            // For now, store the IP as a hash or something in host
            // Since host is unsigned int, hash the IP string
            unsigned int ip_hash = 0;
            for (int j = 0; ip[j]; j++) {
                ip_hash = ip_hash * 31 + ip[j];
            }
            clientaddress[i].host = ip_hash; // Overwrite with hash for banning
            //DEBFILE(va("Set IP for client %d: %s (hash: %u)\n", clientId, ip, ip_hash));
            break;
        }
    }
}

EMSCRIPTEN_KEEPALIVE
void SRB2_ClientDisconnected(int clientId) {
    // Find the node for this clientId and disconnect it
    for (int i = 1; i < MAXNETNODES; i++) {
        if (nodeconnected[i] && clientaddress[i].relayid == (unsigned int)clientId) {
            SendKicksForNode(i, KICK_MSG_PLAYER_QUIT);
            break;
        }
    }
}
#endif

static const char *NET_AddrToStr(IPaddress* sk)
{
#ifdef EMSCRIPTEN
    static char s[22];
    // In web, the "host" is just the Client ID
    sprintf(s, "Client-%d", sk->host);
    return s;
#else
    static char s[22]; // 255.255.255.255:65535
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
    // For Web, we compare the "host" (Client ID) only
    return (a->relayid == b->relayid); 
}

static boolean NET_CanGet(void)
{
#ifdef EMSCRIPTEN
    return (queue_head != queue_tail);
#else
    return myset?(SDLNet_CheckSockets(myset,0)  == 1):false;
#endif
}

static boolean NET_Get(void)
{
    INT32 mystatus = -1;
    INT32 newnode;
    mypacket.len = MAXPACKETLENGTH;

    if (!NET_CanGet())
    {
        doomcom->remotenode = -1; // no packet
        return false;
    }

#ifdef EMSCRIPTEN
    // --- WEB IMPLEMENTATION ---
    // Pop from our queue
    ws_packet_t *pkt = &packet_queue[queue_tail];
    
    // Copy data
    mypacket.len = pkt->length;
    memcpy(mypacket.data, pkt->data, pkt->length);
    
    // Set address (We use .host to store the Web Client ID)
    mypacket.address.host = pkt->from_node_id;
    mypacket.address.port = 0;
    mypacket.address.relayid = clientaddress[pkt->from_node_id].relayid;
    
    // Remove from queue
    queue_tail = NextIndex(queue_tail);
    
    mystatus = 1; // Success
    // --------------------------
#else
    // --- DESKTOP IMPLEMENTATION ---
    mystatus = SDLNet_UDP_Recv(mysocket,&mypacket);
#endif

    if (mystatus != -1)
    {
        // Search if we already know this node
        INT32 found_node = -1;
        
        // Skip node 0 (that's us usually)
        for (INT32 i = 1; i < MAXNETNODES; i++)
        {
             if (nodeconnected[i] && NET_cmpaddr(&clientaddress[i], &mypacket.address))
             {
                 found_node = i;
                 break;
             }
        }

        if (found_node != -1)
        {
            doomcom->remotenode = found_node;
            doomcom->datalength = mypacket.len;
            return true;
        }

        // It is a new node!
        // Find a free slot
        newnode = -1;
        for (INT32 i = 1; i < MAXNETNODES; i++)
        {
            if (!nodeconnected[i])
            {
                newnode = i;
                break;
            }
        }
        
        if (newnode != -1)
        {
            size_t i;
            M_Memcpy(&clientaddress[newnode], &mypacket.address, sizeof (IPaddress));
            DEBFILE(va("New node detected: node:%d address:%s\n", newnode,
                    NET_GetNodeAddress(newnode)));
            
            doomcom->remotenode = newnode; 
            doomcom->datalength = mypacket.len;
            
            // Check Bans
            for (i = 0; i < numbans; i++)
            {
                if (NET_cmpaddr(&mypacket.address, &banned[i]))
                {
                    DEBFILE("This dude has been banned\n");
                    NET_bannednode[newnode] = true;
                    break;
                }
            }
            if (i == numbans)
                NET_bannednode[newnode] = false;
            return true;
        }
        else
            I_OutputMsg("SDL_Net: No more free slots");
    }
    else 
    {
        I_OutputMsg("SDL_Net error");
    }

    DEBFILE("New node detected: No more free slots\n");
    doomcom->remotenode = -1; // no packet
    return false;
}

static void NET_Send(void)
{
    if (!doomcom->remotenode)
        return;
        
    mypacket.len = doomcom->datalength;

#ifdef EMSCRIPTEN
    // --- WEB IMPLEMENTATION ---
    // Get the Client ID of the target node
    int target_id = clientaddress[doomcom->remotenode].relayid;
    
    // Call JS to send via WebSocket
    SRB2_NetworkSend(target_id, mypacket.data, mypacket.len);
    // --------------------------
#else
    // --- DESKTOP IMPLEMENTATION ---
    if (SDLNet_UDP_Send(mysocket,doomcom->remotenode-1,&mypacket) == 0)
    {
        I_OutputMsg("SDL_Net: %s",SDLNet_GetError());
    }
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
}

static UDPsocket NET_Socket(void)
{
#ifdef EMSCRIPTEN
    // We don't use real sockets, just return a dummy pointer so it's not NULL
    static int dummy_socket;
    return (UDPsocket)&dummy_socket;
#else
    UDPsocket temp = NULL;
    Uint16 portnum = 0;
    IPaddress tempip = {INADDR_BROADCAST,0};

    if (M_CheckParm("-clientport"))
    {
        if (!M_IsNextParm())
            I_Error("syntax: -clientport <portnum>");
        portnum = atoi(M_GetNextParm());
    }
    else
        portnum = sock_port;
        
    temp = SDLNet_UDP_Open(portnum);
    if (!temp)
    {
            I_OutputMsg("SDL_Net: %s",SDLNet_GetError());
        return NULL;
    }
    if (SDLNet_UDP_Bind(temp,BROADCASTADDR-1,&tempip) == -1)
    {
        I_OutputMsg("SDL_Net: %s",SDLNet_GetError());
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
    if (init_SDLNet_driver)
        I_ShutdownSDLNetDriver();

#ifndef EMSCRIPTEN
    if (SDLNet_Init() == -1)
    {
        I_OutputMsg("SDL_Net: %s",SDLNet_GetError());
        return; 
    }
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
    if (mysocket)
        SDLNet_UDP_Close(mysocket);
#endif
    mysocket = NULL;
}

EMSCRIPTEN_KEEPALIVE
void SRB2_ForceCloseSocket(void)  {
    NET_CloseSocket();
}

// NOTE: This function is tricky for Web. 
// Standard SRB2 allows connecting via IP string.
// For Web, "hostname" will likely be a Room Code or Relay ID.
static SINT8 NET_NetMakeNodewPort(const char *hostname, const char *port)
{
    INT32 newnode;
    IPaddress hostnameIP;
    
#ifdef EMSCRIPTEN
    // Assume hostname IS the Client ID (integer)
    hostnameIP.host = atoi(hostname);
    hostnameIP.port = 0;
    
    // Just find a free node slot
    newnode = -1;
    for (INT32 i = 1; i < MAXNETNODES; i++) {
        if (!nodeconnected[i]) {
            newnode = i;
            break;
        }
    }
    if (newnode == -1) return -1;
    
    M_Memcpy(&clientaddress[newnode],&hostnameIP,sizeof (IPaddress));

    if (SRB2_ConnectTo(hostname, port) != 0)
        return -1;

    return (SINT8)newnode;
#else
    // Standard Desktop DNS Resolution
    UINT16 portnum = sock_port;
    if (port && !port[0])
        portnum = atoi(port);

    if (SDLNet_ResolveHost(&hostnameIP,hostname,portnum) == -1)
    {
        I_OutputMsg("SDL_Net: %s",SDLNet_GetError());
        return -1;
    }
    newnode = SDLNet_UDP_Bind(mysocket,-1,&hostnameIP);
    if (newnode == -1)
    {
        I_OutputMsg("SDL_Net: %s",SDLNet_GetError());
        return newnode;
    }
    newnode++;
    M_Memcpy(&clientaddress[newnode],&hostnameIP,sizeof (IPaddress));
    return (SINT8)newnode;
#endif
}


static boolean NET_OpenSocket(void)
{
    memset(clientaddress, 0, sizeof (clientaddress));

    I_NetSend = NET_Send;
    I_NetGet = NET_Get;
    I_NetCloseSocket = NET_CloseSocket;
    I_NetFreeNodenum = NET_FreeNodenum;
    I_NetMakeNodewPort = NET_NetMakeNodewPort;

    NET_CloseSocket();
    mysocket = NET_Socket();

    #ifdef EMSCRIPTEN
        if (server && SRB2_ListenOn(sock_port) != 0)
            return false;
    #endif

    if (!mysocket)
        return false;

#ifndef EMSCRIPTEN
    myset = SDLNet_AllocSocketSet(1);
    if (!myset)
    {
        I_OutputMsg("SDL_Net: %s",SDLNet_GetError());
        return false;
    }
    if (SDLNet_UDP_AddSocket(myset,mysocket) == -1)
    {
        I_OutputMsg("SDL_Net: %s",SDLNet_GetError());
        return false;
    }
#endif
    return true;
}

static boolean NET_Ban(INT32 node)
{
    if (numbans == MAXBANS)
        return false;

    M_Memcpy(&banned[numbans], &clientaddress[node], sizeof (IPaddress));
    banned[numbans].port = 0;
    numbans++;
    return true;
}

static boolean NET_SetBanAddress(const char *address, const char *mask)
{
    (void)mask;
    if (numbans == MAXBANS)
        return false;

#ifdef EMSCRIPTEN
    banned[numbans].host = atoi(address);
    banned[numbans].port = 0;
    numbans++;
    return true;
#else
    if (SDLNet_ResolveHost(&banned[numbans], address, 0) == -1)
        return false;
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
    
    // Initialize Driver
    I_InitSDLNetDriver();
    I_AddExitFunc(I_ShutdownSDLNetDriver);
    if (!init_SDLNet_driver)
        return false;

#ifdef EMSCRIPTEN
    SRB2_InitNetwork();
#endif

    if (M_CheckParm("-udpport"))
    {
        if (M_IsNextParm())
            sock_port = (UINT16)atoi(M_GetNextParm());
        else
            sock_port = 0;
    }

    // parse network game options,
    if (M_CheckParm("-server") || dedicated)
    {
        server = true;
        if (dedicated)
            doomcom->numnodes = 0;
        else
            doomcom->numnodes = 1;

        if (doomcom->numnodes < 0)
            doomcom->numnodes = 0;
        if (doomcom->numnodes > MAXNETNODES)
            doomcom->numnodes = MAXNETNODES;

        servernode = 0;
        net_bandwidth = 16000;
        hardware_MAXPACKETLENGTH = INETPACKETLENGTH;

        ret = true;
    }
    else if (M_CheckParm("-connect"))
    {
        if (M_IsNextParm())
            strcpy(serverhostname, M_GetNextParm());
        else
            serverhostname[0] = 0; 

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
    if ( M_CheckParm ("-net") )
    {
        I_Error("-net not supported, use -server and -connect\n");
    }
    return false;
#endif
}
#endif