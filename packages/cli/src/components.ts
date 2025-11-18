import fs from "fs";
import path from "path";
import https from "https";
import chalk from "chalk";
import inquirer from "inquirer";
import { execSync } from "child_process";
import { GITHUB_BASE } from "./constants.js";
import { loadMetadata, saveMetadata, hashFile } from "./metadata.js";
import { Config } from "./config.js";
import { componentDependencies } from "./dependencies.js";

export async function downloadComponent(
  name: string,
  destPath: string,
): Promise<void> {
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
 * Fetch list of components available from GitHub.
 */
export async function getComponents(): Promise<string[]> {
  return new Promise((resolve) => {
    const url =
      "https://api.github.com/repos/Bluejutzu/advantisui/contents/src/components";
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
        },
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
  config: Config,
): Promise<void> {
  if (installed.has(name)) return;
  installed.add(name);

  const destPath = path.join(outDir, `${name}.tsx`);

  console.log(chalk.cyan(`📦 Installing ${name}...`));
  try {
    await downloadComponent(name, destPath);

    const metadata = loadMetadata(outDir);
    const deps =
      componentDependencies[name as keyof typeof componentDependencies] || [];

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
            message: `Missing dependencies for ${chalk.blue(name)}:\n${missing.join("\n")}\n${chalk.yellow("Install now?")}`,
            default: true,
          },
        ]);
        if (install) {
          console.log(
            chalk.gray(
              `Installing ${missing.length} dependencies using ${chalk.blue(config.packageManager)}${chalk.white("...")}`,
            ),
          );

          if (
            config.packageManager === "bun" ||
            config.packageManager === "pnpm"
          ) {
            execSync(`${config.packageManager} add ${missing.join(" ")}`, {
              stdio: "inherit",
            });
          } else {
            execSync(`${config.packageManager} install ${missing.join(" ")}`, {
              stdio: "inherit",
            });
          }
        } else {
          console.log(chalk.yellow(`⚠️ Remember to install them manually.`));
          console.log(chalk.yellow(`${missing.join("\n")}`));
        }
      }
    }

    // Update metadata
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
