@echo off
REM Load Emscripten SDK on Windows

if exist emsdk (
    echo emsdk already exists, activating latest.
    cd emsdk
    emsdk activate latest
    cd ..
) else (
    git clone https://github.com/emscripten-core/emsdk.git
    cd emsdk
    emsdk install latest
    emsdk activate latest
    cd ..
)

REM Source the environment (for Windows, assume emsdk_env.bat is called)
if exist emsdk\emsdk_env.bat (
    call emsdk\emsdk_env.bat
) else (
    echo emsdk_env.bat not found. Please check emsdk installation.
    exit /b 1
)