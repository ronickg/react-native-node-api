def find_node_api_xcframeworks(podfile_path, podspec_path)
  real_podspec_path = Pathname.new(podspec_path).realpath
  output = `npx react-native-node-api-modules link-xcframework-paths #{podfile_path}`
  paths = JSON.parse(output)

  unless paths.is_a?(Array)
    raise "Expected a list of paths"
  end

  paths.map { |path| Pathname.new(path).relative_path_from(real_podspec_path).to_s }
end