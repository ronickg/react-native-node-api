#include <utility>      // std::move, std::pair, std::make_pair
#include <vector>       // std::vector
#include <string>       // std::string
#include <string_view>  // std::string_view
#include <algorithm>    // std::all_of
#include <cctype>       // std::isalnum
#include "CxxNodeApiHostModule.hpp"
#include "Logger.hpp"

using namespace facebook;

namespace {

bool isModulePathLike(const std::string_view &path) {
  return std::all_of(path.begin(), path.end(), [](unsigned char c) {
    return std::isalnum(c) || '_' == c || '-' == c
        || '.' == c || '/' == c || ':' == c;
  });
}

// NOTE: behaves like `explode()` in PHP
std::vector<std::string_view> explodePath(const std::string_view &path) {
  std::vector<std::string_view> parts;
  for (size_t pos = 0; std::string_view::npos != pos; /* no-op */) {
    if (const size_t nextPos = path.find('/', pos); std::string_view::npos != nextPos) {
      parts.emplace_back(path.substr(pos, nextPos - pos));
      pos = nextPos + 1;
    } else {
      if (std::string_view &&part = path.substr(pos); !part.empty()) {
        // Paths ending with `/` are as if there was a tailing dot `/.`
        // therefore the last `/` can be safely removed
        parts.emplace_back(part);
      }
      break;
    }
  }
  return parts;
}

// NOTE: Absolute paths would have the first part empty, relative would have a name
std::string implodePath(const std::vector<std::string_view> &parts) {
  std::string joinedPath;
  for (size_t i = 0; i < parts.size(); ++i) {
    if (i > 0) {
      joinedPath += '/';
    }
    joinedPath += parts[i];
  }
  return joinedPath;
}

// NOTE: Returned path does not include the `/` at the end of the string
// NOTE: For some cases this cannot be a view: `getParentPath("..")` => "../.."
void makeParentPathInplace(std::vector<std::string_view> &parts) {
  if (!parts.empty() && ".." != parts.back()) {
    const bool wasDot = "." == parts.back();
    parts.pop_back();
    if (wasDot && parts.empty()) {
      parts.emplace_back("..");
    }
  } else {
    parts.emplace_back("..");
  }
}

std::vector<std::string_view> simplifyPath(const std::vector<std::string_view> &parts) {
  std::vector<std::string_view> result;
  if (!parts.empty()) {
    for (const auto &part : parts) {
      if ("." == part && !result.empty()) {
        continue; // We only allow for a single `./` at the beginning
      } else if (".." == part) {
        makeParentPathInplace(result);
      } else {
        result.emplace_back(part);
      }
    }
  } else {
    result.emplace_back("."); // Empty path is as if it was "."
  }
  return result;
}

std::string joinPath(const std::string_view &baseDir, const std::string_view &rest) {
  auto pathComponents = simplifyPath(explodePath(baseDir));
  auto restComponents = simplifyPath(explodePath(rest));
  for (auto &&part : restComponents) {
    if (".." == part) {
      makeParentPathInplace(pathComponents);
    } else if (!part.empty() && "." != part) {
      pathComponents.emplace_back(part);
    }
  }
  return implodePath(pathComponents);
}

std::pair<std::string_view, std::string_view>
rpartition(const std::string_view &input, char delimiter) {
  if (const size_t pos = input.find_last_of(delimiter); std::string_view::npos != pos) {
    const auto head = std::string_view(input).substr(0, pos);
    const auto tail = std::string_view(input).substr(pos + 1);
    return std::make_pair(head, tail);
  } else {
    return std::make_pair(std::string_view(), input);
  }
}

} // namespace

