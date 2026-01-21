// SONIC ROBO BLAST 2
//-----------------------------------------------------------------------------
// Copyright (C) 1998-2000 by DooM Legacy Team.
// Copyright (C) 1999-2024 by Sonic Team Junior.
// Copyright (C) 2020-2023 by James R.
//
// This program is free software distributed under the
// terms of the GNU General Public License, version 2.
// See the 'LICENSE' file for more details.
//-----------------------------------------------------------------------------
/// \file  mserv.c
/// \brief Commands used to communicate with the master server

#if !defined (UNDER_CE)
#include <time.h>
#endif

#include "../doomstat.h"
#include "../doomdef.h"
#include "../command.h"
#include "../i_threads.h"
#include "mserv.h"
#include "client_connection.h"
#include "../m_menu.h"
#include "../z_zone.h"

// --------------------------------------------------------
// EMSCRIPTEN INTEGRATION
// --------------------------------------------------------
#ifdef EMSCRIPTEN
#include <emscripten.h>
#include <stdlib.h>
#include <string.h>

// This defines a C function 'SRB2_RequestServerList' that runs the JavaScript inside the {}
extern void SRB2_RequestServerList(void);
#endif
// --------------------------------------------------------

#ifdef MASTERSERVER

static int     MSId;
static int     MSRegisteredId = -1;

static boolean MSRegistered;
static boolean MSInProgress;
static boolean MSUpdateAgain;

static time_t  MSLastPing;

static I_mutex MSMutex;
static I_cond  MSCond;

#  define Lock_state()   I_lock_mutex  (&MSMutex)
#  define Unlock_state() I_unlock_mutex (MSMutex)

static void Command_Listserv_f(void);

#endif/*MASTERSERVER*/

static boolean ServerName_CanChange (const char*);

static void Update_parameters (void);

static void MasterServer_OnChange(void);
static void RoomId_OnChange(void);

static CV_PossibleValue_t masterserver_update_rate_cons_t[] = {
    {2,  "MIN"},
    {60, "MAX"},
    {0,NULL}
};

consvar_t cv_masterserver = CVAR_INIT ("masterserver", "https://ds.ms.srb2.org/MS/0", CV_SAVE|CV_CALL, NULL, MasterServer_OnChange);
consvar_t cv_servername = CVAR_INIT_WITH_CALLBACKS ("servername", "SRB2 server", CV_SAVE|CV_NETVAR|CV_CALL|CV_NOINIT|CV_ALLOWLUA, NULL, Update_parameters, ServerName_CanChange);

consvar_t cv_masterserver_update_rate = CVAR_INIT ("masterserver_update_rate", "15", CV_SAVE|CV_CALL|CV_NOINIT, masterserver_update_rate_cons_t, Update_parameters);
CV_PossibleValue_t cv_masterserver_room_values[] = {{-1, "MIN"}, {999999999, "MAX"}, {0, NULL}};
consvar_t cv_masterserver_room_id = CVAR_INIT ("masterserver_room_id", "-1", CV_CALL, cv_masterserver_room_values, RoomId_OnChange);

#ifdef EMSCRIPTEN
extern void SRB2_ServerInfoResponse(char *name);

EMSCRIPTEN_KEEPALIVE
void SRB2_GetServerInfo(void)
{
    SRB2_ServerInfoResponse(cv_servername.string);
}
#endif

static INT16 ms_RoomId = -1;

int           ms_QueryId;
I_mutex       ms_QueryId_mutex;

msg_server_t *ms_ServerList;
I_mutex       ms_ServerList_mutex;

UINT16 current_port = 0;

msg_rooms_t room_list[NUM_LIST_ROOMS+1];

void AddMServCommands(void)
{
    CV_RegisterVar(&cv_masterserver);
    CV_RegisterVar(&cv_masterserver_update_rate);
    CV_RegisterVar(&cv_masterserver_room_id);
    CV_RegisterVar(&cv_masterserver_timeout);
    CV_RegisterVar(&cv_masterserver_debug);
    CV_RegisterVar(&cv_masterserver_token);
    CV_RegisterVar(&cv_servername);
#ifdef MASTERSERVER
    COM_AddCommand("listserv", Command_Listserv_f, 0);
    COM_AddCommand("masterserver_update", Update_parameters, COM_LUA);
#endif
}

