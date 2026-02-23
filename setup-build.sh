#!/bin/bash

if [ -d "libs/vcpkg" ]; then
  echo "libs/vcpkg is already setup"
else
  cd libs
  git clone https://github.com/microsoft/vcpkg
  cd ../
fi

source ./load-emsdk.sh
./vcpkg-setup.sh

./build-wasm.sh
