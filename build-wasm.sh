#!/bin/bash
source ./load-emsdk.sh

mkdir -p build-wasm
cd build-wasm

# Let vcpkg's toolchain handle the library discovery
VCPKG_TOOLCHAIN="../libs/vcpkg/scripts/buildsystems/vcpkg.cmake"
EM_TOOLCHAIN="../emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake"

emcmake cmake .. -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_TOOLCHAIN_FILE="$VCPKG_TOOLCHAIN" \
    -DVCPKG_CHAINLOAD_TOOLCHAIN_FILE="$EM_TOOLCHAIN" \
    -DVCPKG_TARGET_TRIPLET=wasm32-emscripten \
    -DUSE_ZLIB=1 -DUSE_LIBPNG=1 \
    -DASYNCIFY=1 \
    -DALLOW_MEMORY_GROWTH=1

emmake make -j$(nproc)