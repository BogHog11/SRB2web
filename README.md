# Sonic Robo Blast 2 Web (SRB2web)
[Sonic Robo Blast 2](https://srb2.org/) is a 3D Sonic the Hedgehog fangame based on a modified version of [Doom Legacy](http://doomlegacy.sourceforge.net/).

[See live site here.](https://gvbvdxxalt2.github.io/SRB2web)

A port of the game for WASM (WebAssembly) using Emscripten, fully supporting LAN & online multiplayer through its [Relay Server](https://github.com/gvbvdxxalt2/SRB2Web-Relay).

The game can forward data either directly through the relay server or via WebRTC.

[Instructions for setting up the Relay server are here.](https://github.com/gvbvdxxalt2/SRB2Web-Relay)

## Disclaimer
Sonic Team Junior & Gvbvdxx are in no way affiliated with SEGA or Sonic Team. We do not claim ownership of any of SEGA's intellectual property used in SRB2.

## SRB2 WebAssembly (WASM) Compilation Files & Instructions

Below are the Windows batch files corresponding to your Linux shell scripts, followed by the instructions for compiling Sonic Robo Blast 2 (SRB2) on both platforms.

## Compilation Instructions

### Prerequisites
* **Windows**: Git for Windows, CMake, Python 3.x, and a C++ toolchain (Visual Studio Community or MinGW).
* **Linux**: `sudo apt install git cmake build-essential python3`

### Executing on Windows
1. Open the **Command Prompt** (`cmd.exe`). *Do not use PowerShell, as it handles batch file variables differently.*
2. Navigate to your SRB2 source directory:
   ```cmd
   cd path\to\srb2-source
   ```
3. Run the vcpkg cloning script:
   ```cmd
   call clone-vcpkg.bat
   ```
4. Run the build script (this automatically calls `load-emsdk.bat`):
   ```cmd
   call build-wasm.bat
   ```

### Executing on Linux
1. Open your terminal.
2. Navigate to your SRB2 source directory:
   ```bash
   cd path/to/srb2-source
   ```
3. Make the scripts executable:
   ```bash
   chmod +x *.sh
   ```
4. Run the vcpkg cloning script:
   ```bash
   ./clone-vcpkg.sh
   ```
5. Run the build script (this automatically sources `load-emsdk.sh`):
   ```bash
   ./build-wasm.sh
   ```

---

## 3. Post-Build Notes
* **Node.js Path Dependency**: The CMake command hardcodes the path to Node.js as `../emsdk/node/22.16.0_64bit/bin/node`. If your Emscripten SDK downloads a different version of Node.js, you will need to update this path in `build-wasm.sh` or `build-wasm.bat`.
* **Output Files**: Upon a successful compilation, your `srb2.js` and `srb2.wasm` files will be located in the `build-wasm` directory. Remember to provide the base SRB2 `.pk3` files when hosting the web build.
