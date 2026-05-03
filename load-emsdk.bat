@echo off
set "EMSDK_BAT=emsdk\emsdk.bat"

if exist "%EMSDK_BAT%" (
    echo emsdk found. Activating...
    cd emsdk
    call emsdk.bat activate latest
    cd ..
) else (
    echo emsdk not found or empty. Initializing...
    :: Remove empty directory if it exists
    if exist "emsdk" rd /s /q emsdk
    
    git clone https://github.com/emscripten-core/emsdk.git
    cd emsdk
    call emsdk.bat install latest
    call emsdk.bat activate latest
    cd ..
)

:: Environment setup for Windows
if exist "emsdk\emsdk_env.bat" (
    call emsdk\emsdk_env.bat
) else (
    echo Error: emsdk_env.bat not found!
    pause
    exit /b 1
)
