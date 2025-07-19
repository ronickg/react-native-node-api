import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const dir = path.resolve(import.meta.dirname, "../vendor");

export function findCMakeProjectsRecursively(dir: string): string[] {
  let results: string[] = [];
  const files = readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (statSync(fullPath).isDirectory()) {
      results = results.concat(findCMakeProjectsRecursively(fullPath));
    } else if (file === "CMakeLists.txt") {
      results.push(dir);
    }
  }

  return results;
}

export function findCMakeProjects(): string[] {
  return findCMakeProjectsRecursively(dir);
}
