import { requireNodeAddon } from "../host";

function binding(moduleName: string): unknown {
  return requireNodeAddon(moduleName);
}

export = binding;
