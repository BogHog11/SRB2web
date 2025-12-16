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

// --- EMSCRIPTEN SPECIFIC INCLUDES & GLOBALS ---
#ifdef EMSCRIPTEN
#include <emscripten.h>

// Global buffer to store servers received from WebSocket
static msg_server_t emscripten_server_buffer[MAXSERVERLIST];
static int emscripten_server_count = 0;

// Forward declaration
void SRB2_ClearServerList(void);
void SRB2_AddServerToList(char* address, char* name, char* version, int players, int maxplayers, int ping);
void SRB2_FinishServerList(void);

// 1. The Bridge: Calls the JS function "JS_RequestServerList()"
EM_JS(void, JS_RequestServerList_Bridge, (void), {
    if (typeof JS_RequestServerList === 'function') {
        JS_RequestServerList();
    } else {
        console.error("JS_RequestServerList is not defined! Check your HTML/JS.");
    }
});

// 2. Callback: JS calls this to wipe the list before adding new ones
EMSCRIPTEN_KEEPALIVE
void SRB2_ClearServerList(void) {
    emscripten_server_count = 0;
    memset(emscripten_server_buffer, 0, sizeof(emscripten_server_buffer));
    CONS_Printf("Web: Cleared server list buffer.\n");
}

// 3. Callback: JS calls this for every server
EMSCRIPTEN_KEEPALIVE
void SRB2_AddServerToList(char* address, char* name, char* version, int players, int maxplayers, int ping) {
    if (emscripten_server_count >= MAXSERVERLIST) return;

    msg_server_t *info = &emscripten_server_buffer[emscripten_server_count];

    // IMPORTANT: 'address' is the Room ID from the Relay
    strncpy(info->ip, address, sizeof(info->ip) - 1);
    
    // Default port string (Required by struct)
    strncpy(info->port, "5029", sizeof(info->port) - 1);

    // Corrected: Use 'name' instead of 'servername'
    strncpy(info->name, name, sizeof(info->name) - 1);
    
    // Version string
    strncpy(info->version, version, sizeof(info->version) - 1);
    
    // Set default room (Required by struct)
    info->room = 1;

    // NOTE: We cannot store players/ping here because msg_server_t 
    // does not have those fields. The game will query them later 
    // via PT_SERVERINFO packets if needed.
    (void)players;
    (void)maxplayers;
    (void)ping;

    emscripten_server_count++;
}

// 4. Callback: JS calls this when done
EMSCRIPTEN_KEEPALIVE
void SRB2_FinishServerList(void) {
    web_list_pending = false; // We are done!
    CONS_Printf("Web: Received %d servers from Relay.\n", emscripten_server_count);
}
#endif
// ----------------------------------------------

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

static INT16 ms_RoomId = -1;

int           ms_QueryId;
I_mutex       ms_QueryId_mutex;

msg_server_t *ms_ServerList;
I_mutex       ms_ServerList_mutex;

UINT16 current_port = 0;

msg_rooms_t room_list[NUM_LIST_ROOMS+1]; // +1 for easy test

static boolean web_list_pending = false;

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
    M_StartMessage(M_GetText("There was a problem connecting to\nthe Master Server\n\nCheck the console for details.\n"), NULL, MM_NOTHING);
    I_unlock_mutex(m_menu_mutex);
}

