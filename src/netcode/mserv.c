// SONIC ROBO BLAST 2
// ... (Copyright headers same as before)
// ...

#include "../doomstat.h"
#include "../doomdef.h"
#include "../command.h"
#include "../i_threads.h"
#include "mserv.h"
#include "client_connection.h"
#include "../m_menu.h"
#include "../z_zone.h"

// --- EMSCRIPTEN IMPORTS ---
#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <stdlib.h>
#include <string.h>

// 1. DEFINE THE BRIDGE DIRECTLY IN C
// This creates a C function 'JS_RequestServerList' that executes the JS code inside {}.
// We use 'Module.fetchServerList()' so we don't depend on the global 'window' object.
EM_JS(void, JS_RequestServerList, (void), {
    if (Module.fetchServerList) {
        console.log("C is calling Module.fetchServerList()...");
        Module.fetchServerList();
    } else {
        console.error("CRITICAL: Module.fetchServerList is undefined. Make sure you attach it in your JS!");
    }
});
#endif
// --------------------------

// ... (Rest of standard includes/variables) ...

#ifdef MASTERSERVER
// ... (Variables like MSId, MSRegisteredId, etc.) ...
static void Command_Listserv_f(void);
#endif

// ... (Consvars cv_masterserver, etc.) ...

static INT16 ms_RoomId = -1;
msg_server_t *ms_ServerList; // Global pointer for the list
msg_rooms_t room_list[NUM_LIST_ROOMS+1]; 

// ... (AddMServCommands function) ...

#ifdef MASTERSERVER

static void WarnGUI (void)
{
    I_lock_mutex(&m_menu_mutex);
    M_StartMessage(M_GetText("No servers found or\nMaster Server offline.\n"), NULL, MM_NOTHING);
    I_unlock_mutex(m_menu_mutex);
}

#define NUM_LIST_SERVER MAXSERVERLIST

// ==========================================================
//  1. GET SERVER LIST
// ==========================================================
msg_server_t *GetShortServersList(INT32 room, int id)
{
    msg_server_t *server_list;
    server_list = malloc(( NUM_LIST_SERVER + 1 ) * sizeof *server_list);
    memset(server_list, 0, (NUM_LIST_SERVER + 1) * sizeof *server_list);

#ifdef __EMSCRIPTEN__
    // Trigger the Webpack JS function
    JS_RequestServerList();

    // If JS has already finished fetching and called SRB2_FinishServerList,
    // we will have data in ms_ServerList. Copy it.
    if (ms_ServerList)
    {
        memcpy(server_list, ms_ServerList, NUM_LIST_SERVER * sizeof(msg_server_t));
    }
    // Return the list (even if empty) so the menu doesn't crash
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
//  2. GET ROOMS LIST
//  (This MUST return 1, otherwise you get <UNLISTED MODE>)
// ==========================================================
INT32 GetRoomsList(boolean hosting, int id)
{
#ifdef __EMSCRIPTEN__
    // Hardcode the rooms so the menu allows entry
    memset(room_list, 0, sizeof(room_list));
    int i = 0;

    room_list[i].id = 0; 
    strncpy(room_list[i].name, "All Servers", 63);
    strncpy(room_list[i].motd, "All active games.", 255);
    i++;

    room_list[i].id = 1;
    strncpy(room_list[i].name, "Standard", 63);
    strncpy(room_list[i].motd, "Normal gameplay.", 255);
    i++;

    room_list[i].id = -1; // Terminator
    return 1; // RETURN SUCCESS
#else
    if (HMS_fetch_rooms( ! hosting, id)) return 1;
    else { WarnGUI(); return -1; }
#endif
}

// ... (Keep the rest of the file logic: GetMODVersion, Finish_registration, etc.) ...
// ... (Use the same file content provided in previous steps for the rest) ...

static void Command_Listserv_f(void)
{
    CONS_Printf(M_GetText("Retrieving server list...\n"));
#ifdef __EMSCRIPTEN__
    JS_RequestServerList();
#endif
    HMS_list_servers();
}

// ... (Keep generic definitions for RegisterServer/UnregisterServer) ...

// --------------------------------------------------------------------------
// WEB BROWSER INTEGRATION (Callbacks)
// --------------------------------------------------------------------------
#ifdef __EMSCRIPTEN__
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
    
    size_t allocSize = (web_server_count + 1) * sizeof(msg_server_t);
    ms_ServerList = (msg_server_t *)malloc(allocSize);
    
    if (ms_ServerList) {
        memset(ms_ServerList, 0, allocSize);
        memcpy(ms_ServerList, web_server_buffer, web_server_count * sizeof(msg_server_t));
        CONS_Printf("Web: Loaded %d servers.\n", web_server_count);
    }
}
#endif