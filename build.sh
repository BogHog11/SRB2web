#!/bin/bash

# Configuration Variables
EMSDK_ROOT="emsdk"  # <-- **EDIT THIS PATH**
BUILD_DIR="build"
BIN_DIR="build/bin"

# -----------------------------------------------------------------------------
# 1. Setup Emscripten Environment
# -----------------------------------------------------------------------------
if [ -d "$EMSDK_ROOT" ]; then
    source "$EMSDK_ROOT/emsdk_env.sh"
else
    echo "ERROR: EMSDK_ROOT not found at $EMSDK_ROOT"
    exit 1
fi

# -----------------------------------------------------------------------------
# 2. Cleanup Old Builds
# -----------------------------------------------------------------------------
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# -----------------------------------------------------------------------------
# 3. CMake Configuration
# -----------------------------------------------------------------------------
# We use standard Emscripten compiler/linker options and disable features
# that are problematic in a browser environment (like HTTP/CURL and TCP).

emcmake cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_FLAGS="-s USE_SDL=2 -s ASYNCIFY=1 -s ALLOW_MEMORY_GROWTH=1 -s FORCE_FILESYSTEM=1" \
    -DCMAKE_EXE_LINKER_FLAGS="-s USE_SDL=2 -s ASYNCIFY=1 -s ALLOW_MEMORY_GROWTH=1 -s FORCE_FILESYSTEM=1 -lidbfs.js" \
    -DCURL=OFF \
    -DBUILD_SERVER=OFF \
    -DSRB2_SYSTEM_TYPE=WEB

# -----------------------------------------------------------------------------
# 4. Compile the Game
# -----------------------------------------------------------------------------
emmake make -j$(nproc)

# -----------------------------------------------------------------------------
# 5. Final Output
# -----------------------------------------------------------------------------
cd ..
if [ -f "$BIN_DIR/srb2" ]; then
    # Emscripten names the output 'srb2.js' and 'srb2.wasm' by default, 
    # but the executable name remains 'srb2' for the build system.
    echo ""
    echo "✅ Build Successful!"
    echo "Output files: $BIN_DIR/srb2.js and $BIN_DIR/srb2.wasm"
else
    echo ""
    echo "❌ Build FAILED."
fi