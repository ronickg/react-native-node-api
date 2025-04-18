
# Find the location of the React Native package
ws_dir = Pathname.new(__dir__)
ws_dir = ws_dir.parent until
  File.exist?("#{ws_dir}/node_modules/react-native") ||
  ws_dir.expand_path.to_s == '/'
REACT_NATIVE_DIR = "#{ws_dir}/node_modules/react-native"

Pod::UI.warn "!!! PATCHING HERMES WITH NODE-API SUPPORT !!!"

PATCHED_HERMES_DIR = File.join(__dir__, "../hermes")
unless Dir.exist?(PATCHED_HERMES_DIR)
  sleep 1
  # Cloning (advice.detachedHead=false for a pretty output)
  system("git clone -c advice.detachedHead=false --recursive --depth 1 --branch node-api-for-react-native-0.79.0 https://github.com/kraenhansen/hermes.git #{PATCHED_HERMES_DIR}")
  # Patch React Native's copy of JSI
  system("cp -rf #{PATCHED_HERMES_DIR}/API/jsi/jsi/ #{REACT_NATIVE_DIR}/ReactCommon/jsi/jsi/")
end

# Signal the patched Hermes to React Native
ENV['BUILD_FROM_SOURCE'] = 'true'
ENV['REACT_NATIVE_OVERRIDE_HERMES_DIR'] = PATCHED_HERMES_DIR
