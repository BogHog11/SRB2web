#!/bin/bash
./load-emsdk.sh

mkdir build-wasm
cd build-wasm

emcmake cmake .. \
    -DCMAKE_TOOLCHAIN_FILE=../libs/vcpkg/scripts/buildsystems/vcpkg.cmake \
    -DVCPKG_CHAINLOAD_TOOLCHAIN_FILE=$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake \
    -DVCPKG_TARGET_TRIPLET=wasm32-emscripten \
    -DSRB2_CONFIG_ENABLE_DISCORDRPC=OFF \
    -DSRB2_CONFIG_ENABLE_WEBM_MOVIES=OFF \
    -DCMAKE_BUILD_TYPE=Release \
    -DS_USE_SYSTEM_SDL2=ON \
    -DCMAKE_EXE_LINKER_FLAGS="-s USE_SDL=2 -s USE_SDL_MIXER=2 -s ASYNCIFY"

emmake make -j$(nproc)