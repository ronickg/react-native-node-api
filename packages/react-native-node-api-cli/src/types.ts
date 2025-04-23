import type { TargetCPU, TargetOS, TargetOSExtra } from './targets.js';

export interface NapiHostConfig {
  platforms?: string[];
  archs?: string[];
  searchPaths?: {
    addons: string[];
    patterns?: string[];
  };
  // TODO: How to configure each module separately (overrides if needed, eg. `foobar.node` in Debug)
  modules: string[];
}

export interface NapiConfig {
  /**
   * The binary file name of generated `.node` file.
   * Defaults to `index`.
   */
  name: string;
  triples: {
    /**
     * Whether to enable the default target triples, which are:
     * `x86_64-apple-darwin`, `x86_64-unknown-linux-gnu` and `x86_64-pc-windows-msvc`.
     * Defaults to `true`.
     */
    defaults?: boolean;
    /**
     * Additional triples besides the default triples you want to build.
     * Target triples could be found in the output of `react-native-node-api-cli targets`
     * or `rustup target list` (applicable if using `napi-rs`).
     * Defaults to `[]`.
     */
    additional: string[];
  };
  package?: {
    /**
     * Override for the `package.json`'s `name` field.
     * Defaults to `undefined`.
     */
    name?: string;
  };
  /**
   * Specify a different NPM client for usage when executing NPM actions such as publishing.
   * Defaults to `npm`.
   */
  npmClient?: string;
}

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
  napi?: NapiConfig;
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
