#!/bin/bash
source ./load-emsdk.sh

ROOT_DIR=$(pwd)
EM_TOOLCHAIN="$ROOT_DIR/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake"
VCPKG_INC="$ROOT_DIR/vcpkg_installed/wasm32-emscripten/include"
VCPKG_LIB="$ROOT_DIR/vcpkg_installed/wasm32-emscripten/lib"

mkdir -p build-wasm
cd build-wasm

# Using -O2 for the linker is often SAFER for OpenGL function pointers than -O3
emcmake cmake .. -DCMAKE_BUILD_TYPE=Release \
    -DUSE_GME=1 -DUSE_OPENMPT=1 -DUSE_UPNP=0 -DUSE_SDL2_NET=1 -DUSE_PHYSFS=0 -DUSE_ZLIB=1 -DUSE_LIBPNG=1 -DUSE_CURL=0 \
    -DSRB2_CONFIG_HWRENDER=ON \
    "-DCMAKE_C_FLAGS=-DEMSCRIPTEN -O3 -ffast-math -s USE_SDL=2 -s USE_SDL_IMAGE=2 -s USE_SDL_MIXER=2 -s USE_SDL_TTF=2 -s USE_ZLIB=1 -s USE_LIBPNG=1 -s ASYNCIFY=1 -I$VCPKG_INC" \
    "-DCMAKE_CXX_FLAGS=-DEMSCRIPTEN -O3 -ffast-math -I$VCPKG_INC" \
    "-DCMAKE_EXE_LINKER_FLAGS=-s GL_MAX_TEMP_BUFFER_SIZE=2097152 -s GL_PREINITIALIZED_CONTEXT=1 -O2 -s WASM_BIGINT=1 -s USE_SDL=2 -s USE_SDL_IMAGE=2 -s USE_SDL_MIXER=2 -s USE_SDL_TTF=2 -s USE_ZLIB=1 -s USE_LIBPNG=1 -s ASYNCIFY=1 -s INITIAL_MEMORY=536870912 -s MAXIMUM_MEMORY=2147483648 -s ALLOW_MEMORY_GROWTH=1 -s NO_EXIT_RUNTIME=1 -s USE_WEBGL2=1 -s LEGACY_GL_EMULATION=1 -s GL_UNSAFE_OPTS=0 -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString'] -L$VCPKG_LIB", \
    -DZLIB_FOUND=TRUE -DPNG_FOUND=TRUE \
    -DCMAKE_TOOLCHAIN_FILE="$EM_TOOLCHAIN"

emmake make -j$(nproc)