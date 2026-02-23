#!/bin/bash
set -e

# Get the absolute path of the project root
ROOT_DIR=$(pwd)

# Define the path to the Emscripten toolchain file
# This is the "magic link" vcpkg needs to work in a Codespace
EMSCRIPTEN_TOOLCHAIN="$ROOT_DIR/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake"

echo "Setting up vcpkg for WebAssembly..."

# 1. Bootstrap vcpkg if the executable is missing
if [ ! -f "libs/vcpkg/vcpkg" ]; then
    ./libs/vcpkg/bootstrap-vcpkg.sh
fi

# 2. Install dependencies
# We explicitly pass the toolchain file to fix the 'Error Code 1' you encountered
./libs/vcpkg/vcpkg install \
    --triplet=wasm32-emscripten \
    --x-cmake-args="-DVCPKG_CHAINLOAD_TOOLCHAIN_FILE=$EMSCRIPTEN_TOOLCHAIN"

echo "vcpkg setup complete."
