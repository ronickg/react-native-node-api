import type { TargetCPU, TargetOS, TargetOSExtra } from './targets.js';

export interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
  main?: string;
  scripts?: {[name: string]: string};
  dependencies?: {[name: string]: string};
  devDependencies?: {[name: string]: string};
  peerDependencies?: {[name: string]: string};
  optionalDependencies?: {[name: string]: string};
  files?: string[];
  engines?: {[name: string]: string};
  os?: (TargetOS | TargetOSExtra)[];
  cpu?: TargetCPU[];
  gypfile?: boolean;
  // napi-rs specific fields:
  napi?: {
    name: string;
    triples: {
      additional?: string[];
    };
  };
}

export interface GypTargetDescription {
  target_name?: string;
  sources?: string[];
  include_dirs?: string[];
  [`include_dirs!`]: string[];
  defines?: string[];
  cflags?: string[];
  [`cflags!`]?: string[];
  cflags_cc?: string[];
  [`cflags_cc!`]?: string[];
  ldflags?: string[];
  [`ldflags!`]?: string[];
  ldflags_cc?: string[];
  [`ldflags_cc!`]?: string[];
}

export interface GypFile {
  targets?: GypTargetDescription[];
}
