# Declare SDL2 interface sources
target_sources(SRB2SDL2 PRIVATE
    ogl_sdl.c
    i_threads.c
    i_net.c
    i_system.c
    i_main.c
    i_video.c
    dosstr.c
    endtxt.c
    hwsym_sdl.c
)

# Compiler Flags
if (NOT SRB2_CONFIG_FORCE_NO_MS_BITFIELDS)
    if ("${CMAKE_CXX_COMPILER_ID}" STREQUAL "GNU")
        check_cxx_compiler_flag("-mno-ms-bitfields" HAS_NO_MS_BITFIELDS)
        if(HAS_NO_MS_BITFIELDS)
            target_compile_options(SRB2SDL2 PRIVATE -mno-ms-bitfields)
        endif()
    endif()
endif()

if("${CMAKE_CXX_COMPILER_ID}" STREQUAL "MSVC")
    target_compile_definitions(SRB2SDL2 PRIVATE -D_CRT_SECURE_NO_WARNINGS)
endif()

target_compile_options(SRB2SDL2 PRIVATE
    $<$<AND:$<COMPILE_LANGUAGE:C>,$<C_COMPILER_ID:GNU>>:
        -Wall -Wno-trigraphs -W -Wfloat-equal -Wundef -Wpointer-arith
        -Wbad-function-cast -Wcast-qual -Wcast-align -Wwrite-strings
        -Wsign-compare -Wmissing-prototypes -Wmissing-declarations
        -Wmissing-noreturn -Winline -Wformat-y2k -Wformat-security
    >
    $<$<AND:$<COMPILE_LANGUAGE:C>,$<OR:$<C_COMPILER_ID:AppleClang>,$<C_COMPILER_ID:Clang>>>:
        -Wall -Wno-absolute-value -Wno-trigraphs -Wno-error=non-literal-null-conversion
        -Wno-error=constant-conversion -Wno-unused-but-set-variable
        -Wno-error=unused-but-set-variable -Wno-shorten-64-to-32
    >
)

# Platform specific sources
if("${CMAKE_SYSTEM_NAME}" MATCHES Windows)
    target_sources(SRB2SDL2 PRIVATE ../win32/win_dbg.c ../win32/Srb2win.rc)
endif()

if("${CMAKE_SYSTEM_NAME}" MATCHES Darwin)
    target_sources(SRB2SDL2 PRIVATE macosx/mac_alert.c macosx/mac_alert.h macosx/mac_resources.c macosx/mac_resources.h macosx/Srb2mac.icns)
endif()

# SDL2 Setup
if(EMSCRIPTEN)
    if(NOT TARGET SDL2::SDL2)
        add_library(SDL2::SDL2 INTERFACE IMPORTED)
    endif()
    if(NOT TARGET SDL2::SDL2main)
        add_library(SDL2::SDL2main INTERFACE IMPORTED)
    endif()
else()
    find_package(SDL2 CONFIG REQUIRED)
    find_package(SDL2 REQUIRED)
endif()

if(TARGET SDL2main)
    target_link_libraries(SRB2SDL2 PRIVATE SDL2main)
endif()

target_compile_definitions(SRB2SDL2 PRIVATE -DDIRECTFULLSCREEN -DHAVE_SDL)
target_include_directories(SRB2SDL2 PRIVATE ${SDL2_INCLUDE_DIR})

# --- SOUND DRIVER LOGIC START ---

# 1. Desktop: Find Mixer
if(NOT EMSCRIPTEN)
    find_package(SDL2_mixer_ext CONFIG QUIET)
    find_package(SDL2_mixer QUIET)
endif()

# 2. Web (EMSCRIPTEN): FORCE Mixer
if(EMSCRIPTEN)
    message(STATUS "Web Build: Forcing mixer_sound.c with HAVE_MIXER flag")
    
    # Use the mixer file
    target_sources(SRB2SDL2 PRIVATE mixer_sound.c)
    target_link_libraries(SRB2SDL2 PRIVATE SDL2::SDL2)
    
    # CRITICAL: Force the definitions so the C file is not empty!
    target_compile_definitions(SRB2SDL2 PUBLIC 
        -DHAVE_MIXER=1 
        -DHAVE_SDL=1 
        -D_LARGEFILE64_SOURCE
    )

# 3. Desktop: Logic based on found packages
elseif(TARGET SDL2_mixer_ext::SDL2_mixer_ext OR TARGET SDL2_mixer::SDL2_mixer)
    target_sources(SRB2SDL2 PRIVATE mixer_sound.c)
    target_link_libraries(SRB2SDL2 PRIVATE SDL2::SDL2)
else()
    target_sources(SRB2SDL2 PRIVATE sdl_sound.c)
    target_link_libraries(SRB2SDL2 PRIVATE SDL2::SDL2)
endif()

# --- SOUND DRIVER LOGIC END ---

# Image Libraries (PNG/ZLIB)
if(EMSCRIPTEN)
    target_compile_definitions(SRB2SDL2 PRIVATE -DHAVE_PNG -DHAVE_ZLIB)
else()
    if(TARGET ZLIB::ZLIB)
        target_compile_definitions(SRB2SDL2 PRIVATE -DHAVE_ZLIB)
    endif()
    if(TARGET PNG::PNG)
        target_compile_definitions(SRB2SDL2 PRIVATE -DHAVE_PNG)
        target_sources(SRB2SDL2 PRIVATE apng.c ${libapng_HEADER})
    endif()
    if(TARGET PNG::PNG)
        target_link_libraries(SRB2SDL2 PRIVATE PNG::PNG)
    elseif(TARGET ZLIB::ZLIB)
        target_link_libraries(SRB2SDL2 PRIVATE ZLIB::ZLIB)
    endif()
endif()

if("${CMAKE_SYSTEM_NAME}" MATCHES Darwin)
    install(TARGETS SRB2SDL2 BUNDLE DESTINATION .)
else()
    install(TARGETS SRB2SDL2 RUNTIME DESTINATION .)
endif()