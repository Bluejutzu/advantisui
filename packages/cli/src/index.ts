#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { getConfig } from "./config.js";
import { getComponents, installComponent } from "./components.js";
import { handleUpdateCommand } from "./update.js";

const program = new Command();

program
  .name("advantisui")
  .description("AdvantisUI - a reusable component library and CLI")
  .version("1.1.6");

program
  .command("list")
  .description("List available components")
  .action(async () => {
    console.log(chalk.cyan("📦 Available components:"));
    const components = await getComponents();
    components.forEach((c) => console.log(` - ${c}`));
  });

program
  .command("add <components...>")
  .description("Add components to your project")
  .action(async (components: string[]) => {
    const config = await getConfig();
    const targetDir = path.resolve(process.cwd(), config.outDir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    for (const comp of components) {
      await installComponent(comp, targetDir, new Set(), config);
    }

    console.log(chalk.green("\n✅ All requested components installed."));
  });

program
  .command("update")
  .description("Update installed components")
  .action(async () => {
    const config = await getConfig();
    await handleUpdateCommand(config);
  });

program.parse(process.argv);
