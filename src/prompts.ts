import prompts from "prompts";
import type { Manifest } from "./github.js";

const onCancel = () => {
  console.log("\nCancelled.");
  process.exit(1);
};

export async function promptTemplate(manifest: Manifest, preselected?: string): Promise<string> {
  if (preselected) {
    if (!manifest.templates[preselected]) {
      throw new Error(
        `Unknown template "${preselected}". Available: ${Object.keys(manifest.templates).join(", ")}`
      );
    }
    return preselected;
  }

  const choices = Object.entries(manifest.templates).map(([key, val]) => ({
    title: val.description ?? key,
    description: key,
    value: key,
  }));

  const { template } = await prompts(
    {
      type: "select",
      name: "template",
      message: "Which template do you want?",
      choices,
    },
    { onCancel }
  );

  return template as string;
}

export async function promptProjectName(preselected?: string): Promise<string> {
  if (preselected) return preselected;

  const { name } = await prompts(
    {
      type: "text",
      name: "name",
      message: "Project name:",
      initial: "my-project",
      validate: (v: string) =>
        /^[a-z0-9-_]+$/i.test(v) ? true : "Use letters, numbers, - and _ only",
    },
    { onCancel }
  );

  return name as string;
}

export type PackageManager = "npm" | "yarn" | "pnpm";

/** Asks whether to install now, and if so, with which package manager. Returns null to skip. */
export async function promptInstall(): Promise<PackageManager | null> {
  const { shouldInstall } = await prompts(
    {
      type: "confirm",
      name: "shouldInstall",
      message: "Install dependencies now?",
      initial: true,
    },
    { onCancel }
  );

  if (!shouldInstall) return null;

  const { manager } = await prompts(
    {
      type: "select",
      name: "manager",
      message: "Which package manager?",
      choices: [
        { title: "npm", value: "npm" },
        { title: "yarn", value: "yarn" },
        { title: "pnpm", value: "pnpm" },
      ],
      initial: 0,
    },
    { onCancel }
  );

  return manager as PackageManager;
}
