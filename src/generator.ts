import path from "node:path";
import { spawn } from "node:child_process";
import fs from "fs-extra";
import type { PackageManager } from "./prompts.js";

/** Renames package.json's "name" field to match the new project/folder name */
export async function preparePackageJson(destination: string, projectName: string): Promise<void> {
  const pkgPath = path.join(destination, "package.json");
  if (!(await fs.pathExists(pkgPath))) return;

  const pkg = await fs.readJson(pkgPath);
  pkg.name = projectName;
  pkg.version = pkg.version || "0.1.0";
  await fs.writeJson(pkgPath, pkg, { spaces: 2 });
}

/** Copies .env.example -> .env if the template ships one and .env doesn't already exist */
export async function prepareEnvFile(destination: string): Promise<void> {
  const examplePath = path.join(destination, ".env.example");
  const envPath = path.join(destination, ".env");
  if ((await fs.pathExists(examplePath)) && !(await fs.pathExists(envPath))) {
    await fs.copy(examplePath, envPath);
  }
}

function runCommand(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`))
    );
    child.on("error", reject);
  });
}

/** Initializes a fresh git repo with one commit. Non-fatal if git isn't installed. */
export async function initGit(destination: string): Promise<void> {
  try {
    await runCommand("git", ["init", "-q"], destination);
    await runCommand("git", ["add", "-A"], destination);
    await runCommand("git", ["commit", "-q", "-m", "Initial commit from startdevcode"], destination);
  } catch {
    // git is optional — silently skip if unavailable or fails
  }
}

export async function installDependencies(manager: PackageManager, destination: string): Promise<void> {
  const args = manager === "yarn" ? [] : ["install"];
  await runCommand(manager, args, destination);
}
