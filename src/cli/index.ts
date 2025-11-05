#!/usr/bin/env node
import chalk from "chalk";
import fs from "fs";
import path from "path";
import { helpTexts } from "./help.js";
import {
    getConfig,
    installComponent,
    getComponents
} from "./utils.js";
import { handleUpdateCommand } from "./update.js";

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const components = args.slice(1).filter((a) => !a.startsWith("--"));

    // Help Command
    if (!command || command === "-h" || command === "--help" || command === "help") {
        console.log(helpTexts.general);
        process.exit(0);
    }

    // List Components
    if (command === "list") {
        console.log(chalk.cyan("📦 Available components:"));
        const components = await getComponents();
        components.forEach((c) => console.log(` - ${c}`));
        process.exit(0);
    }

    // Update Components
    if (command === "update") {
        const config = await getConfig();
        await handleUpdateCommand(config);
        process.exit(0);
    }

    // Add Components
    if (command !== "add") {
        console.log(chalk.yellow("Usage: npx advantisui add <component> | update | list"));
        process.exit(1);
    }

    const config = await getConfig();
    const targetDir = path.resolve(process.cwd(), config.outDir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    for (const comp of components) {
        await installComponent(comp, targetDir, new Set(), config);
    }

    console.log(chalk.green("\n✅ All requested components installed."));
}

main().catch((err) => {
    console.error(chalk.red(err));
    process.exit(1);
});
