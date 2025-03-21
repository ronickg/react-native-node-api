import NodeApiHost from './NativeNodeApiHost';

export function multiply(a: number, b: number): number {
  return NodeApiHost.multiply(a, b);
}

export function requireNodeAddon(path: string): void {
  return NodeApiHost.requireNodeAddon(path);
}
