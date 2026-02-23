#!/bin/bash
set -e

VCPKG_PATH="libs/vcpkg"

# Check if the vcpkg directory exists and actually has a .git folder
if [ -d "$VCPKG_PATH/.git" ]; then
    echo "libs/vcpkg is already setup."
else
    echo "Cloning vcpkg into $VCPKG_PATH..."
    # No need to cd; git clone can take a target directory
    git clone https://github.com/microsoft/vcpkg "$VCPKG_PATH"
fi

# Ensure scripts are executable
chmod +x ./vcpkg-setup.sh ./build-wasm.sh

source ./load-emsdk.sh
./vcpkg-setup.sh
./build-wasm.sh
