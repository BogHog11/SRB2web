# Sonic Robo Blast 2 Web (SRB2web)

_**Web Version: 2.2.15**_

[Sonic Robo Blast 2](https://srb2.org/) is a 3D Sonic the Hedgehog fangame based on a modified version of [Doom Legacy](http://doomlegacy.sourceforge.net/).

[See live site here.](https://gvbvdxxalt2.github.io/SRB2web)

A port of the game for WASM (WebAssembly) using Emscripten, fully supporting LAN & online multiplayer through its [Relay Server](https://github.com/gvbvdxxalt2/SRB2Web-Relay).

---

## Compilation Instructions

Below are the instructions for compiling the Sonic Robo Blast 2 (SRB2) WASM files and building the launcher website.

### Prerequisites
* **Windows**: Git for Windows, CMake, Python 3.x, and a C++ toolchain (Visual Studio).
* **Linux**: `sudo apt install git cmake build-essential python3`
* **Node.js**: Required for the launcher website.

---

### 1. Compiling the WASM Files

#### Executing on Windows
1. Open the **Command Prompt** (`cmd.exe`).
2. Navigate to your source directory:
   ```cmd
   cd path\to\srb2-source
   ```
3. Run the setup and build script:
   ```cmd
   setup-build.bat
   ```

#### Executing on Linux
1. Open your terminal.
2. Navigate to your source directory:
   ```bash
   cd path/to/srb2-source
   ```
3. Run the setup script (this handles cloning and builds the engine):
   ```bash
   chmod +x *.sh
   source ./setup-build.sh
   ```

4. To rebuild later without running the full setup:
   ```bash
   source ./load-emsdk.sh
   ./build-wasm.sh
   ```

---

### 2. Building the Launcher Website

This should work on both Windows and Linux.

1. Install Node.js dependencies:
   ```bash
   npm install
   ```
2. Build the launcher:
   ```bash
   npm run build
   ```
3. Start the dev server:
   ```bash
   npm run start
   ```

> **Note for Developers:** If you modify the **C source code**, you must re-run `setup-build.sh` (or `build-wasm.sh`) to recompile the engine. The Node server only watches frontend files.

---

## Directory Structure

| Path | Description |
| :--- | :--- |
| [`/src`](./src) | Core C code for **SRB2** and the modified engine. |
| [`/game-assets`](./game-assets) | Source files for game data (textures, sounds, etc.). |
| [`/launcher-src`](./launcher-src) | Source code for the web launcher and file manager. |
| [`/static`](./static) | Static assets, icons, and images for the launcher. |
| `/launcher-dist` | The production-ready web build (generated via `npm run build`). |

---

## Post-Build Notes
* **Environment Handling**: The scripts now check if `emsdk` or `libs/vcpkg` directories are empty and will automatically attempt to repair/clone them if needed.
* **Node.js Path**: If Emscripten uses a different Node version than expected, update the path in your build scripts.
* **Output**: Compiled `srb2.js` and `srb2.wasm` will be in the `build-wasm` directory.

---

## Sites

 - [Vercel](https://gvbvdxx-srb2-web.vercel.app/)
 - [Github Pages](https://gvbvdxxalt2.github.io/SRB2web/)
 - [Netlify](https://gvbvdxx-srb2web.netlify.app/)
