@echo off
set "VCPKG_PATH=libs\vcpkg"

:: Check if the .git folder exists to verify vcpkg installation
if exist "%VCPKG_PATH%\.git\" (
    echo libs/vcpkg is already setup.
) else (
    echo vcpkg not found or empty. Cloning...
    git clone https://github.com/microsoft/vcpkg "%VCPKG_PATH%"
    if %ERRORLEVEL% neq 0 (
        echo Error: Git clone failed.
        exit /b %ERRORLEVEL%
    )
)

echo.
echo Starting build steps...

:: 'call' is required so the window doesn't close after the first script runs
call load-emsdk.bat
call vcpkg-setup.bat
call build-wasm.bat

echo Build process complete.
pause
