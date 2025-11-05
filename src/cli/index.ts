#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import inquirer from "inquirer";
import chalk from "chalk";
import https from "https";
import crypto from "crypto";
import { componentDependencies, componentRelations } from "./dependencies.js";
import { helpTexts } from "./help.js";
import { guides } from "./guides.js";

const GITHUB_BASE = "https://raw.githubusercontent.com/Bluejutzu/advantisui/main/src/components";
const METADATA_FILE = ".advantisui-metadata.json";

interface Config {
    outDir: string;
    packageManager: "npm" | "pnpm" | "yarn" | "bun";
}

interface ComponentMetadata {
    [componentName: string]: {
        hash: string;
        installedAt: string;
        lastChecked?: string;
    };
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

function getMetadataPath(outDir: string): string {
    return path.join(outDir, METADATA_FILE);
}

function loadMetadata(outDir: string): ComponentMetadata {
    const metadataPath = getMetadataPath(outDir);
    if (!fs.existsSync(metadataPath)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    } catch {
        console.log(chalk.yellow("⚠️ Metadata file corrupted, creating new one."));
        return {};
    }
}

function saveMetadata(outDir: string, metadata: ComponentMetadata): void {
    const metadataPath = getMetadataPath(outDir);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

function hashFile(filePath: string): string {
    const content = fs.readFileSync(filePath, "utf8");
    return crypto.createHash("sha256").update(content).digest("hex");
}

async function fetchFileHash(componentName: string): Promise<string | null> {
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

async function getComponents(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: "api.github.com",
            path: "/repos/Bluejutzu/advantisui/contents/src/components",
            headers: { "User-Agent": "AdvantisUI-CLI" },
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
                        else resolve();
                    });
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

            // Save metadata after installation
            const metadata = loadMetadata(outDir);
            metadata[name] = {
                hash: hashFile(filePath),
                installedAt: new Date().toISOString(),
            };
            saveMetadata(outDir, metadata);
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

async function checkForUpdates(outDir: string): Promise<{ component: string; status: "outdated" | "modified" | "up-to-date" }[]> {
    const metadata = loadMetadata(outDir);
    const results: { component: string; status: "outdated" | "modified" | "up-to-date" }[] = [];

    // Get all .tsx files in the directory
    const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".tsx") && f !== METADATA_FILE);

    if (files.length === 0) {
        console.log(chalk.yellow("⚠️ No components found in the output directory."));
        return results;
    }

    console.log(chalk.cyan(`🔍 Checking ${files.length} component(s) for updates...\n`));

    for (const file of files) {
        const componentName = file.replace(/\.tsx$/, "");
        const filePath = path.join(outDir, file);

        try {
            const currentHash = hashFile(filePath);
            const remoteHash = await fetchFileHash(componentName);

            if (!remoteHash) {
                console.log(chalk.yellow(`⚠️ ${componentName}: Could not fetch remote version (may have been removed)`));
                continue;
            }

            // Check if component was modified locally
            const storedHash = metadata[componentName]?.hash;
            const wasModifiedLocally = storedHash && storedHash !== currentHash;

            if (currentHash === remoteHash) {
                results.push({ component: componentName, status: "up-to-date" });
            } else if (wasModifiedLocally) {
                results.push({ component: componentName, status: "modified" });
            } else {
                results.push({ component: componentName, status: "outdated" });
            }

            // Update last checked time
            if (metadata[componentName]) {
                metadata[componentName].lastChecked = new Date().toISOString();
            }
        } catch (err: any) {
            console.log(chalk.red(`❌ Error checking ${componentName}: ${err.message}`));
        }
    }

    saveMetadata(outDir, metadata);
    return results;
}

