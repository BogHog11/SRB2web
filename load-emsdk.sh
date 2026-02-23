#!/bin/bash
set -e

EMSDK_EXE="emsdk/emsdk"

# Check if the executable exists
if [ -f "$EMSDK_EXE" ]; then
    echo "emsdk found. Activating..."
    cd emsdk
    ./emsdk activate latest
    cd ..
else
    echo "emsdk not found or directory is empty. Cleaning and cloning..."
    # Remove empty/broken dir to prevent git clone failure
    rm -rf emsdk
    git clone https://github.com/emscripten-core/emsdk.git
    cd emsdk
    ./emsdk install latest
    ./emsdk activate latest
    cd ..
fi

# Source the environment
if [ -f "./emsdk/emsdk_env.sh" ]; then
    # We use 'source' so the variables persist in the current shell
    source ./emsdk/emsdk_env.sh
else
    echo "Error: emsdk_env.sh not found!"
    exit 1
fi
