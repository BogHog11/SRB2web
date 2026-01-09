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

#define MAX_QUEUED_PACKETS 16384 
#define MAX_PACKET_SIZE 32768
#define MAX_RELAY_MAP 65536 

typedef struct {
    unsigned char data[MAX_PACKET_SIZE];
    int length;
    int from_node_id; 
} ws_packet_t;

// The Queue
static ws_packet_t packet_queue[MAX_QUEUED_PACKETS];
static int queue_head = 0;
static int queue_tail = 0;

// The Map: Stores the Real IP Hash for every connected RelayID
static unsigned int client_real_ip_map[MAX_RELAY_MAP];

static int NextIndex(int index) { return (index + 1) % MAX_QUEUED_PACKETS; }

// Helper: Consistent hashing for IPs
static unsigned int GetIPHash(const char* ip) {
    unsigned int hash = 0;
    for (int j = 0; ip[j]; j++) {
        hash = hash * 31 + ip[j];
    }
    return hash;
}

// --- JAVASCRIPT INTERFACE ---

EMSCRIPTEN_KEEPALIVE
void SRB2_NetworkReceive(char *data, int length, int from_id) {
    int next_head = NextIndex(queue_head);
    
    if (next_head == queue_tail) {
        printf("SRB2_NET: QUEUE FULL! Dropped packet from %d\n", from_id);
        return; 
    }

    if (length > MAX_PACKET_SIZE) length = MAX_PACKET_SIZE;
    
    memcpy(packet_queue[queue_head].data, data, length);
    packet_queue[queue_head].length = length;
    packet_queue[queue_head].from_node_id = from_id;
    
    queue_head = next_head;
}

EMSCRIPTEN_KEEPALIVE
void SRB2_SetClientIP(int clientId, const char* ip, short portnumber) {
    if (clientId < 0 || clientId >= MAX_RELAY_MAP) return;
    
    // Store the Real IP Hash mapped to the RelayID
    client_real_ip_map[clientId] = GetIPHash(ip);
    
    // Debug logging (optional)
    // printf("Mapped Client %d to IP Hash %u (%s)\n", clientId, client_real_ip_map[clientId], ip);
}

extern void SRB2_NetworkSend(int node_id, void* data, int length);
extern int SRB2_ListenOn(int port);
extern int SRB2_CloseSocket(void);
extern int SRB2_GetPort(void);
extern void SRB2_ForceCloseSocket(void);

// Other JS functions
extern int SRB2_InitNetwork(void);
extern int SRB2_ConnectTo(const char* addr, char* port);
extern void SendKicksForNode(SINT8 node, UINT8 msg);

#endif
// ------------------------------------------

#ifdef HAVE_SDLNET

