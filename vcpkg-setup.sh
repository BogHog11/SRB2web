#!/bin/bash

./libs/vcpkg/bootstrap-vcpkg.sh

./libs/vcpkg/vcpkg install --triplet=wasm32-emscripten