#include "AddonRegistry.hpp"
#include <cctype>  // for std::isalnum

#ifndef NODE_API_DEFAULT_MODULE_API_VERSION
#define NODE_API_DEFAULT_MODULE_API_VERSION 8
#endif

using namespace facebook;

namespace {
napi_status napi_emplace_named_property_object(napi_env env,
                                               napi_value object,
                                               const char *utf8Name,
                                               napi_value *outObject) {
  bool propertyFound = false;
  napi_status status = napi_has_named_property(env, object, utf8Name, &propertyFound);
  assert(napi_ok == status);

  assert(nullptr != outObject);
  if (propertyFound) {
    status = napi_get_named_property(env, object, utf8Name, outObject);
  } else {
    // Need to create it first
    status = napi_create_object(env, outObject);
    assert(napi_ok == status);

    status = napi_set_named_property(env, object, utf8Name, *outObject);
  }
  
  return status;
}

bool endsWith(const std::string_view &str, const std::string_view &suffix) {
#if __cplusplus >= 202002L // __cpp_lib_starts_ends_with
  return str.ends_with(suffix);
#else
  return str.size() >= suffix.size()
    && std::equal(suffix.rbegin(), suffix.rend(), str.rbegin());
#endif
}

std::string_view stripSuffix(const std::string_view &str, const std::string_view &suffix) {
  if (endsWith(str, suffix)) {
    return str.substr(0, str.size() - suffix.size());
  } else {
    return str;
  }
}

void sanitizeLibraryNameInplace(std::string &name) {
  // Strip the extension (if present)
  // NOTE: This is needed when working with updated Babel plugin
  name = stripSuffix(name, ".node");

  for (char &c : name) {
    if (!std::isalnum(c)) {
      c = '-';
    }
  }
}
} // namespace

