@echo off
REM Setup vcpkg on Windows

if exist libs\vcpkg\vcpkg.exe (
    echo vcpkg already bootstrapped, skipping bootstrap.
) else (
    call libs\vcpkg\bootstrap-vcpkg.bat
)

libs\vcpkg\vcpkg install --triplet=wasm32-emscripten