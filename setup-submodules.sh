if [ -d "vcpkg" ]; then
  echo "vcpkg is already setup"
else
  git clone https://github.com/microsoft/vcpkg
fi

source ./load-emsdk.sh
./vcpkg-setup.sh

./build-wasm.sh
