#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Define paths
BUILD_DIR="build"

# Check if Emscripten environment is active
if ! command -v emcmake &> /dev/null; then
    echo "Error: Emscripten tools (emcmake) not found."
    echo "Please run: source /path/to/emsdk/emsdk_env.sh"
    exit 1
fi

echo "--- Preparing Build Directory ---"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

echo "--- Configuring with Emscripten (CMake) ---"

emcmake cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DUSE_GME=0 \
    -DUSE_OPENMPT=0 \
    -DUSE_UPNP=0 \
    -DUSE_SDL2_NET=0 \
    -DUSE_PHYSFS=0 \
    -DUSE_ZLIB=1 \
    -DUSE_LIBPNG=1 \
    -DUSE_CURL=0 \
    \
    -DCMAKE_C_FLAGS="-s USE_SDL=2 -s USE_SDL_IMAGE=2 -s USE_SDL_MIXER=2 -s USE_SDL_TTF=2 -s USE_ZLIB=1 -s USE_LIBPNG=1 -s ASYNCIFY=1" \
    -DCMAKE_EXE_LINKER_FLAGS="-s USE_SDL=2 -s USE_SDL_IMAGE=2 -s USE_SDL_MIXER=2 -s USE_SDL_TTF=2 -s USE_ZLIB=1 -s USE_LIBPNG=1 -s ASYNCIFY=1 -s ALLOW_MEMORY_GROWTH=1" \
    \
    -DZLIB_FOUND=TRUE \
    -DZLIB_INCLUDE_DIR="$EMSDK/upstream/emscripten/cache/sysroot/include" \
    -DZLIB_LIBRARY=zlib \
    \
    -DPNG_FOUND=TRUE \
    -DPNG_PNG_INCLUDE_DIR="$EMSDK/upstream/emscripten/cache/sysroot/include" \
    -DPNG_LIBRARY=png \
    \
    -DCURL_FOUND=TRUE \
    -DCURL_INCLUDE_DIR="/workspaces/SRB2/libs/curl/include" \
    -DCURL_LIBRARY=curl \
    \
    -DSDL2_FOUND=TRUE \
    -DSDL2_LIBRARIES=SDL2 \
    -DSDL2_DIR="$EMSDK/upstream/emscripten/cache/sysroot/lib/cmake/SDL2" \
    -DSDL2_CONFIG_INCLUDE_DIR="$EMSDK/upstream/emscripten/cache/sysroot/include"

echo "--- Configuration Successful ---"

echo "--- Generating Valid Mock Library ---"
echo "int dummy_symbol = 0;" > dummy.c
emcc -c dummy.c -o dummy.o
rm -f libSDL2_mock.a
emar rcs libSDL2_mock.a dummy.o
rm dummy.c dummy.o
echo "Mock library fixed."

echo "--- Starting Compilation ---"
emmake make -j $(nproc)
echo "--- Build Complete! ---"