#pragma once

#include <ReactCommon/TurboModule.h>
#include <jsi/jsi.h>
#include "../node_modules/node-api-headers/include/node_api.h" // FIXME: Find a better way (set include directory...)

#include "AddonLoaders.hpp"

namespace callstack::nodeapihost {

class JSI_EXPORT CxxNodeApiHostModule : public facebook::react::TurboModule {
public:
  static constexpr std::string kModuleName = "NodeApiHost";

  CxxNodeApiHostModule(std::shared_ptr<facebook::react::CallInvoker> jsInvoker);

  static facebook::jsi::Value requireNodeAddon(
    facebook::jsi::Runtime &rt,
    facebook::react::TurboModule &turboModule,
    const facebook::jsi::Value args[],
    size_t count
  );
  facebook::jsi::Value requireNodeAddon(facebook::jsi::Runtime &rt, const facebook::jsi::String path);

  static facebook::jsi::Value multiply(
    facebook::jsi::Runtime &rt,
    facebook::react::TurboModule &turboModule,
    const facebook::jsi::Value args[],
    size_t count
  );
  facebook::jsi::Value multiply(facebook::jsi::Runtime &rt, double a, double b);

protected:
  struct NodeAddon {
    void *moduleHandle;
    napi_addon_register_func registerFn;
    napi_value cachedExports;
    std::string generatedName;
  };
  std::unordered_map<std::string, NodeAddon> nodeAddons_;
  napi_env napiEnv_{};
  using LoaderPolicy = PosixLoader; // FIXME: HACK: This is temporary workaround for my lazyness (work on iOS and Android)

  bool initializeNodeApiEnv(facebook::jsi::Runtime &rt);
  bool loadNodeAddon(NodeAddon &addon, const std::string &path) const;
  bool initializeNodeModule(facebook::jsi::Runtime &rt, NodeAddon &addon);
};

} // namespace callstack::nodeapihost
