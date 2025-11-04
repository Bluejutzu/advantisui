#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import inquirer from "inquirer";
import chalk from "chalk";
import https from "https";
import { componentDependencies } from "./dependencies.js";
import { helpTexts } from "./help.js";

// GitHub raw URL
const GITHUB_BASE =
    "https://raw.githubusercontent.com/Bluejutzu/advantisui/main/src/components";

// Read or create components.json
function getConfig() {
    const configPath = path.resolve(process.cwd(), "components.json");
    if (!fs.existsSync(configPath)) {
        const defaultConfig = { outDir: "src/components/advantisui" };
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log(chalk.green("✅ Created default components.json"));
        return defaultConfig;
    }
    try {
        return JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch {
        return { outDir: "src/components/advantisui" };
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
                        else resolve();
                    });
                });
            })
            .on("error", reject);
    });
}

// Parse --name argument
function parseCustomNames(args: string[]): string[] {
    const nameIndex = args.indexOf("--name");
    if (nameIndex >= 0 && args[nameIndex + 1]) {
        return args[nameIndex + 1].split(",");
    }
    return [];
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (args.includes("-h") || args.includes("--help") || command === "help") {
        const sub = args[1] as keyof typeof helpTexts;

        if (sub && helpTexts[sub]) {
            console.log(helpTexts[sub]);
        } else {
            console.log(helpTexts.general);
        }
        process.exit(0);
    }

    if (command === "list") {
        console.log(chalk.cyan("📦 Available components (GitHub):"));
        console.log(" - button");
        console.log(" - input");
        console.log(" - card");
        process.exit(0);
    }

    if (command !== "add") {
        console.log(chalk.yellow("Usage: npx advantisui <command> [options]"));
        process.exit(1);
    }

    const components = args.slice(1).filter(a => !a.startsWith("--"));
    const customNames = parseCustomNames(args);
    const { outDir } = getConfig();
    const targetDir = path.resolve(process.cwd(), outDir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    for (let i = 0; i < components.length; i++) {
        const origName = components[i];
        const fileName = customNames[i] || origName;
        const targetFile = path.join(targetDir, `${fileName}.tsx`);

        if (fs.existsSync(targetFile)) {
            const { overwrite } = await inquirer.prompt([
                {
                    type: "confirm",
                    name: "overwrite",
                    message: `Component "${fileName}" already exists. Overwrite?`,
                    default: false,
                },
            ]);
            if (!overwrite) {
                console.log(chalk.gray("Cancelled."));
                continue;
            }
        }

        try {
            await downloadComponent(origName, targetFile);
            console.log(chalk.green(`✅ Added ${origName} as ${fileName} to ${outDir}`));
        } catch (err: any) {
            console.error(chalk.red(`❌ Failed to fetch ${origName}`));
            console.error(err.message);
            continue;
        }

        // Install dependencies using original name
        const deps = componentDependencies[origName] || [];
        if (deps.length > 0) {
            const missing = deps.filter(dep => {
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
                        message: `Dependencies for ${origName} missing:\n${missing.join(
                            "\n"
                        )}\nInstall now?`,
                        default: true,
                    },
                ]);
                if (install) {
                    execSync(`npm install ${missing.join(" ")}`, { stdio: "inherit" });
                } else {
                    console.log(chalk.yellow("⚠️  Remember to install them manually."));
                }
            }
        }
    }
}

main().catch(err => {
    console.error(chalk.red(err));
    process.exit(1);
});
