import type { ResolverConfigT } from "metro-config";

type CustomResolver = NonNullable<ResolverConfigT["resolveRequest"]>;

export const resolveRequest: CustomResolver = (
  context,
  moduleName,
  platform
) => {
  // Mock the "bindings" module
  if (moduleName === "bindings") {
    return {
      filePath: require.resolve(
        "react-native-node-api-modules/bindings-polyfill"
      ),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};
