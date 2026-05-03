@echo off
if not exist "libs" mkdir libs
cd libs
git clone https://github.com/microsoft/vcpkg
cd ..
