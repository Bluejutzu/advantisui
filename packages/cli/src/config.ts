import fs from "fs";
import path from "path";
import chalk from "chalk";
import inquirer from "inquirer";
import { DEFAULT_OUTDIR } from "./constants.js";

export interface Config {
  outDir: string;
  packageManager: "npm" | "pnpm" | "yarn" | "bun";
}

/**
 * Prompt or load configuration for the CLI.
 */
export async function getConfig(): Promise<Config> {
  const configPath = path.resolve(process.cwd(), "advantisui.config.json");

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return {
        outDir: config.outDir || DEFAULT_OUTDIR,
        packageManager: config.packageManager || "npm",
      };
    } catch {
      console.log(
        chalk.red("❌ Invalid advantisui.config.json — check formatting."),
      );
    }
  }

  // No config found — prompt user
  console.log(chalk.cyan("⚙️  No config found. Let's set up AdvantisUI.\n"));
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "outDir",
      message: "Where should components be installed?",
      default: DEFAULT_OUTDIR,
    },
    {
      type: "list",
      name: "packageManager",
      message: "Which package manager do you use?",
      choices: ["npm", "pnpm", "yarn", "bun"],
      default: "npm",
    },
  ]);

  fs.writeFileSync(configPath, JSON.stringify(answers, null, 2));
  console.log(chalk.green(`\n✅ Config saved to advantisui.config.json\n`));

  return answers;
}
