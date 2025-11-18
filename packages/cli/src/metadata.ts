import fs from "fs";
import path from "path";
import crypto from "crypto";
import https from "https";
import chalk from "chalk";
import { METADATA_FILE, GITHUB_BASE } from "./constants.js";

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
  fs.writeFileSync(
    path.join(outDir, METADATA_FILE),
    JSON.stringify(metadata, null, 2),
  );
}

export function hashFile(filePath: string) {
  const content = fs.readFileSync(filePath, "utf8");
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function fetchFileHash(
  componentName: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const url = `${GITHUB_BASE}/${componentName}.tsx`;
    https
      .get(url, (res) => {
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
      })
      .on("error", () => resolve(null));
  });
}
