import type { ResolverConfigT } from "metro-config";

type CustomResolver = NonNullable<ResolverConfigT["resolveRequest"]>;

export const resolveRequest: CustomResolver = (
  context,
  moduleName,
  platform
) => {
  return context.resolveRequest(context, moduleName, platform);
};
