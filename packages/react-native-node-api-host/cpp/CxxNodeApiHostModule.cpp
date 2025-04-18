#include "CxxNodeApiHostModule.hpp"

#include <hermes/hermes.h>
#include <hermes/ScriptStore.h>

using namespace facebook;

extern napi_status hermes_create_napi_env(
    ::hermes::vm::Runtime &runtime,
    bool isInspectable,
    std::shared_ptr<jsi::PreparedScriptStore> scriptCache,
    const ::hermes::vm::RuntimeConfig &runtimeConfig,
    napi_env *env);

namespace callstack::nodeapihost {

CxxNodeApiHostModule::CxxNodeApiHostModule(std::shared_ptr<react::CallInvoker> jsInvoker)
  : TurboModule(CxxNodeApiHostModule::kModuleName, jsInvoker)
{
  methodMap_["requireNodeAddon"] = MethodMetadata {1, &CxxNodeApiHostModule::requireNodeAddon};
  methodMap_["multiply"] = MethodMetadata {2, &CxxNodeApiHostModule::multiply};
}

jsi::Value CxxNodeApiHostModule::requireNodeAddon(
  jsi::Runtime &rt,
  react::TurboModule &turboModule,
  const jsi::Value args[],
  size_t count
)
{
  auto& thisModule = static_cast<CxxNodeApiHostModule&>(turboModule);
  if (1 == count && args[0].isString()) {
    return thisModule.requireNodeAddon(rt, args[0].asString(rt));
  }
  return jsi::Value::undefined();
}

jsi::Value CxxNodeApiHostModule::multiply(
  jsi::Runtime &rt,
  react::TurboModule &turboModule,
  const jsi::Value args[],
  size_t count
)
{
  auto& thisModule = static_cast<CxxNodeApiHostModule&>(turboModule);
  if (2 == count && args[0].isNumber() && args[1].isNumber()) {
    return thisModule.multiply(rt, args[0].asNumber(), args[1].asNumber());
  }
  return jsi::Value::undefined();
}

jsi::Value CxxNodeApiHostModule::requireNodeAddon(jsi::Runtime &rt, const jsi::String path) {
  const std::string pathStr = path.utf8(rt);

  // Check if this module has been loaded already, if not then load it...
  if (nodeAddons_.end() == nodeAddons_.find(pathStr)) {
    NodeAddon& addon = nodeAddons_[pathStr];
    if (!loadNodeAddon(addon, pathStr)) {
      return jsi::Value::undefined();
    }
  }

  // Library has been loaded, make sure that the "exports" was populated.
  // If not, then just call the "napi_register_module_v1" function...
  NodeAddon& addon = nodeAddons_[pathStr];
  if (NULL == addon.cachedExports) {
    if (!initializeNodeModule(napiEnv_, addon)) {
      return jsi::Value::undefined();
    }
  }

  // Look the exports up (using JSI) and return it...
  return rt.global().getProperty(rt, addon.generatedName.data());
}

jsi::Value CxxNodeApiHostModule::multiply(jsi::Runtime &rt, double a, double b) {
  return jsi::Value(a * b);
}

bool CxxNodeApiHostModule::loadNodeAddon(NodeAddon &addon, const std::string &path) const
{
  typename LoaderPolicy::Symbol registratorFn = NULL;
  typename LoaderPolicy::Module library = LoaderPolicy::loadLibrary(path.c_str());
  if (NULL != library) {
    addon.moduleHandle = library;
    registratorFn = LoaderPolicy::getSymbol(library, "napi_register_module_v1");
    if (NULL != registratorFn) {
      addon.registerFn = (napi_addon_register_func)registratorFn;
    }
  }
  return NULL != registratorFn;
}

bool CxxNodeApiHostModule::initializeNodeModule(jsi::Runtime &rt, NodeAddon &addon)
{
  // We should check if the module has already been registered
  assert(NULL != addon.moduleHandle);
  assert(NULL != addon.registerFn);
  napi_status status = napi_ok;
  napi_value &exports = addon.cachedExports;

  // Create the "exports" object
  status = napi_create_object(napiEnv_, &exports);
  if (napi_ok != status) {
    return false;
  }

  // Call the addon registration function to populate the "exports" object
  addon.registerFn(napiEnv_, exports);

  // Instead of using random numbers to avoid name clashes, we just use the pointer address of the loaded module
  addon.generatedName.resize(32, '\0');
  snprintf(addon.generatedName.data(), addon.generatedName.size(), "RN$NodeAddon_%lX", (uintptr_t)addon.moduleHandle);

  napi_value global;
  napi_get_global(napiEnv_, &global);
  napi_set_named_property(napiEnv_, global, addon.generatedName.data(), addon.cachedExports);
  return true;
}

} // namespace callstack::nodeapihost
