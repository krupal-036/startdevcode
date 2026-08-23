#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import chalk from "chalk";
import fs from "fs-extra";
import { CONFIG } from "./config.js";
import { fetchManifest, fetchTemplate } from "./github.js";
import { promptTemplate, promptProjectName, promptInstall } from "./prompts.js";
import { preparePackageJson, prepareEnvFile, initGit, installDependencies } from "./generator.js";

const program = new Command();

program
  .name("STARTDEVCODE")
  .description("Scaffold a new project from your personal boilerplate templates")
  .version("1.0.0")
  .argument("[template]", "template name (react, node, nest, next, mern)")
  .argument("[projectName]", "name of the project / target directory")
  .option("-v, --template-version <ref>", "git tag/branch of the template to use, overrides the default")
  .option("--no-install", "skip the install-dependencies prompt entirely")
  .action(async (templateArg: string | undefined, projectNameArg: string | undefined, options) => {
    try {
      console.log(chalk.bold.cyan("\nSTARTDEVCODE — project generator\n"));

      const manifest = await fetchManifest(CONFIG.owner, CONFIG.repo, CONFIG.ref, CONFIG.token);
      const templateKey = await promptTemplate(manifest, templateArg);
      const entry = manifest.templates[templateKey];

      const projectName = await promptProjectName(projectNameArg);
      const destination = path.resolve(process.cwd(), projectName);

      if (await fs.pathExists(destination)) {
        console.error(chalk.red(`\nDirectory "${projectName}" already exists. Choose a different name.\n`));
        process.exit(1);
      }
      await fs.ensureDir(destination);

      const ref = options.templateVersion || entry.defaultRef || CONFIG.ref;

      console.log(chalk.gray(`Fetching "${templateKey}" @ ${ref} ...`));
      await fetchTemplate({
        owner: CONFIG.owner,
        repo: CONFIG.repo,
        ref,
        templatePath: entry.path,
        destination,
        token: CONFIG.token,
      });
      console.log(chalk.green("✔ Template downloaded"));

      await preparePackageJson(destination, projectName);
      await prepareEnvFile(destination);
      console.log(chalk.green("✔ Files configured"));

      await initGit(destination);

      let manager: "npm" | "yarn" | "pnpm" | null = null;
      if (options.install !== false) {
        manager = await promptInstall(); // <-- asks "Install dependencies now?" then npm/yarn/pnpm
      }

      if (manager) {
        console.log(chalk.gray(`Installing dependencies with ${manager} ...`));
        await installDependencies(manager, destination);
        console.log(chalk.green("✔ Dependencies installed"));
      } else {
        console.log(chalk.yellow("Skipped dependency installation."));
      }

      console.log(chalk.bold.green("\nProject created successfully!\n"));
      console.log(`  cd ${projectName}`);
      if (!manager) console.log("  npm install");
      console.log("  npm run dev\n");
    } catch (err) {
      console.error(chalk.red(`\n✖ ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

program.parseAsync();
