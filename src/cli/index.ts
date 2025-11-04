#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import inquirer from "inquirer";
import chalk from "chalk";
import https from "https";
import { componentDependencies, componentRelations } from "./dependencies.js";
import { helpTexts } from "./help.js";
import { guides } from "./guides.js";

const GITHUB_BASE = "https://raw.githubusercontent.com/Bluejutzu/advantisui/main/src/components";

interface Config {
    outDir: string;
    packageManager: "npm" | "pnpm" | "yarn" | "bun";
}

async function getConfig(): Promise<Config> {
    const configPath = path.resolve(process.cwd(), "advantisui.config.json");
    if (!fs.existsSync(configPath)) {
        console.log(chalk.blue("👋 Welcome to AdvantisUI! Let's set up your project."));

        const { packageManager } = await inquirer.prompt<{ packageManager: Config["packageManager"] }>([
            {
                type: "list",
                name: "packageManager",
                message: "Select your preferred package manager:",
                choices: ["npm", "pnpm", "yarn", "bun"],
                default: "npm",
            },
        ]);

        try {
            execSync(`${packageManager} --version`, { stdio: "ignore" });
        } catch {
            console.log(
                chalk.red(`⚠️ ${packageManager} not found. Install it here: ${guides[packageManager]}`)
            );
            process.exit(1);
        }

        const { outDir } = await inquirer.prompt<{ outDir: string }>([
            {
                type: "input",
                name: "outDir",
                message: "Where should components be installed?",
                default: "src/components/advantisui",
            },
        ]);

        const resolvedDir = path.resolve(process.cwd(), outDir);
        if (!fs.existsSync(resolvedDir)) {
            const { createDir } = await inquirer.prompt<{ createDir: boolean }>([
                {
                    type: "confirm",
                    name: "createDir",
                    message: `Directory "${outDir}" does not exist. Create it?`,
                    default: true,
                },
            ]);
            if (!createDir) process.exit(1);
            fs.mkdirSync(resolvedDir, { recursive: true });
        }

        const config: Config = { packageManager, outDir };
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(chalk.green("✅ Configuration saved."));
        return config;
    }

    try {
        return JSON.parse(fs.readFileSync(configPath, "utf8")) as Config;
    } catch {
        console.log(chalk.yellow("⚠️ Invalid config, using defaults."));
        return { outDir: "src/components/advantisui", packageManager: "npm" };
    }
}

async function getComponents(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "api.github.com",
            path: "/repos/Bluejutzu/advantisui/contents/src/components",
            headers: { "User-Agent": "AdvantisUI-CLI" }, // GitHub API requires a User-Agent
        };

        https.get(options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                if (res.statusCode !== 200) {
                    reject(new Error(`GitHub API request failed: ${res.statusCode}`));
                    return;
                }

                try {
                    const files: { name: string; type: string }[] = JSON.parse(data);
                    const components = files
                        .filter((f) => f.type === "file" && f.name.endsWith(".tsx"))
                        .map((f) => f.name.replace(/\.tsx$/, ""));
                    resolve(components);
                } catch (err) {
                    reject(err);
                }
            });
        }).on("error", reject);
    });
}

async function downloadComponent(name: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const url = `${GITHUB_BASE}/${name}.tsx`;
        console.log(chalk.cyan(`🌐 Fetching ${url}`));
        https
            .get(url, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to fetch ${url} (status ${res.statusCode})`));
                    return;
                }
                const fileStream = fs.createWriteStream(destPath);
                res.pipe(fileStream);
                fileStream.on("finish", () => {
                    fileStream.close((err) => {
                        if (err) reject(err);
                        else resolve()
                    })
                });
            })
            .on("error", reject);
    });
}

async function installComponent(name: string, outDir: string, installed = new Set<string>(), config?: Config) {
    if (installed.has(name)) return;

    const filePath = path.join(outDir, `${name}.tsx`);
    if (!fs.existsSync(filePath)) {
        const related = componentRelations[name as keyof typeof componentRelations] || [];
        for (const dep of related) {
            await installComponent(dep, outDir, installed, config);
        }

        try {
            await downloadComponent(name, filePath);
            console.log(chalk.green(`✅ Installed component: ${name}`));
            installed.add(name);
        } catch (err: any) {
            console.error(chalk.red(`❌ Failed to fetch ${name}: ${err.message}`));
        }
    } else {
        console.log(chalk.gray(`✔️ ${name} already exists.`));
        installed.add(name);
    }

    const deps = componentDependencies[name as keyof typeof componentDependencies] || [];
    if (deps.length > 0 && config) {
        const missing = deps.filter((dep) => {
            try {
                require.resolve(dep.split("@")[0], { paths: [process.cwd()] });
                return false;
            } catch {
                return true;
            }
        });

        if (missing.length > 0) {
            const { install } = await inquirer.prompt<{ install: boolean }>([
                {
                    type: "confirm",
                    name: "install",
                    message: `Missing dependencies for ${name}:\n${missing.join("\n")}\nInstall now?`,
                    default: true,
                },
            ]);

            if (install) {
                execSync(`${config.packageManager} install ${missing.join(" ")}`, { stdio: "inherit" });
            } else {
                console.log(chalk.yellow(`⚠️ Remember to install them manually.`));
            }
        }
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const components = args.slice(1).filter((a) => !a.startsWith("--"));

    if (!command || command === "-h" || command === "--help" || command === "help") {
        console.log(helpTexts.general);
        process.exit(0);
    }

    if (command === "list") {
        console.log(chalk.cyan("📦 Available components:"));
        const components = await getComponents();
        components.forEach((c) => console.log(` - ${c}`));
        process.exit(0);
    }


    if (command !== "add") {
        console.log(chalk.yellow("Usage: npx advantisui add <component>"));
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
