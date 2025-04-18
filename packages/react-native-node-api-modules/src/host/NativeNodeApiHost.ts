import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export interface Spec extends TurboModule {
  requireNodeAddon(path: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>("NodeApiHost");
