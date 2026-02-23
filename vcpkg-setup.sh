#!/bin/bash
set -e

ROOT_DIR=$(pwd)
VCPKG_EXE="./libs/vcpkg/vcpkg"
EM_TOOLCHAIN="$ROOT_DIR/emsdk/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake"

# 1. Bootstrap vcpkg if needed
if [ ! -f "$VCPKG_EXE" ]; then
    echo "Bootstrapping vcpkg..."
    ./libs/vcpkg/bootstrap-vcpkg.sh
fi

echo "Running vcpkg install in Manifest Mode..."

# 2. The Fix: 
# - We removed --editable.
# - We explicitly point to the triplet.
# - We pass the Emscripten toolchain to CMake.
$VCPKG_EXE install \
    --triplet=wasm32-emscripten \
    --x-install-root="$ROOT_DIR/vcpkg_installed" \
    --x-cmake-args="-DVCPKG_CHAINLOAD_TOOLCHAIN_FILE=$EM_TOOLCHAIN"

echo "vcpkg setup complete."