async function updateComponents(outDir: string, componentsToUpdate: string[], config: Config) {
    const metadata = loadMetadata(outDir);
    let updatedCount = 0;
    let failedCount = 0;

    for (const component of componentsToUpdate) {
        const filePath = path.join(outDir, `${component}.tsx`);
        const backupPath = path.join(outDir, `${component}.tsx.backup`);

        try {
            // Create backup
            fs.copyFileSync(filePath, backupPath);

            // Download new version
            await downloadComponent(component, filePath);

            // Update metadata
            metadata[component] = {
                hash: hashFile(filePath),
                installedAt: metadata[component]?.installedAt || new Date().toISOString(),
                lastChecked: new Date().toISOString(),
            };

            // Remove backup on success
            fs.unlinkSync(backupPath);

            console.log(chalk.green(`✅ Updated ${component}`));
            updatedCount++;
        } catch (err: any) {
            console.error(chalk.red(`❌ Failed to update ${component}: ${err.message}`));

            // Restore backup on failure
            if (fs.existsSync(backupPath)) {
                fs.copyFileSync(backupPath, filePath);
                fs.unlinkSync(backupPath);
                console.log(chalk.yellow(`↩️  Restored ${component} from backup`));
            }

            failedCount++;
        }
    }

    saveMetadata(outDir, metadata);

    console.log(chalk.cyan(`\n📊 Update Summary:`));
    console.log(chalk.green(`   ✅ Updated: ${updatedCount}`));
    if (failedCount > 0) {
        console.log(chalk.red(`   ❌ Failed: ${failedCount}`));
    }
}

async function handleUpdateCommand(config: Config) {
    const outDir = path.resolve(process.cwd(), config.outDir);

    if (!fs.existsSync(outDir)) {
        console.log(chalk.red(`❌ Component directory "${config.outDir}" does not exist.`));
        process.exit(1);
    }

    const results = await checkForUpdates(outDir);

    if (results.length === 0) {
        console.log(chalk.yellow("No components found to check."));
        return;
    }

    const outdated = results.filter((r) => r.status === "outdated");
    const modified = results.filter((r) => r.status === "modified");
    const upToDate = results.filter((r) => r.status === "up-to-date");

    // Display results
    if (upToDate.length > 0) {
        console.log(chalk.green(`✅ Up to date (${upToDate.length}):`));
        upToDate.forEach((r) => console.log(chalk.gray(`   • ${r.component}`)));
        console.log();
    }

    if (modified.length > 0) {
        console.log(chalk.yellow(`⚠️  Modified locally (${modified.length}):`));
        modified.forEach((r) => console.log(chalk.yellow(`   • ${r.component}`)));
        console.log(chalk.dim("   These won't be updated to avoid overwriting your changes.\n"));
    }

    if (outdated.length === 0) {
        console.log(chalk.green("🎉 All components are up to date!"));
        return;
    }

    console.log(chalk.cyan(`📦 Outdated components (${outdated.length}):`));
    outdated.forEach((r) => console.log(chalk.cyan(`   • ${r.component}`)));
    console.log();

    const { updateChoice } = await inquirer.prompt<{ updateChoice: "all" | "select" | "none" }>([
        {
            type: "list",
            name: "updateChoice",
            message: "How would you like to update?",
            choices: [
                { name: "Update all outdated components", value: "all" },
                { name: "Select components to update", value: "select" },
                { name: "Cancel", value: "none" },
            ],
            default: "all",
        },
    ]);

    if (updateChoice === "none") {
        console.log(chalk.gray("Update cancelled."));
        return;
    }

    let componentsToUpdate: string[] = [];

    if (updateChoice === "all") {
        componentsToUpdate = outdated.map((r) => r.component);
    } else {
        const { selected } = await inquirer.prompt<{ selected: string[] }>([
            {
                type: "checkbox",
                name: "selected",
                message: "Select components to update:",
                choices: outdated.map((r) => ({ name: r.component, value: r.component })),
            },
        ]);

        if (selected.length === 0) {
            console.log(chalk.gray("No components selected."));
            return;
        }

        componentsToUpdate = selected;
    }

    // Warn about modified components if user tries to update
    if (modified.length > 0) {
        console.log(chalk.yellow("\n⚠️  Note: Modified components will not be updated automatically."));
        console.log(chalk.dim("   To update them, you'll need to manually merge changes or reinstall.\n"));
    }

    await updateComponents(outDir, componentsToUpdate, config);
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

    if (command === "update") {
        const config = await getConfig();
        await handleUpdateCommand(config);
        process.exit(0);
    }

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