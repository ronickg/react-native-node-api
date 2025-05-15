import chalk from "chalk";

export function wrapAction<Args extends unknown[]>(
  action: (...args: Args) => Promise<void>
): (...args: Args) => Promise<void> {
  return async (...args: Args): Promise<void> => {
    try {
      await action(...args);
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(error.message));
      } else {
        console.error(chalk.red("An unknown error occurred"));
      }
      process.exitCode = 1;
    }
  };
}
