#!/bin/bash
set -e

# Ensure we are in the root so paths are predictable
BASE_DIR=$(pwd)

# 1. Force export EMSDK variables just in case
export EMSDK="$BASE_DIR/emsdk"
export EMSDK_NODE="$EMSDK/node/22.16.0_64bit/bin/node"
export PATH="$EMSDK:$EMSDK/upstream/emscripten:$PATH"

# 2. Bootstrap vcpkg if not already done
if [ ! -f "libs/vcpkg/vcpkg" ]; then
    echo "Bootstrapping vcpkg..."
    ./libs/vcpkg/bootstrap-vcpkg.sh
fi

# 3. Install dependencies using the Emscripten triplet
# We pass the VCPKG_CHAINLOAD_TOOLCHAIN_FILE manually to help vcpkg find Emscripten
./libs/vcpkg/vcpkg install \
    --triplet=wasm32-emscripten \
    --x-cmake-args="-DVCPKG_CHAINLOAD_TOOLCHAIN_FILE=$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake"
