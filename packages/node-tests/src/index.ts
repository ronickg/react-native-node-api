/* eslint-disable @typescript-eslint/no-require-imports */

export const suites: Record<string, Record<string, () => void>> = {
  "2_function_arguments": {
    test: () =>
      require("../tests/js-native-api/2_function_arguments/test.bundle.js"),
  },
};
