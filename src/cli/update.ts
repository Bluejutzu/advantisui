import fs from "fs";
import path from "path";
import chalk from "chalk";
import inquirer from "inquirer";
import { downloadComponent, loadMetadata, saveMetadata, hashFile, fetchFileHash } from "./utils.js";

const METADATA_FILE = ".advantisui-metadata.json";

export interface Config {
    outDir: string;
    packageManager: "npm" | "pnpm" | "yarn" | "bun";
}

export async function checkForUpdates(outDir: string) {
    const metadata = loadMetadata(outDir);
    const results: { component: string; status: "outdated" | "modified" | "up-to-date" }[] = [];

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

            const storedHash = metadata[componentName]?.hash;
            const isDifferentFromRemote = currentHash !== remoteHash;

            if (!isDifferentFromRemote) {
                console.log(`Hash are not different ${remoteHash} ${currentHash}`)
                results.push({ component: componentName, status: "up-to-date" });
                if (currentHash !== storedHash) {
                    metadata[componentName] = { ...metadata[componentName], hash: currentHash };
                    console.log(`Curr and stored are same ${currentHash} ${storedHash}`)
                }
            } else {
                if (storedHash) {
                    if (storedHash !== remoteHash) {
                        console.log(`Hash are different but stored and remote are not same ${storedHash} ${remoteHash}`)
                        results.push({ component: componentName, status: "outdated" });
                    } else {
                        console.log(`Hash are different but stored and remote are same  ${storedHash} ${remoteHash}`)
                        results.push({ component: componentName, status: "modified" });
                    }
                } else {
                    console.log(`Hashes are differnet but no stored hash`)
                    results.push({ component: componentName, status: "outdated" });
                }
            }

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

export async function updateComponents(outDir: string, componentsToUpdate: string[], config: Config) {
    const metadata = loadMetadata(outDir);
    let updatedCount = 0;
    let failedCount = 0;

    for (const component of componentsToUpdate) {
        const filePath = path.join(outDir, `${component}.tsx`);
        const backupPath = path.join(outDir, `${component}.tsx.backup`);

        try {
            fs.copyFileSync(filePath, backupPath);
            await downloadComponent(component, filePath);

            metadata[component] = {
                hash: hashFile(filePath),
                installedAt: metadata[component]?.installedAt || new Date().toISOString(),
                lastChecked: new Date().toISOString(),
            };

            fs.unlinkSync(backupPath);
            console.log(chalk.green(`✅ Updated ${component}`));
            updatedCount++;
        } catch (err: any) {
            console.error(chalk.red(`❌ Failed to update ${component}: ${err.message}`));
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
    if (failedCount > 0) console.log(chalk.red(`   ❌ Failed: ${failedCount}`));
}

export async function handleUpdateCommand(config: Config) {
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

    if (upToDate.length > 0) {
        console.log(chalk.green(`✅ Up to date (${upToDate.length}):`));
        upToDate.forEach((r) => console.log(chalk.gray(`   • ${r.component}`)));
        console.log();
    }

    if (outdated.length > 0) {
        console.log(chalk.yellow(`🚨 Outdated (${outdated.length}):`));
        outdated.forEach((r) => console.log(chalk.yellow(`   • ${r.component}`)));
        console.log();
    }

    if (modified.length > 0) {
        console.log(chalk.yellow(`⚠️  Modified locally (${modified.length}):`));
        modified.forEach((r) => console.log(chalk.yellow(`   • ${r.component}`)));
        console.log();
    }

    if (outdated.length === 0 && modified.length === 0) {
        console.log(chalk.green("🎉 All components are up to date!"));
        return;
    }

    const { updateChoice } = await inquirer.prompt<{ updateChoice: "all" | "select" | "none" }>([
        {
            type: "list",
            name: "updateChoice",
            message: "How would you like to update components?",
            choices: [
                { name: "Update all outdated + modified components", value: "all" },
                { name: "Select specific components to update", value: "select" },
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
        componentsToUpdate = [...outdated, ...modified].map((r) => r.component);
    } else {
        const { selected } = await inquirer.prompt<{ selected: string[] }>([
            {
                type: "checkbox",
                name: "selected",
                message: "Select components to update (will overwrite local changes):",
                choices: [...outdated, ...modified].map((r) => ({
                    name: `${r.component}${r.status === "modified" ? " (modified)" : ""}`,
                    value: r.component,
                })),
            },
        ]);
        if (selected.length === 0) {
            console.log(chalk.gray("No components selected."));
            return;
        }
        componentsToUpdate = selected;
    }

    await updateComponents(outDir, componentsToUpdate, config);
}