#ifdef MASTERSERVER

static void WarnGUI (void)
{
    I_lock_mutex(&m_menu_mutex);
    M_StartMessage(M_GetText("Master Server is offline\nor not responding.\n"), NULL, MM_NOTHING);
    I_unlock_mutex(m_menu_mutex);
}

#define NUM_LIST_SERVER MAXSERVERLIST

// ==========================================================
//  GET SERVER LIST (Emscripten Modified)
// ==========================================================
msg_server_t *GetShortServersList(INT32 room, int id)
{
    msg_server_t *server_list;
    server_list = malloc(( NUM_LIST_SERVER + 1 ) * sizeof *server_list);
    memset(server_list, 0, (NUM_LIST_SERVER + 1) * sizeof *server_list);

#ifdef EMSCRIPTEN
    // 1. Trigger the Webpack JS function via the EM_JS bridge
    CONS_Printf(M_GetText("Connecting to relayed master server..."));
    SRB2_RequestServerList();

    // 2. Return whatever we currently have in memory.
    if (ms_ServerList)
    {
        memcpy(server_list, ms_ServerList, NUM_LIST_SERVER * sizeof(msg_server_t));
    }
    return server_list;
#else
    if (HMS_fetch_servers(server_list, room, id))
        return server_list;
    else
    {
        free(server_list);
        WarnGUI();
        return NULL;
    }
#endif
}

// ==========================================================
//  GET ROOMS LIST (Emscripten Modified)
// ==========================================================
INT32 GetRoomsList(boolean hosting, int id)
{
#ifdef EMSCRIPTEN
    CONS_Printf("Test");

    int i = 0;

    // We hardcode the rooms so the menu allows the user to proceed
    memset(room_list, 0, sizeof(room_list));

    // Room 0: All
    room_list[i].id = 1; 
    strncpy(room_list[i].name, "THIS DOESN'T WORK", 63);
    strncpy(room_list[i].motd, "Please use the relay server option in the launcher (home page) for hosting and joining public netgames.", 255);
    
    I_lock_mutex(&m_menu_mutex);
    MP_RoomMenu[i+1].text = room_list[i].name;
    roomIds[i] = room_list[i].id;
    MP_RoomMenu[i+1].status = IT_STRING|IT_CALL;
    I_unlock_mutex(m_menu_mutex);

    return 1; // Success
#else
    if (HMS_fetch_rooms( ! hosting, id))
        return 1;
    else
    {
        WarnGUI();
        return -1;
    }
#endif
}

#ifdef UPDATE_ALERT
char *GetMODVersion(int id)
{
    char *buffer;
    int c;
    (void)id;
    buffer = malloc(16);
    c = HMS_compare_mod_version(buffer, 16);
    I_lock_mutex(&ms_QueryId_mutex);
    {
        if (id != ms_QueryId) c = -1;
    }
    I_unlock_mutex(ms_QueryId_mutex);
    if (c > 0) return buffer;
    else { free(buffer); if (! c) WarnGUI(); return NULL; }
}
void GetMODVersion_Console(void)
{
    char buffer[16];
    if (HMS_compare_mod_version(buffer, sizeof buffer) > 0)
        I_Error(UPDATE_ALERT_STRING_CONSOLE, VERSIONSTRING, buffer);
}
#endif

static void Command_Listserv_f(void)
{
    CONS_Printf("Retrieving server list...\n");
#ifdef EMSCRIPTEN
    CONS_Printf("Connecting to relayed master server...");
    SRB2_RequestServerList();
    return;
#endif
    HMS_list_servers();
}