namespace callstack::nodeapihost {

std::mutex AddonRegistry::s_registryMutex;
std::vector<AddonRegistry::DeprecatedAddonInfo> AddonRegistry::s_deprecatedAddons;

AddonRegistry::NodeAddon& AddonRegistry::loadAddon(std::string packageName,
                                                   std::string subpath) {
  const std::string fqan = packageName + subpath.substr(1);
  auto [it, inserted] =
      trackedAddons_.try_emplace(fqan, NodeAddon(packageName, subpath));
  NodeAddon &addon = it->second;

  sanitizeLibraryNameInplace(packageName);
  sanitizeLibraryNameInplace(subpath);
  const std::string libraryName = packageName + subpath;

  if (inserted || !it->second.isLoaded()) {
#if defined(__APPLE__)
    const std::string libraryPath = "@rpath/" + libraryName + ".framework/" + libraryName;
    tryLoadAddonAsDynamicLib(addon, libraryPath);
#elif defined(__ANDROID__)
    const std::string libraryPath = "lib" + libraryName + ".so";
    tryLoadAddonAsDynamicLib(addon, libraryPath);
#else
    abort();
#endif
  }

  return addon;
}

bool AddonRegistry::tryLoadAddonAsDynamicLib(NodeAddon &addon, const std::string &path) {
  // Load addon as dynamic library
  typename LoaderPolicy::Module library = LoaderPolicy::loadLibrary(path.c_str());
  if (nullptr != library) {
    addon.moduleApiVersion_ = NODE_API_DEFAULT_MODULE_API_VERSION;

    typename LoaderPolicy::Symbol initFn = LoaderPolicy::getSymbol(library, "napi_register_module_v1");
    if (nullptr == initFn) {
      // is there a pending addon that used the deprecated `napi_register_module()`?
      std::lock_guard<std::mutex> lock(s_registryMutex);
      for (const auto &addonInfo : s_deprecatedAddons) {
        initFn = LoaderPolicy::getSymbol(library, addonInfo.symbolName_.c_str());
        if (nullptr != initFn && addonInfo.initFunc_ == initFn) {
          // We found the pending addon, and now we have the Module handle!
          break;
        }
      }

      if (nullptr == initFn) {
        // Unable to match symbol... Maybe the init function's symbol was not exported?
        return false;
      }
    }
    addon.initFun_ = (napi_addon_register_func)initFn;

    // Try to get the version (even if `napi_register_module_v1` wasn't found)
    typename LoaderPolicy::Symbol getVersionFn = LoaderPolicy::getSymbol(library, "node_api_module_get_api_version_v1");
    if (nullptr != getVersionFn) {
      addon.moduleApiVersion_ = ((node_api_addon_get_api_version_func)getVersionFn)();
    }

    if (nullptr != addon.initFun_) {
      addon.moduleHandle_ = (void *)library;
      addon.loadedFilePath_ = path;
    }
  }

  return addon.isLoaded();
}

jsi::Value AddonRegistry::instantiateAddonInRuntime(jsi::Runtime &rt, NodeAddon &addon) {
  // We should check if the module has already been initialized
  assert(true == addon.isLoaded());
  assert(addon.moduleApiVersion_ > 0 && addon.moduleApiVersion_ <= 10);

  napi_status status = napi_ok;
  napi_env env = reinterpret_cast<napi_env>(rt.createNodeApiEnv(addon.moduleApiVersion_));

  // Create the "exports" object
  napi_value exports;
  status = napi_create_object(env, &exports);
  assert(napi_ok == status);

  // Call the addon init function to populate the "exports" object
  // Allowing it to replace the value entirely by its return value
  // TODO: Check the return value (see Node.js specs)
  exports = addon.initFun_(env, exports);

  // "Compute" the Fully Qualified Addon Path
  const std::string fqap = addon.packageName_ + addon.subpath_.substr(1);

  {
    napi_value descriptor;
    status = createAddonDescriptor(env, exports, &descriptor);
    assert(napi_ok == status);

    napi_value global;
    napi_get_global(env, &global);
    assert(napi_ok == status);

    status = storeAddonByFullPath(env, global, fqap, descriptor);
    assert(napi_ok == status);
  }

  return lookupAddonByFullPath(rt, fqap);
}

bool AddonRegistry::handleOldNapiModuleRegister(napi_addon_register_func addonInitFunc) {
  // NOTE: In Node.js (since Jan 28, 2014 commit 76b9846), there can be only
  // ONE pending module at a given time, which is supposed to be set during
  // the execution of `dlopen()` or `LoadLibrary()`. This also implies that
  // every addon can call `napi_module_regiser()` only once.
  // https://github.com/nodejs/node/blob/76b98462e589a69d9fd48ccb9fb5f6e96b539715/src/node.cc#L1949
  // However, there are platforms out there (looking at you iOS) whose dynamic
  // linker likes to preload dynamic libraries and frameworks during process
  // startup, and thus violating this assumption (especially, when those
  // contain initializer/constructor functions)... As a workaround, we gonna
  // query for the name of init function (hopefully it's exported) and store
  // it in separate registry, for a later lookup. Sadly, `dladdr()` is not
  // a POSIX function, but available at least on Linux and Apple platforms.
  Dl_info moduleInfo;
  dladdr(reinterpret_cast<void *>(addonInitFunc), &moduleInfo);

  DeprecatedAddonInfo addonInfo {
    .initFunc_ = addonInitFunc,
    .addonPath_ = moduleInfo.dli_fname,
    .addonBaseAddress_ = moduleInfo.dli_fbase,
    .symbolName_ = moduleInfo.dli_sname,
  };

  {
    std::lock_guard<std::mutex> lock(s_registryMutex);
    s_deprecatedAddons.push_back(addonInfo);
  }

  return true;
}

napi_status AddonRegistry::createAddonDescriptor(napi_env env, napi_value exports, napi_value *outDescriptor) {
  // Create the descriptor object
  assert(nullptr != outDescriptor);
  napi_status status = napi_create_object(env, outDescriptor);

  // Point the `env` property to the current `napi_env`
  if (napi_ok == status) {
    napi_value env_value;
    status = napi_create_external(env, env, nullptr, nullptr, &env_value);
    if (napi_ok == status) {
      status = napi_set_named_property(env, *outDescriptor, "env", env_value);
    }
  }

  // Cache the addons exports in descriptor's `exports` property
  if (napi_ok == status) {
    status = napi_set_named_property(env, *outDescriptor, "exports", exports);
  }

  return status;
}

napi_status AddonRegistry::storeAddonByFullPath(napi_env env, napi_value global, const std::string &fqap, napi_value descriptor) {
  // Get the internal registry object
  napi_value registryObject;
  napi_status status = napi_emplace_named_property_object(env, global, kInternalRegistryKey, &registryObject);
  assert(napi_ok == status);

  status = napi_set_named_property(env, registryObject, fqap.c_str(), descriptor);
  return status;
}

jsi::Value AddonRegistry::lookupAddonByFullPath(jsi::Runtime &rt, const std::string &fqap) {
  // Get the internal registry object
  jsi::Object global = rt.global();
  if (!global.hasProperty(rt, kInternalRegistryKey)) {
    // Create it first
    jsi::Object registryObject = jsi::Object(rt);
    global.setProperty(rt, kInternalRegistryKey, registryObject);
  }
  jsi::Value registryValue = global.getProperty(rt, kInternalRegistryKey);
  jsi::Object registryObject = registryValue.asObject(rt);

  // Lookup by addon path
  jsi::Value addonValue(nullptr);
  if (registryObject.hasProperty(rt, fqap.c_str())) {
    addonValue = registryObject.getProperty(rt, fqap.c_str());
  }
  return addonValue;
}

} // namespace callstack::nodeapihost
