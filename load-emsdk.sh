#!/bin/bash

git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

./emsdk install latest
./emsdk activate latest

cd ..

source ./emsdk/emsdk_env.sh
