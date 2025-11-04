#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import inquirer from "inquirer";
import chalk from "chalk";
import https from "https";
import { componentDependencies } from "./dependencies.js";

// GitHub raw URL for components repo
const GITHUB_BASE =
    "https://raw.githubusercontent.com/Bluejutzu/advantisui-components/main/components";

// Get or create components.json
function getConfig() {
    const configPath = path.resolve(process.cwd(), "components.json");
    if (!fs.existsSync(configPath)) {
        const defaultConfig = { outDir: "components/advantisui" };
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log(chalk.green("✅ Created default components.json"));
        return defaultConfig;
    }
    try {
        return JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch {
        console.log(chalk.red("❌ Failed to read components.json, using defaults."));
        return { outDir: "components/advantisui" };
    }
}

// Download a component from GitHub
async function downloadComponent(name: string, destPath: string) {
    return new Promise<void>((resolve, reject) => {
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

async function main() {
    const [, , command, name] = process.argv;

    if (command === "list") {
        console.log(chalk.cyan("📦 Available components (GitHub):"));
        console.log(" - button");
        console.log(" - input");
        console.log(" - card");
        process.exit(0);
    }

    if (command !== "add" || !name) {
        console.log(chalk.yellow("Usage: npx advantisui add <component>"));
        process.exit(1);
    }

    const { outDir } = getConfig();
    const targetDir = path.resolve(process.cwd(), outDir);
    const targetFile = path.join(targetDir, `${name}.tsx`);

    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    if (fs.existsSync(targetFile)) {
        const { overwrite } = await inquirer.prompt([
            {
                type: "confirm",
                name: "overwrite",
                message: `Component "${name}" already exists. Overwrite?`,
                default: false,
            },
        ]);
        if (!overwrite) return console.log(chalk.gray("Cancelled."));
    }

    try {
        await downloadComponent(name, targetFile);
        console.log(chalk.green(`✅ Added ${name} to ${outDir}/${name}.tsx`));
    } catch (err: any) {
        console.error(chalk.red("❌ Failed to fetch component from GitHub."));
        console.error(err.message);
        process.exit(1);
    }

    // === Dependency installer ===
    const deps = componentDependencies[name] || [];
    if (deps.length > 0) {
        console.log(chalk.cyan(`📦 Checking dependencies for ${name}...`));
        const missing = deps.filter((dep) => {
            const pkgName = dep.split("@")[0];
            try {
                require.resolve(pkgName, { paths: [process.cwd()] });
                return false;
            } catch {
                return true;
            }
        });

        if (missing.length > 0) {
            const { install } = await inquirer.prompt([
                {
                    type: "confirm",
                    name: "install",
                    message: `The following dependencies are missing:\n${missing.join(
                        "\n"
                    )}\nInstall now?`,
                    default: true,
                },
            ]);
            if (install) {
                console.log(chalk.blue(`Installing ${missing.join(", ")}...`));
                execSync(`npm install ${missing.join(" ")}`, { stdio: "inherit" });
            } else {
                console.log(chalk.yellow("⚠️  Remember to install them manually."));
            }
        } else {
            console.log(chalk.green("✅ All dependencies already installed."));
        }
    }
}

main().catch((err) => {
    console.error(chalk.red(err));
    process.exit(1);
});
