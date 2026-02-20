@echo off
if exist "emsdk\" (
    echo emsdk already exists, skipping clone.
    cd emsdk
    call emsdk activate latest
    cd ..
) else (
    git clone https://github.com/emscripten-core/emsdk.git
    cd emsdk
    call emsdk install latest
    call emsdk activate latest
    cd ..
)

if exist "emsdk\emsdk_env.bat" (
    call .\emsdk\emsdk_env.bat
) else (
    echo emsdk_env.bat not found. Please check emsdk installation.
    exit /b 1
)
