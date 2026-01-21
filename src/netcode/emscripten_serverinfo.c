//Used to pass in server info for the relay server in SRB2 web.
//Simple c script created by gvbvdxx.

#ifdef EMSCRIPTEN
#include <emscripten.h>

#include "../g_game.h"
#include "../doomstat.h"
#include "../doomdef.h"
#include "../command.h"
#include "../i_threads.h"
#include "../m_menu.h"
#include "../z_zone.h"
#include "mserv.h"
#include "client_connection.h"

extern void SRB2_ServerInfoResponse(
    char *name,
    char *map,
    char *map_title
);

EMSCRIPTEN_KEEPALIVE
void SRB2_GetServerInfo(void)
{
    SRB2_ServerInfoResponse(
        (char *)cv_servername.string,
        G_BuildMapName(gamemap),
        G_BuildMapTitle(gamemap)
    );
}
#endif