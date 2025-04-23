function serializePlistValue(obj: unknown, output: string[], level = 0) {
  const indentation = '\t'.repeat(level);
  if (Array.isArray(obj)) {
    output.push(`${indentation}<array>`);
    for (const value of obj) {
      serializePlistValue(value, output, level + 1);
    }
    output.push(`${indentation}</array>`);
  } else if (typeof obj === 'object' && obj !== null) {
    output.push(`${indentation}<dict>`);
    for (const [key, value] of Object.entries(obj)) {
      output.push(`${indentation}\t<key>${key}</key>`);
      serializePlistValue(value, output, level + 1);
    }
    output.push(`${indentation}</dict>`);
  } else if (typeof obj === 'string' || typeof obj === 'number') {
    output.push(`${indentation}<string>${obj}</string>`);
  }
}

/**
 * Serializes a JavaScript object into a plist (Property List) formatted XML string.
 * Supports nested objects and arrays. All "terminal values" are written as strings.
 *
 * @param {unknown} obj - A "record" or array to be serialized.
 * @return {string} A string containing the serialized plist XML representation of the input object.
 */
export function serializePlist(obj: unknown): string {
  const output = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
  ];
  serializePlistValue(obj, output, 0);
  output.push('</plist>\n');
  return output.join('\n');
}
