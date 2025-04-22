import { requireNodeAddon } from "../host";

function binding(moduleName: string): unknown {
  // Strip ".node" suffix
  moduleName = moduleName.replace(/\.node$/g, "");
  return requireNodeAddon(`@rpath/${moduleName}.framework/${moduleName}`);
}

export = binding;