static void Finish_registration (void) {
    int registered;
    CONS_Printf("Registering this server on the master server...\n");
    registered = HMS_register();
    Lock_state();
    {
        MSRegistered = registered;
        MSRegisteredId = MSId;
        time(&MSLastPing);
    }
    Unlock_state();
    if (registered) CONS_Printf("Master server registration successful.\n");
}

static void Finish_update (void) {
    int registered;
    int done;
    Lock_state();
    {
        registered = MSRegistered;
        MSUpdateAgain = false;
    }
    Unlock_state();
    if (registered) {
        if (HMS_update()) {
            Lock_state(); { time(&MSLastPing); MSRegistered = true; } Unlock_state();
            CONS_Printf("Updated master server listing.\n");
        } else Finish_registration();
    } else Finish_registration();
    Lock_state(); { done = ! MSUpdateAgain; if (done) MSInProgress = false; } Unlock_state();
    if (! done) Finish_update();
}

static void Finish_unlist (void) {
    int registered;
    Lock_state(); { registered = MSRegistered; } Unlock_state();
    if (registered) {
        CONS_Printf("Removing this server from the master server...\n");
        if (HMS_unlist()) CONS_Printf("Server deregistration request successfully sent.\n");
        Lock_state(); { MSRegistered = false; } Unlock_state();
        I_wake_all_cond(&MSCond);
    }
    Lock_state(); { if (MSId == MSRegisteredId) MSId++; } Unlock_state();
}

static int * Server_id (void) {
    int *id; id = malloc(sizeof *id);
    Lock_state(); { *id = MSId; } Unlock_state();
    return id;
}

static int * New_server_id (void) {
    int *id; id = malloc(sizeof *id);
    Lock_state(); { *id = ++MSId; I_wake_all_cond(&MSCond); } Unlock_state();
    return id;
}

static void Register_server_thread (int *id) {
    int same;
    Lock_state(); { while (*id == MSId && MSRegistered) I_hold_cond(&MSCond, MSMutex); same = ( *id == MSId ); } Unlock_state();
    if (same) Finish_registration();
    free(id);
}

static void Update_server_thread (int *id) {
    int same;
    Lock_state(); { same = ( *id == MSRegisteredId ); } Unlock_state();
    if (same) Finish_update();
    free(id);
}

static void Unlist_server_thread (int *id) {
    int same;
    Lock_state(); { same = ( *id == MSRegisteredId ); } Unlock_state();
    if (same) Finish_unlist();
    free(id);
}

static void Change_masterserver_thread (char *api) {
    Lock_state(); { while (MSRegistered) I_hold_cond(&MSCond, MSMutex); } Unlock_state();
    HMS_set_api(api);
}

void RegisterServer(void) {
    if (I_can_thread()) {
        void *nsid = New_server_id();
        if (!I_spawn_thread("register-server", (I_thread_fn)Register_server_thread, nsid)) free(nsid);
    } else Finish_registration();
}

static void UpdateServer(void) {
    if (I_can_thread()) {
        void *sid = Server_id();
        if (!I_spawn_thread("update-server", (I_thread_fn)Update_server_thread, sid)) free(sid);
    } else Finish_update();
}

void UnregisterServer(void) {
    if (I_can_thread()) {
        if (!I_spawn_thread("unlist-server", (I_thread_fn)Unlist_server_thread, Server_id())) ;
    } else Finish_unlist();
}

static boolean Online(void) { return ( serverrunning && cv_masterserver_room_id.value > 0 ); }

static inline void SendPingToMasterServer(void) {
    int ready; time_t now;
    if (Online()) {
        time(&now);
        Lock_state(); {
            ready = ( MSRegisteredId == MSId && ! MSInProgress && now >= ( MSLastPing + 60 * cv_masterserver_update_rate.value ) );
            if (ready) MSInProgress = true;
        } Unlock_state();
        if (ready) UpdateServer();
    }
}

void MasterClient_Ticker(void) { SendPingToMasterServer(); }

