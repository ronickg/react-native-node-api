#!/bin/bash

EXAMPLEAPP_DIR=$(dirname ${BASH_SOURCE[0]})
MONOREPO_ROOT=$(realpath "${EXAMPLEAPP_DIR}/../..")

# Make sure that the third-party directory exists
export THIRDPARTY_DIR="${MONOREPO_ROOT}/3rdparty"
mkdir -p "${THIRDPARTY_DIR}"

REACT_NATIVE_DIR="${MONOREPO_ROOT}/node_modules/react-native"

# Check if custom version of Hermes was downloaded
export REACT_NATIVE_OVERRIDE_HERMES_DIR="${THIRDPARTY_DIR}/hermes"
if [ ! -f "${REACT_NATIVE_OVERRIDE_HERMES_DIR}/hermes-engine.podspec" ]; then
  pushd "${THIRDPARTY_DIR}"
    git clone --recursive --depth 1 --branch node-api-for-react-native-0.79.0 https://github.com/kraenhansen/hermes.git
  popd
  # Copy hermes's JSI headers to the react-native directory
  cp -rf $THIRDPARTY_DIR/hermes/API/jsi/jsi/ $REACT_NATIVE_DIR/ReactCommon/jsi/jsi/
fi

# Install Pods
pushd "${EXAMPLEAPP_DIR}/ios"
  # Primitive check: Remove "old" Pods (if requested)
  if [ "$1" = "-r" ] || [ "$1" = '--reinstall' ]; then
    [[ -d Pods ]] && rm -rf Pods/
    [[ -d build ]] && rm -rf build/
  fi

  pod install
popd
