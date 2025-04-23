import fs from 'node:fs/promises';

export async function generatePodspecs(addons: GroupsByPlatformArch<string[]>) {
  const podspecSource = `require "json"
project_dir = Pathname.new(__dir__)
project_dir = project_dir.parent until
  File.exist?("#{project_dir}/package.json") ||
  project_dir.expand_path.to_s == '/'

package = JSON.parse(File.read(File.join(project_dir, "package.json")))

Pod::Spec.new do |s|
  s.name         = "ReactNativeNodeApiAddons"
  s.version      = package["version"] || "0.0.1"
  s.summary      = package["description"] || "No summary"
  s.description  = package["description"] || "No description"
  s.homepage     = package["homepage"] || "no-homepage"
  s.license      = package["license"] || "Unknown License"
  s.authors      = package["author"] || "Unknown Author"
  if package["repository"]
    s.source     = { :git => package["repository"]["url"], :tag => "#{s.version}" }
  else
    s.source     = { :git => "Unknown Source", :tag => "master" }
  end

  s.platforms    = { :ios => min_ios_version_supported }
  s.vendored_frameworks = "Frameworks/ReactNativeNodeAddons.xcframework"
end
`;
  await fs.writeFile('ReactNativeNodeApiAddons.podspec', podspecSource);
}