static void Set_api (const char *api) {
    char *dapi = strdup(api);
    if (I_can_thread()) {
        if (!I_spawn_thread("change-masterserver", (I_thread_fn)Change_masterserver_thread, dapi)) free(dapi);
    } else HMS_set_api(dapi);
}
#else
void RegisterServer(void) {}
void UnregisterServer(void) {}
#endif

static boolean ServerName_CanChange(const char* newvalue) {
    if (strlen(newvalue) < MAXSERVERNAME) return true;
    CONS_Alert(CONS_NOTICE, "The server name must be shorter than %d characters\n", MAXSERVERNAME);
    return false;
}

static void Update_parameters (void) {
#ifdef MASTERSERVER
    int registered = 0; int delayed;
    if (Online()) {
        Lock_state(); { delayed = MSInProgress; if (delayed) MSUpdateAgain = true; else registered = MSRegistered; } Unlock_state();
        if (! delayed && registered) UpdateServer();
    }
#endif
}

static void RoomId_OnChange(void) {
    if (ms_RoomId != cv_masterserver_room_id.value) {
        UnregisterServer();
        ms_RoomId = cv_masterserver_room_id.value;
#ifdef MASTERSERVER
        if (Online())
#endif
            RegisterServer();
    }
}

static void MasterServer_OnChange(void) {
#ifdef MASTERSERVER
    UnregisterServer();
    if ( ! cv_masterserver.changed && strcmp(cv_masterserver.string, "ms.srb2.org:28900") == 0 ) CV_StealthSet(&cv_masterserver, cv_masterserver.defaultvalue);
    if ( ! cv_masterserver.changed && strcmp(cv_masterserver.string, "https://mb.srb2.org/MS/0") == 0 ) CV_StealthSet(&cv_masterserver, cv_masterserver.defaultvalue);
    Set_api(cv_masterserver.string);
    if (Online()) RegisterServer();
#endif
}

// --------------------------------------------------------------------------
// WEB BROWSER INTEGRATION (Callbacks)
// --------------------------------------------------------------------------
#ifdef EMSCRIPTEN
#define MAX_WEB_SERVERS 64
static msg_server_t web_server_buffer[MAX_WEB_SERVERS];
static INT32 web_server_count = 0;

EMSCRIPTEN_KEEPALIVE void SRB2_ClearServerList(void) {
    web_server_count = 0;
    memset(web_server_buffer, 0, sizeof(web_server_buffer));
}

EMSCRIPTEN_KEEPALIVE void SRB2_AddServerToList(const char *address, const char *name, const char *version, int players, int maxplayers, int ping, int gametype) {
    if (web_server_count >= MAX_WEB_SERVERS) return;
    msg_server_t *entry = &web_server_buffer[web_server_count];
    memset(entry, 0, sizeof(msg_server_t));
    
    strncpy(entry->name, name, 31);
    strncpy(entry->version, version, 15);
    entry->room = (INT32)gametype; 
    
    // Simple parsing of "IP:PORT"
    char tempAddr[64];
    strncpy(tempAddr, address, 63);
    char *portSep = strchr(tempAddr, ':');
    if (portSep) { 
        *portSep = '\0'; 
        strncpy(entry->ip, tempAddr, 15); 
        strncpy(entry->port, portSep + 1, 5); 
    } else { 
        strncpy(entry->ip, tempAddr, 15); 
        strncpy(entry->port, "5029", 5); 
    }
    web_server_count++;
}

EMSCRIPTEN_KEEPALIVE void SRB2_FinishServerList(void) {
    if (ms_ServerList) { free(ms_ServerList); ms_ServerList = NULL; }
    
    size_t allocSize = (NUM_LIST_SERVER + 1) * sizeof(msg_server_t);
    ms_ServerList = (msg_server_t *)malloc(allocSize);
    
    if (ms_ServerList) {
        memset(ms_ServerList, 0, allocSize);
        memcpy(ms_ServerList, web_server_buffer, web_server_count * sizeof(msg_server_t));
        CONS_Printf("Web: Loaded %d servers.\n", web_server_count);
    }
}
#endif