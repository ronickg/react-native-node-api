import type { ResolverConfigT } from "metro-config";

type CustomResolver = NonNullable<ResolverConfigT["resolveRequest"]>;

export const resolveRequest: CustomResolver = (
  context,
  moduleName,
  platform,
) => {
  throw new Error("Not implemented");
};
