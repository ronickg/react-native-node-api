import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export const EXAMPLES_DIR = new URL("../examples", import.meta.url).pathname;

export function findCMakeProjects(dir = EXAMPLES_DIR): string[] {
  let results: string[] = [];
  const files = readdirSync(dir);

  for (const file of files) {
    const fullPath = join(dir, file);
    if (statSync(fullPath).isDirectory()) {
      results = results.concat(findCMakeProjects(fullPath));
    } else if (file === "CMakeLists.txt") {
      results.push(dir);
    }
  }

  return results;
}
