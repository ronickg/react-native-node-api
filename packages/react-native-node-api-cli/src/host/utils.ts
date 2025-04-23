import type { TargetCPU, TargetOS, TargetOSExtra } from '../targets.js';

export type Platform = TargetOS | TargetOSExtra;

export type TargetPair = [Platform, TargetCPU];
export type TargetTriplet = [Platform, TargetCPU, string|undefined];

export const COMMON_TARGET_PAIRS: TargetPair[] = [ // HACK: Hardcoded (platform, arch) pairs for now
  ['android', 'arm64'], ['android', 'x64'],
  ['darwin', 'arm64'], ['darwin', 'x64'],
  ['win32', 'arm64'], ['win32', 'x64'],
  ['ios', 'arm64'],
  ['tvos', 'arm64'],
  ['darwin', 'arm64'],
];

const COMMON_TARGET_REGEX = COMMON_TARGET_PAIRS
  .map(([p, a]) => new RegExp(`[\\\\\/\\.-]((?<plat>${p})-(?<arch>${a})(?:-(?<var>\\w+))?)\\b`, 'g'));

/**
 * Filters and returns target pairs based on the provided platforms and optional architectures.
 *
 * @param {Platform[]} platforms - An array of platform identifiers to filter targets for.
 * @param {TargetCPU[]} [archs] - An optional array of CPU architectures to filter target for.
 *                                If not provided or empty, all architectures in the given platforms are included.
 * @return {TargetPair[]} An array of target pairs matching the specified platforms and architectures.
 */
export function getTargetsFor(platforms: Platform[], archs?: TargetCPU[]): TargetPair[] {
  const noArchs = (archs === undefined || archs.length === 0);
  return COMMON_TARGET_PAIRS.filter(
    noArchs
      ? ([p, _]) => platforms.includes(p)
      : ([p, a]) => platforms.includes(p) && archs.includes(a)
  );
}

/**
 * Resolves and returns a list of search paths by replacing placeholder values
 * in the given search paths with the appropriate platform and architecture
 * values from the provided targets.
 *
 * @param {string[]} searchPaths - An array of paths which may include placeholders like '{platform}' or '{arch}'.
 * @param {TargetPair[]} targets - An array of target pairs, where each target pair consists of a platform and architecture.
 * @return {string[]} A new array of resolved search paths with placeholders replaced by the corresponding target platform and architecture.
 */
export function getSearchPathsForTargets(searchPaths: string[], targets: TargetPair[]): string[] {
  const resolvedPaths: Set<string> = new Set();
  for (const path of searchPaths) {
    if (path.includes('{platform}') || path.includes('{arch}')) {
      for (const [platform, arch] of targets) {
        resolvedPaths.add(
          path
            .replaceAll('{platform}', platform)
            .replaceAll('{arch}', arch)
        );
      }
    } else {
      resolvedPaths.add(path);
    }
  }
  return Array.from(resolvedPaths);
}

/**
 * Infers the target triplet (platform, architecture, and optionally variant) from the provided addon path.
 *
 * @param {string} addonPath - The file path of the addon from which the target triplet is to be inferred.
 * @return {TargetTriplet | undefined} The inferred target triplet as an array containing platform, architecture, and variant, or undefined if no match is found.
 */
export function inferTargetTripletFromAddonPath(addonPath: string): TargetTriplet | undefined {
  for (const pattern of COMMON_TARGET_REGEX) {
    const matches = Array.from(addonPath.matchAll(pattern)).reverse();
    const bestMatch = matches?.[0] ?? null;
    if (bestMatch) {
      const plat = bestMatch.groups!['plat']!;
      const arch = bestMatch.groups!['arch']!;
      const variant = bestMatch.groups!['var'];
      return [plat, arch, variant] as TargetTriplet;
    }
  }
  return undefined;
}

export type GroupsByArch<T> = {[arch in TargetCPU]: T};
export type GroupsByPlatform<T> = {[platform in Platform]: T};
export type GroupsByPlatformArch<T> = GroupsByPlatform<GroupsByArch<T>>;

/**
 * Groups items by platform and architecture based on a provided target-pair extraction function.
 *
 * @param {T[]} items - An array of items to be grouped.
 * @param {(item: T) => TargetPair | TargetTriplet | undefined} getTargetPair - A function that extracts a platform-architecture pair or triplet from each item.
 * @return {GroupsByPlatformArch<T[]>} An object where keys are platform names and values are objects grouping items by architecture.
 */
export function groupByPlatformArch<T>(items: T[], getTargetPair: (item: T) => TargetPair | TargetTriplet | undefined): GroupsByPlatformArch<T[]> {
  const platformGroups: GroupsByPlatformArch<T[]> = Object.create(null);
  for (const item of items) {
    const target = getTargetPair(item);
    if (!target) {
      console.warn(`Cannot infer platform and arch of item: ${item}. Ignoring...`);
      continue;
    }
    const [platform, arch] = target!;

    if (!Object.hasOwn(platformGroups, platform)) {
      platformGroups[platform] = { [arch]: [item] } as GroupsByArch<T[]>;
    } else {
      if (arch in platformGroups[platform]) {
        platformGroups[platform][arch].push(item);
      } else {
        platformGroups[platform][arch] = [item];
      }
    }
  };
  return platformGroups;
}
