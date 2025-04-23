import fs from 'node:fs/promises';
import path from 'node:path';
import findUp from 'find-up';

/**
 * Finds project directory that contains a `package.json`.
 *
 * @throws UnknownProjectError If no package.json was found
 * @param from Directory path to start looking from, default to current directory
 */
export async function findProjectRoot(
  from: string = process.cwd()
): Promise<string> {
  const packageJsonPath = await findUp('package.json', { cwd: from });
  if (!packageJsonPath) {
    throw new Error('Could not locate package.json');
  }
  return path.dirname(packageJsonPath);
}

export function getUnscopedPackageName(name: string) {
  if (name.startsWith('@')) {
    return name.substring(name.lastIndexOf('/') + 1);
  } else {
    return name;
  }
}

export interface JsonFile<T> {
  data: T;
  indent: string | number;
}

export async function readJson<T>(path: string): Promise<JsonFile<T>> {
  const content = await fs.readFile(path, { encoding: 'utf-8' });
  const indent = inferIndentation(content);
  return {
    data: JSON.parse(content) as T,
    indent,
  };
}

export async function writeJson<T>(path: string, json: JsonFile<T>): Promise<void> {
  const content = JSON.stringify(json.data, null, json.indent);
  return await fs.writeFile(path, content);
}

function inferIndentation(content: string): string | number {
  const matches = content.match(/^[ \t]+/m);
  if (matches) {
    if (matches[0].match(/^ +$/)) {
      return matches[0].length; // all spaces
    } else {
      return matches[0];
    }
  } else {
    return 2; // `package.json` uses 2 by default (see docs.npmjs.com)
  }
}

export async function processJsonFile<TJson extends object>(
  path: string,
  editFn: (pkg: TJson, commit: (pkg: TJson) => void) => void,
  dryRun: boolean
) {
  let pkgFile = await readJson<TJson>(path);
  let wasChanged = false;

  editFn(pkgFile.data, (editedPkg) => {
    pkgFile.data = editedPkg;
    wasChanged ||= true;
  });

  if (dryRun) {
    console.log(JSON.stringify(pkgFile.data, null, pkgFile.indent));
  } else if (wasChanged) {
    await writeJson<TJson>(path, pkgFile);
  }

  return pkgFile;
}
