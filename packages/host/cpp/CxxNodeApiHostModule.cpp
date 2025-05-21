#include <utility>      // std::move, std::pair, std::make_pair
#include <vector>       // std::vector
#include <string>       // std::string
#include <algorithm>    // std::equal, std::all_of
#include <cctype>       // std::isalnum
#include "CxxNodeApiHostModule.hpp"
#include "AddonRegistry.hpp"
#include "Logger.hpp"

using namespace facebook;

namespace {

bool startsWith(const std::string &str, const std::string &prefix) {
#if __cplusplus >= 202002L // __cpp_lib_starts_ends_with
  return str.starts_with(prefix);
#else
  return str.size() >= prefix.size()
      && std::equal(prefix.begin(), prefix.end(), str.begin());
#endif // __cplusplus >= 202002L
}

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

std::vector<std::string_view> makeParentPath(const std::string_view &path) {
  auto parts = explodePath(path);
  makeParentPathInplace(parts);
  return parts;
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

std::vector<std::string_view> joinPath(const std::vector<std::string_view> &baseDir,
                                       const std::vector<std::string_view> &rest) {
  auto pathComponents = simplifyPath(baseDir);
  auto restComponents = simplifyPath(rest);
  for (auto &&part : restComponents) {
    if (".." == part) {
      makeParentPathInplace(pathComponents);
    } else if (!part.empty() && "." != part) {
      pathComponents.emplace_back(part);
    }
  }
  return pathComponents;
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

AddonRegistry g_platformAddonRegistry;

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

  // Check if this is a prefixed import (e.g. `node:fs/promises`)
  const auto [pathPrefix, strippedPath] = rpartition(requiredPath, ':');
  if (!pathPrefix.empty()) {
    // URL protocol or prefix detected, dispatch via custom resolver
    std::string pathPrefixCopy(pathPrefix); // HACK: Need explicit cast to `std::string`
    if (auto handler = prefixResolvers_.find(pathPrefixCopy); prefixResolvers_.end() != handler) {
      // HACK: Smuggle the `pathPrefix` as new `requiredPackageName`
      return (handler->second)(rt, strippedPath, pathPrefix, requiredFrom);
    } else {
      throw jsi::JSError(rt, "Unsupported protocol or prefix \"" + pathPrefixCopy + "\". Have you registered it?");
    }
  }

  // Check, if this package has been overridden
  if (auto handler = packageOverrides_.find(requiredPackageName); packageOverrides_.end() != handler) {
    // This package has a custom resolver, invoke it
    return (handler->second)(rt, strippedPath, requiredPackageName, requiredFrom);
  }

  // Otherwise, "requiredPath" must be a "relative specifier" or a "bare specifier"
  return resolveRelativePath(rt, strippedPath, requiredPackageName, requiredFrom);
}

jsi::Value
CxxNodeApiHostModule::resolveRelativePath(facebook::jsi::Runtime &rt,
                                          const std::string_view &requiredPath,
                                          const std::string_view &requiredPackageName,
                                          const std::string_view &requiredFrom) {
  // "Rebase" the relative path to get a proper package-relative path
  const auto requiredFromDirParts = makeParentPath(requiredFrom);
  const auto requiredPathParts = explodePath(requiredPath);
  const std::string mergedSubpath = implodePath(joinPath(requiredFromDirParts, requiredPathParts));
  if (!isModulePathLike(mergedSubpath)) {
    throw jsi::JSError(rt, "Computed subpath is invalid. Check `requiredPath` and `requiredFrom`.");
  }
  if (!startsWith(mergedSubpath, "./")) {
    throw jsi::JSError(rt, "Subpath must be relative and cannot leave its package root.");
  }

  // Check whether (`requiredPackageName`, `mergedSubpath`) is already cached
  // NOTE: Cache must to be `jsi::Runtime`-local
  auto [exports, isCached] = lookupRequireCache(rt,
                                                requiredPackageName,
                                                mergedSubpath);

  if (!isCached) {
    // Ask the global addon registry to load given Node-API addon.
    // If other runtime loaded it already, the OS will return the same pointer.
    // NOTE: This method might try multiple platform-specific paths.
    const std::string packageNameCopy(requiredPackageName);
    auto &addon = g_platformAddonRegistry.loadAddon(packageNameCopy, mergedSubpath);

    // Create a `napi_env` and initialize the addon
    exports = g_platformAddonRegistry.instantiateAddonInRuntime(rt, addon);
    updateRequireCache(rt, requiredPackageName, mergedSubpath, exports);
  }

  return std::move(exports);
}

std::pair<jsi::Value, bool>
CxxNodeApiHostModule::lookupRequireCache(::jsi::Runtime &rt,
                   const std::string_view &packageName,
                   const std::string_view &subpath) {
  // TODO: Implement me
  return std::make_pair(jsi::Value(), false);
}

void CxxNodeApiHostModule::updateRequireCache(jsi::Runtime &rt,
                                              const std::string_view &packageName,
                                              const std::string_view &subpath,
                                              jsi::Value &value) {
  // TODO: Implement me
}

extern "C" {
NAPI_EXTERN void NAPI_CDECL napi_module_register(napi_module *mod) {
  assert(NULL != mod && NULL != mod->nm_register_func);
  g_platformAddonRegistry.handleOldNapiModuleRegister(mod->nm_register_func);
}
} // extern "C"

} // namespace callstack::nodeapihost
