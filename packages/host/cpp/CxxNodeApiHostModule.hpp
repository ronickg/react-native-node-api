#pragma once

#include <string_view>  // std::string_view

#include <ReactCommon/TurboModule.h>
#include <jsi/jsi.h>
#include <node_api.h>

#include "AddonLoaders.hpp"

namespace callstack::nodeapihost {

class JSI_EXPORT CxxNodeApiHostModule : public facebook::react::TurboModule {
public:
  static constexpr const char *kModuleName = "NodeApiHost";

  using ResolverFunc = std::function<facebook::jsi::Value(
    facebook::jsi::Runtime&,
    const std::string_view&,
    const std::string_view&,
    const std::string_view&)>;

  CxxNodeApiHostModule(std::shared_ptr<facebook::react::CallInvoker> jsInvoker);

  static facebook::jsi::Value
  requireNodeAddon(facebook::jsi::Runtime &rt,
                   facebook::react::TurboModule &turboModule,
                   const facebook::jsi::Value args[], size_t count);
  facebook::jsi::Value requireNodeAddon(facebook::jsi::Runtime &rt,
                                        const facebook::jsi::String &requiredPath,
                                        const facebook::jsi::String &requiredPackageName,
                                        const facebook::jsi::String &requiredFrom);
  facebook::jsi::Value requireNodeAddon(facebook::jsi::Runtime &rt,
                                        const std::string &requiredPath,
                                        const std::string &requiredPackageName,
                                        const std::string &requiredFrom);

  facebook::jsi::Value resolveRelativePath(facebook::jsi::Runtime &rt,
                                           const std::string_view &requiredPath,
                                           const std::string_view &requiredPackageName,
                                           const std::string_view &requiredFrom);

protected:
  struct NodeAddon {
    void *moduleHandle;
    napi_addon_register_func init;
    std::string generatedName;
  };
  std::unordered_map<std::string, NodeAddon> nodeAddons_;
  std::unordered_map<std::string, ResolverFunc> prefixResolvers_;
  std::unordered_map<std::string, ResolverFunc> packageOverrides_;
  using LoaderPolicy = PosixLoader; // FIXME: HACK: This is temporary workaround
                                    // for my lazyness (work on iOS and Android)

  bool loadNodeAddon(NodeAddon &addon, const std::string &path) const;
  bool initializeNodeModule(facebook::jsi::Runtime &rt, NodeAddon &addon);
};

} // namespace callstack::nodeapihost
