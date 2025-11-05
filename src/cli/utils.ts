import fs from "fs";
import path from "path";
import https from "https";
import crypto from "crypto";
import chalk from "chalk";
import inquirer from "inquirer";

export const GITHUB_BASE = "https://raw.githubusercontent.com/Bluejutzu/advantisui/main/src/components";
const METADATA_FILE = ".advantisui-metadata.json";

export interface Config {
    outDir: string;
    packageManager: "npm" | "pnpm" | "yarn" | "bun";
}

export function loadMetadata(outDir: string) {
    const metadataPath = path.join(outDir, METADATA_FILE);
    if (!fs.existsSync(metadataPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    } catch {
        console.log(chalk.yellow("⚠️ Metadata corrupted, recreating."));
        return {};
    }
}

export function saveMetadata(outDir: string, metadata: any) {
    fs.writeFileSync(path.join(outDir, METADATA_FILE), JSON.stringify(metadata, null, 2));
}

export function hashFile(filePath: string) {
    const content = fs.readFileSync(filePath, "utf8");
    return crypto.createHash("sha256").update(content).digest("hex");
}

export async function fetchFileHash(componentName: string): Promise<string | null> {
    return new Promise((resolve) => {
        const url = `${GITHUB_BASE}/${componentName}.tsx`;
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                resolve(null);
                return;
            }
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                const hash = crypto.createHash("sha256").update(data).digest("hex");
                resolve(hash);
            });
        }).on("error", () => resolve(null));
    });
}

export async function downloadComponent(name: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const url = `${GITHUB_BASE}/${name}.tsx`;
        https
            .get(url, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to fetch ${url}`));
                    return;
                }
                const fileStream = fs.createWriteStream(destPath);
                res.pipe(fileStream);
                fileStream.on("finish", () => {
                    fileStream.close((err) => (err ? reject(err) : resolve()));
                });
            })
            .on("error", reject);
    });
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
                outDir: config.outDir || "components",
                packageManager: config.packageManager || "npm",
            };
        } catch {
            console.log(chalk.red("❌ Invalid advantisui.config.json — check formatting."));
        }
    }

    // No config found — prompt user
    console.log(chalk.cyan("⚙️  No config found. Let's set up AdvantisUI.\n"));
    const answers = await inquirer.prompt([
        {
            type: "input",
            name: "outDir",
            message: "Where should components be installed?",
            default: "components",
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

/**
 * Fetch list of components available from GitHub.
 */
export async function getComponents(): Promise<string[]> {
    return new Promise((resolve) => {
        const url = "https://api.github.com/repos/Bluejutzu/advantisui/contents/src/components";
        https
            .get(
                url,
                {
                    headers: { "User-Agent": "advantisui-cli" },
                },
                (res) => {
                    if (res.statusCode !== 200) {
                        console.log(chalk.red("❌ Failed to fetch components list."));
                        resolve([]);
                        return;
                    }
                    let data = "";
                    res.on("data", (chunk) => (data += chunk));
                    res.on("end", () => {
                        try {
                            const json = JSON.parse(data);
                            const components = json
                                .filter((item: any) => item.name.endsWith(".tsx"))
                                .map((item: any) => item.name.replace(".tsx", ""));
                            resolve(components);
                        } catch {
                            resolve([]);
                        }
                    });
                }
            )
            .on("error", () => resolve([]));
    });
}

/**
 * Install a single component into the user's output directory.
 */
export async function installComponent(
    name: string,
    outDir: string,
    installed: Set<string>,
    config: Config
): Promise<void> {
    if (installed.has(name)) return;
    installed.add(name);

    const destPath = path.join(outDir, `${name}.tsx`);

    console.log(chalk.cyan(`📦 Installing ${name}...`));
    try {
        await downloadComponent(name, destPath);
        const metadata = loadMetadata(outDir);
        metadata[name] = {
            hash: hashFile(destPath),
            installedAt: new Date().toISOString(),
            lastChecked: new Date().toISOString(),
        };
        saveMetadata(outDir, metadata);
        console.log(chalk.green(`✅ Installed ${name}`));
    } catch (err: any) {
        console.error(chalk.red(`❌ Failed to install ${name}: ${err.message}`));
    }
}
