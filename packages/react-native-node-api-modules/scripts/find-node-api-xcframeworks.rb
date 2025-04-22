def find_node_api_xcframeworks(podfile_path, podspec_path)
  output = `npx react-native-node-api-modules print-xcframework-paths #{podfile_path}`
  paths = JSON.parse(output)

  unless paths.is_a?(Array)
    raise "Expected a list of paths"
  end

  paths.map { |path| Pathname.new(path).relative_path_from(Pathname.new(podspec_path)).to_s }
end