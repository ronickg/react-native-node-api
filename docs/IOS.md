# iOS support

## iOS setup: script for adjusting environment variables

To integrate automatic setup of Hermes engine, a special env variable (`REACT_NATIVE_OVERRIDE_HERMES_DIR`) must be set to a proper path. We provide the script `react-native-node-api vendor-hermes --silent` which will output a single line, the path to Hermes directory.

Each time you run XCode, make sure this is in place.
