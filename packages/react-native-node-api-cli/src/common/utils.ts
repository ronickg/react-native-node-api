/**
 * Splits the string into two parts based on the last occurrence of the specified separator.
 * If the separator is not found, the entire string is returned as the head with an empty string as the tail.
 * NOTE: The `sep` is not included in the returned result.
 *
 * @param {string} sep - The separator to search for in the string.
 * @param {string} str - The string to be partitioned.
 * @return {[string, string]} A pair where the first element is the part of the string before the last occurrence of `sep`,
 *                            and the second element is the part of the string after it (or empty if `sep` was not found).
 */
export function rpartition(sep: string, str: string): [string, string] {
  const pos = str.lastIndexOf(sep);
  const head = str.substring(0, pos);
  const tail = str.substring(pos + 1);
  return [head, tail];
}

/**
 * Groups an array of items based on the result of the key-generating function.
 *
 * @param {T[]} items - The array of items to be grouped.
 * @param {(item: T) => string} getKey - Key extracting function for each item in the array.
 * @return {Record<string, T[]>} An object where each key corresponds to a group, and the value is an array of items in that group.
 */
export function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const groups: Record<string, T[]> = Object.create(null);
  items.forEach(item => {
    const key = getKey(item);
    if (key in groups) {
      groups[key]!.push(item);
    } else {
      groups[key] = [item];
    }
  });
  return groups;
}

import { exec } from 'node:child_process';
import util from 'node:util';
import { consola } from './tui.js';

export const execAsync = util.promisify(exec);

export async function execa(path: string, args: string[]) {
  const cmdLine = [path, ...args].join(' ');
  consola.debug('Executing:', cmdLine);
  const result = await execAsync(cmdLine);
  result.stdout = result.stdout.trimEnd();
  return result;
}