namespace callstack::nodeapihost {

CxxNodeApiHostModule::CxxNodeApiHostModule(
    std::shared_ptr<react::CallInvoker> jsInvoker)
    : TurboModule(CxxNodeApiHostModule::kModuleName, jsInvoker) {
  methodMap_["requireNodeAddon"] =
      MethodMetadata{1, &CxxNodeApiHostModule::requireNodeAddon};
}

jsi::Value
CxxNodeApiHostModule::requireNodeAddon(jsi::Runtime &rt,
                                       react::TurboModule &turboModule,
                                       const jsi::Value args[], size_t count) {
  auto &thisModule = static_cast<CxxNodeApiHostModule &>(turboModule);
  if (3 == count) {
    // Must be `requireNodeAddon(requiredPath: string, requiredPackageName: string, requiredFrom: string)`
    return thisModule.requireNodeAddon(rt,
        args[0].asString(rt),
        args[1].asString(rt),
        args[2].asString(rt));
  }
  throw jsi::JSError(rt, "Invalid number of arguments to requireNodeAddon()");
}

jsi::Value
CxxNodeApiHostModule::requireNodeAddon(jsi::Runtime &rt,
                                       const jsi::String &requiredPath,
                                       const jsi::String &requiredPackageName,
                                       const jsi::String &requiredFrom) {
  return requireNodeAddon(rt,
      requiredPath.utf8(rt),
      requiredPackageName.utf8(rt),
      requiredFrom.utf8(rt));
}

jsi::Value
CxxNodeApiHostModule::requireNodeAddon(jsi::Runtime &rt,
                                       const std::string &requiredPath,
                                       const std::string &requiredPackageName,
                                       const std::string &requiredFrom) {
  // Ensure that user-supplied inputs contain only allowed characters
  if (!isModulePathLike(requiredPath)) {
    throw jsi::JSError(rt, "Invalid characters in `requiredPath`. Only ASCII alphanumerics are allowed.");
  }
  if (!isModulePathLike(requiredFrom)) {
    throw jsi::JSError(rt, "Invalid characters in `requiredFrom`. Only ASCII alphanumerics are allowed.");
  }

  const std::string &libraryNameStr = requiredPath;
  auto [it, inserted] = nodeAddons_.emplace(libraryNameStr, NodeAddon());
  NodeAddon &addon = it->second;

  // Check if this module has been loaded already, if not then load it...
  if (inserted) {
    if (!loadNodeAddon(addon, libraryNameStr)) {
      return jsi::Value::undefined();
    }
  }

  // Initialize the addon if it has not already been initialized
  if (!rt.global().hasProperty(rt, addon.generatedName.data())) {
    initializeNodeModule(rt, addon);
  }

  // Look the exports up (using JSI) and return it...
  return rt.global().getProperty(rt, addon.generatedName.data());
}

bool CxxNodeApiHostModule::loadNodeAddon(NodeAddon &addon,
                                         const std::string &libraryName) const {
#if defined(__APPLE__)
  std::string libraryPath =
      "@rpath/" + libraryName + ".framework/" + libraryName;
#elif defined(__ANDROID__)
  std::string libraryPath = "lib" + libraryName + ".so";
#else
  abort()
#endif

  log_debug("[%s] Loading addon by '%s'", libraryName.c_str(),
            libraryPath.c_str());

  typename LoaderPolicy::Symbol initFn = NULL;
  typename LoaderPolicy::Module library =
      LoaderPolicy::loadLibrary(libraryPath.c_str());
  if (NULL != library) {
    log_debug("[%s] Loaded addon", libraryName.c_str());
    addon.moduleHandle = library;

    // Generate a name allowing us to reference the exports object from JSI
    // later Instead of using random numbers to avoid name clashes, we just use
    // the pointer address of the loaded module
    addon.generatedName.resize(32, '\0');
    snprintf(addon.generatedName.data(), addon.generatedName.size(),
             "RN$NodeAddon_%p", addon.moduleHandle);

    initFn = LoaderPolicy::getSymbol(library, "napi_register_module_v1");
    if (NULL != initFn) {
      log_debug("[%s] Found napi_register_module_v1 (%p)", libraryName.c_str(),
                initFn);
      addon.init = (napi_addon_register_func)initFn;
    } else {
      log_debug("[%s] Failed to find napi_register_module_v1. Expecting the "
                "addon to call napi_module_register to register itself.",
                libraryName.c_str());
    }
    // TODO: Read "node_api_module_get_api_version_v1" to support the addon
    // declaring its Node-API version
    // @see
    // https://github.com/callstackincubator/react-native-node-api/issues/4
  } else {
    log_debug("[%s] Failed to load library", libraryName.c_str());
  }
  return NULL != initFn;
}

bool CxxNodeApiHostModule::initializeNodeModule(jsi::Runtime &rt,
                                                NodeAddon &addon) {
  // We should check if the module has already been initialized
  assert(NULL != addon.moduleHandle);
  assert(NULL != addon.init);
  napi_status status = napi_ok;
  // TODO: Read the version from the addon
  // @see
  // https://github.com/callstackincubator/react-native-node-api/issues/4
  napi_env env = reinterpret_cast<napi_env>(rt.createNodeApiEnv(8));

  // Create the "exports" object
  napi_value exports;
  status = napi_create_object(env, &exports);
  assert(status == napi_ok);

  // Call the addon init function to populate the "exports" object
  // Allowing it to replace the value entirely by its return value
  exports = addon.init(env, exports);

  napi_value global;
  napi_get_global(env, &global);
  assert(status == napi_ok);

  status =
      napi_set_named_property(env, global, addon.generatedName.data(), exports);
  assert(status == napi_ok);

  return true;
}

} // namespace callstack::nodeapihost