#define NUM_LIST_SERVER MAXSERVERLIST
msg_server_t *GetShortServersList(INT32 room, int id)
{
    msg_server_t *server_list;

    // +1 for easy test
    server_list = malloc(( NUM_LIST_SERVER + 1 ) * sizeof *server_list);

#ifdef EMSCRIPTEN
    // Case 1: We have data in the buffer! Return it.
    if (emscripten_server_count > 0)
    {
        CONS_Printf("Web: Returning %d servers to menu.\n", emscripten_server_count);
        memcpy(server_list, emscripten_server_buffer, emscripten_server_count * sizeof(msg_server_t));
        
        // Terminate the list with an empty entry
        if (emscripten_server_count < NUM_LIST_SERVER)
            memset(&server_list[emscripten_server_count], 0, sizeof(msg_server_t));
            
        return server_list;
    }

    // Case 2: No data yet.
    // If we haven't asked recently, ask JS now.
    if (!web_list_pending) 
    {
        CONS_Printf("Web: Requesting server list from JS...\n");
        web_list_pending = true; // Mark that we are waiting
        JS_RequestServerList_Bridge(); 
    }
    
    // Always return an empty list while waiting. 
    // The user will see "Searching..." or an empty table.
    // They must press "Refresh" or wait for the menu's auto-refresh ticker.
    memset(server_list, 0, (NUM_LIST_SERVER + 1) * sizeof *server_list);
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

INT32 GetRoomsList(boolean hosting, int id)
{
#ifdef EMSCRIPTEN
    return 1;
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
#ifdef EMSCRIPTEN
    return NULL; 
#else
    char *buffer;
    int c;

    (void)id;

    buffer = malloc(16);

    c = HMS_compare_mod_version(buffer, 16);

    I_lock_mutex(&ms_QueryId_mutex);
    {
        if (id != ms_QueryId)
            c = -1;
    }
    I_unlock_mutex(ms_QueryId_mutex);

    if (c > 0)
        return buffer;
    else
    {
        free(buffer);

        if (! c)
            WarnGUI();

        return NULL;
    }
#endif
}

void GetMODVersion_Console(void)
{
#ifndef EMSCRIPTEN
    char buffer[16];

    if (HMS_compare_mod_version(buffer, sizeof buffer) > 0)
        I_Error(UPDATE_ALERT_STRING_CONSOLE, VERSIONSTRING, buffer);
#endif
}
#endif

static void Command_Listserv_f(void)
{
    CONS_Printf(M_GetText("Retrieving server list...\n"));

#ifdef EMSCRIPTEN
    // Trigger update
    JS_RequestServerList_Bridge();
    
    // Print current cache
    if (emscripten_server_count == 0) {
        CONS_Printf("List requested. Please wait and type 'listserv' again.\n");
    } else {
        int i;
        for (i = 0; i < emscripten_server_count; i++) {
             // Corrected: Removed references to fields that don't exist
             CONS_Printf("#%d: %s (%s)\n", 
                i+1, 
                emscripten_server_buffer[i].name,
                emscripten_server_buffer[i].ip
             );
        }
    }
#else
    {
        HMS_list_servers();
    }
#endif
}

static void
Finish_registration (void)
{
#ifdef EMSCRIPTEN
    MSRegistered = true;
    MSRegisteredId = MSId;
    time(&MSLastPing);
    CONS_Printf("Web: Implicitly registered via WebSocket.\n");
#else
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

    if (registered)
        CONS_Printf("Master server registration successful.\n");
#endif
}

static void
Finish_update (void)
{
#ifdef EMSCRIPTEN
    MSRegistered = true;
#else
    int registered;
    int done;

    Lock_state();
    {
        registered = MSRegistered;
        MSUpdateAgain = false;
    }
    Unlock_state();

    if (registered)
    {
        if (HMS_update())
        {
            Lock_state();
            {
                time(&MSLastPing);
                MSRegistered = true;
            }
            Unlock_state();

            CONS_Printf("Updated master server listing.\n");
        }
        else
            Finish_registration();
    }
    else
        Finish_registration();

    Lock_state();
    {
        done = ! MSUpdateAgain;

        if (done)
            MSInProgress = false;
    }
    Unlock_state();

    if (! done)
        Finish_update();
#endif
}

static void
Finish_unlist (void)
{
#ifdef EMSCRIPTEN
    MSRegistered = false;
#else
    int registered;

    Lock_state();
    {
        registered = MSRegistered;
    }
    Unlock_state();

    if (registered)
    {
        CONS_Printf("Removing this server from the master server...\n");

        if (HMS_unlist())
            CONS_Printf("Server deregistration request successfully sent.\n");

        Lock_state();
        {
            MSRegistered = false;
        }
        Unlock_state();

        I_wake_all_cond(&MSCond);
    }

    Lock_state();
    {
        if (MSId == MSRegisteredId)
            MSId++;
    }
    Unlock_state();
#endif
}

static int *
Server_id (void)
{
    int *id;
    id = malloc(sizeof *id);
    Lock_state();
    {
        *id = MSId;
    }
    Unlock_state();
    return id;
}

static int *
New_server_id (void)
{
    int *id;
    id = malloc(sizeof *id);
    Lock_state();
    {
        *id = ++MSId;
        I_wake_all_cond(&MSCond);
    }
    Unlock_state();
    return id;
}

static void
Register_server_thread (int *id)
{
    int same;

    Lock_state();
    {
        while (*id == MSId && MSRegistered)
            I_hold_cond(&MSCond, MSMutex);

        same = ( *id == MSId );
    }
    Unlock_state();

    if (same)
        Finish_registration();

    free(id);
}

static void
Update_server_thread (int *id)
{
    int same;

    Lock_state();
    {
        same = ( *id == MSRegisteredId );
    }
    Unlock_state();

    if (same)
        Finish_update();

    free(id);
}

static void
Unlist_server_thread (int *id)
{
    int same;

    Lock_state();
    {
        same = ( *id == MSRegisteredId );
    }
    Unlock_state();

    if (same)
        Finish_unlist();

    free(id);
}

static void
Change_masterserver_thread (char *api)
{
    Lock_state();
    {
        while (MSRegistered)
            I_hold_cond(&MSCond, MSMutex);
    }
    Unlock_state();
    
#ifndef EMSCRIPTEN
    HMS_set_api(api);
#endif
}

void RegisterServer(void)
{
#ifdef EMSCRIPTEN
    Finish_registration();
#else
    if (I_can_thread())
    {
        void *nsid = New_server_id();
        if (!I_spawn_thread(
                "register-server",
                (I_thread_fn)Register_server_thread,
                nsid
        ))
        {
            free(nsid);
        }
    }
    else
    {
        Finish_registration();
    }
#endif
}

static void UpdateServer(void)
{
#ifdef EMSCRIPTEN
    Finish_update();
#else
    if (I_can_thread())
    {
        void *sid = Server_id();
        if (!I_spawn_thread(
                "update-server",
                (I_thread_fn)Update_server_thread,
                sid
        ))
        {
            free(sid);
        }
    }
    else
    {
        Finish_update();
    }
#endif
}

void UnregisterServer(void)
{
#ifdef EMSCRIPTEN
    Finish_unlist();
#else
    if (I_can_thread())
    {
        if (!I_spawn_thread(
                "unlist-server",
                (I_thread_fn)Unlist_server_thread,
                Server_id()
        ))
        {
            ;
        }
    }
    else
    {
        Finish_unlist();
    }
#endif
}

static boolean Online(void)
{
    return ( serverrunning && cv_masterserver_room_id.value > 0 );
}

static inline void SendPingToMasterServer(void)
{
    int ready;
    time_t now;

    if (Online())
    {
        time(&now);

        Lock_state();
        {
            ready = (
                    MSRegisteredId == MSId &&
                    ! MSInProgress &&
                    now >= ( MSLastPing + 60 * cv_masterserver_update_rate.value )
            );

            if (ready)
                MSInProgress = true;
        }
        Unlock_state();

        if (ready)
            UpdateServer();
    }
}

void MasterClient_Ticker(void)
{
    SendPingToMasterServer();
}

static void
Set_api (const char *api)
{
#ifdef EMSCRIPTEN
    (void)api;
#else
    char *dapi = strdup(api);
    if (I_can_thread())
    {
        if (!I_spawn_thread(
                "change-masterserver",
                (I_thread_fn)Change_masterserver_thread,
                dapi
        ))
        {
            free(dapi);
        }
    }
    else
    {
        HMS_set_api(dapi);
    }
#endif
}
#else /*MASTERSERVER*/

void RegisterServer(void) {}
void UnregisterServer(void) {}

#endif

static boolean ServerName_CanChange(const char* newvalue)
{
    if (strlen(newvalue) < MAXSERVERNAME)
        return true;

    CONS_Alert(CONS_NOTICE, "The server name must be shorter than %d characters\n", MAXSERVERNAME);
    return false;
}

static void
Update_parameters (void)
{
#ifdef MASTERSERVER
    int registered = 0;
    int delayed;

    if (Online())
    {
        Lock_state();
        {
            delayed = MSInProgress;

            if (delayed)
                MSUpdateAgain = true;
            else
                registered = MSRegistered;
        }
        Unlock_state();

        if (! delayed && registered)
            UpdateServer();
    }
#endif/*MASTERSERVER*/
}

static void RoomId_OnChange(void)
{
    if (ms_RoomId != cv_masterserver_room_id.value)
    {
        UnregisterServer();
        ms_RoomId = cv_masterserver_room_id.value;
#ifdef MASTERSERVER
        if (Online())
#endif
            RegisterServer();
    }
}

static void MasterServer_OnChange(void)
{
#ifdef MASTERSERVER
    UnregisterServer();

    if (
            ! cv_masterserver.changed &&
            strcmp(cv_masterserver.string, "ms.srb2.org:28900") == 0
    ){
        CV_StealthSet(&cv_masterserver, cv_masterserver.defaultvalue);
    }

    if (
            ! cv_masterserver.changed &&
            strcmp(cv_masterserver.string, "https://mb.srb2.org/MS/0") == 0
    ){
        CV_StealthSet(&cv_masterserver, cv_masterserver.defaultvalue);
    }

    Set_api(cv_masterserver.string);

    if (Online())
        RegisterServer();
#endif/*MASTERSERVER*/
}