#ifdef EMSCRIPTEN
// Modified Struct: Holds both Identity (host) and Security (real_ip_hash)
typedef struct {
    unsigned int host;          // RelayID (Used for gameplay matching)
    unsigned int real_ip_hash;  // Real IP Hash (Used for ban checks)
    unsigned short port;
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

#ifdef EMSCRIPTEN
#include "../g_game.h"

EMSCRIPTEN_KEEPALIVE
void SRB2_ClientDisconnected(int clientId) {
    if (clientId >= 0 && clientId < MAX_RELAY_MAP) {
        client_real_ip_map[clientId] = 0; // Clear the IP mapping
    }

    for (int i = 1; i < MAXNETNODES; i++) {
        if (nodeconnected[i] && clientaddress[i].host == (unsigned int)clientId) {
            if (playeringame[i]) {                
                SendKicksForNode(i, KICK_MSG_PLAYER_QUIT);
            } 
            else {
                Net_CloseConnection(i | FORCECLOSE);
                nodeconnected[i] = false;
                clientaddress[i].host = 0;
            }
            return;
        }
    }
}
#endif

static const char *NET_AddrToStr(IPaddress* sk)
{
#ifdef EMSCRIPTEN
    static char s[64];
    // Show RelayID to the user/logs, usually enough for gameplay
    sprintf(s, "Client-%u", sk->host);
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
    if (!nodeconnected[node]) return NULL;
    return NET_AddrToStr(&clientaddress[node]);
}

static const char *NET_GetBanAddress(size_t ban)
{
    if (ban > numbans) return NULL;
    return NET_AddrToStr(&banned[ban]);
}

static boolean NET_cmpaddr(IPaddress* a, IPaddress* b)
{
#ifdef EMSCRIPTEN
    // Gameplay Identity Check:
    // We only compare 'host' (RelayID).
    // This ensures different tabs on the same IP are treated as different players.
    return (a->host == b->host);
#else
    return (a->host == b->host && a->port == b->port);
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

static boolean NET_Get(void)
{
    INT32 mystatus = -1;
    INT32 newnode;
    mypacket.len = MAXPACKETLENGTH;

    if (!NET_CanGet())
    {
        doomcom->remotenode = -1; 
        return false;
    }

#ifdef EMSCRIPTEN
    static int packets_this_frame = 0;
    packets_this_frame++;
    if (packets_this_frame > 50) { 
        packets_this_frame = 0;
        doomcom->remotenode = -1;
        return false; 
    }

    ws_packet_t *pkt = &packet_queue[queue_tail];
    
    int safe_len = pkt->length;
    if (safe_len > MAXPACKETLENGTH) safe_len = MAXPACKETLENGTH;
    if (safe_len > hardware_MAXPACKETLENGTH) safe_len = hardware_MAXPACKETLENGTH;

    mypacket.len = safe_len;
    memcpy(mypacket.data, pkt->data, safe_len);
    
    int rid = pkt->from_node_id;
    
    // --- KEY LOGIC CHANGE ---
    // 1. Set Identity (RelayID)
    mypacket.address.host = (unsigned int)rid; 
    mypacket.address.port = 5029;
    
    // 2. Set Security (Real IP Hash)
    // We look up the Real IP hash we stored earlier via SRB2_SetClientIP
    if (rid >= 0 && rid < MAX_RELAY_MAP) {
        mypacket.address.real_ip_hash = client_real_ip_map[rid];
    } else {
        mypacket.address.real_ip_hash = 0;
    }
    
    queue_tail = NextIndex(queue_tail);
    if (queue_head == queue_tail) packets_this_frame = 0;

    mystatus = 1; 
#else
    mystatus = SDLNet_UDP_Recv(mysocket,&mypacket);
#endif

    if (mystatus != -1)
    {
        INT32 found_node = -1;
        
        // Match existing nodes by Identity (RelayID)
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
            
            // --- SECURITY CHECK (BAN EVASION) ---
            for (i = 0; i < numbans; i++)
            {
                // Here we compare the REAL IP HASH, not the RelayID!
                #ifdef EMSCRIPTEN
                if (mypacket.address.real_ip_hash == banned[i].real_ip_hash)
                #else
                if (NET_cmpaddr(&mypacket.address, &banned[i]))
                #endif
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
    doomcom->remotenode = -1; 
    return false;
}

static void NET_Send(void)
{
    if (!doomcom->remotenode) return;
    mypacket.len = doomcom->datalength;

#ifdef EMSCRIPTEN
    int target_id = clientaddress[doomcom->remotenode].host; 
    SRB2_NetworkSend(target_id, mypacket.data, mypacket.len);
#else
    if (SDLNet_UDP_Send(mysocket,doomcom->remotenode-1,&mypacket) == 0)
    {
        I_OutputMsg("SDL_Net: %s",SDLNet_GetError());
    }
#endif
}

static void NET_FreeNodenum(INT32 numnode)
{
    if (!numnode) return;
#ifndef EMSCRIPTEN
    SDLNet_UDP_Unbind(mysocket,numnode-1);
#endif
    memset(&clientaddress[numnode], 0, sizeof (IPaddress));
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
    if (init_SDLNet_driver) I_ShutdownSDLNetDriver();

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
    hostnameIP.host = atoi(hostname); 
    // For outgoing connections (unlikely in browser server mode), 
    // we don't know the real IP, so 0 is fine.
    hostnameIP.real_ip_hash = 0; 
    hostnameIP.port = 5029;
    
    newnode = -1;
    for (INT32 i = 1; i < MAXNETNODES; i++) {
        if (!nodeconnected[i]) {
            newnode = i;
            break;
        }
    }
    if (newnode == -1) return -1;
    
    M_Memcpy(&clientaddress[newnode],&hostnameIP,sizeof (IPaddress));
    if (SRB2_ConnectTo(hostname, port) != 0) return -1;
    return (SINT8)newnode;
#else
    UINT16 portnum = sock_port;
    if (port && !port[0]) portnum = atoi(port);

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
        if (server && SRB2_ListenOn(sock_port) != 0) return false;
    #endif
    if (!mysocket) return false;

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
    if (numbans == MAXBANS) return false;
    M_Memcpy(&banned[numbans], &clientaddress[node], sizeof (IPaddress));
    banned[numbans].port = 0; 
    
    // In Emscripten, clientaddress[node] already contains real_ip_hash.
    // So simple memcpy works perfectly here!
    
    numbans++;
    return true;
}

static boolean NET_SetBanAddress(const char *address, const char *mask)
{
    (void)mask;
    if (numbans == MAXBANS) return false;

#ifdef EMSCRIPTEN
    // When admin types "ban 123.456.78.9", we hash it.
    // This hash will match the stored hash in client_real_ip_map.
    banned[numbans].real_ip_hash = GetIPHash(address);
    banned[numbans].host = 0; // Host ID irrelevant for manual IP bans
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
    if ( M_CheckParm ("-net") ) I_Error("-net not supported, use -server and -connect\n");
    return false;
#endif
}
#endif