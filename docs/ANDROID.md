# Android support

## Android setup

### Step 1: `settings.gradle`

Gradle needs special handling to build React Native from source. In your app's `settings.gradle` please include the below:

```groovy
// customize the path to match your node_modules location
apply(from: "../../../node_modules/react-native-node-api/android/consumerSettings.gradle")
applyNodeAPISettings(settings)
```

### Step 2: script for adjusting environment variables

To integrate automatic setup of Hermes engine, a special env variable (`REACT_NATIVE_OVERRIDE_HERMES_DIR`) must be set to a proper path. Since Gradle does not really support loading `.env` files, this must be automated by the consumer. We provide the script `react-native-node-api vendor-hermes --silent` which will output a single line, the path to Hermes directory.

Each time you run Android Studio, make sure this is in place.

### How it works: building Hermes from source

Because we're using a version of Hermes patched with Node-API support, we need to build React Native from source.

Alternatively, if for whatever reason you want to do it manually, you can do so by exporting this environment variable before Gradle invocation:

```
export REACT_NATIVE_OVERRIDE_HERMES_DIR="$(npx react-native-node-api vendor-hermes --silent)"
```

> [!TIP]
> This above automatically done by our script. If you run it from postinstall, there is no need to do this manually.

## Cleaning your React Native build folders

If you've accidentally built your app without Hermes patched, you can clean things up by deleting the `ReactAndroid` build folder.

```
rm -rf node_modules/react-native/ReactAndroid/build
```
