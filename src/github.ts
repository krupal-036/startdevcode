import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import * as tar from "tar";

export interface TemplateManifestEntry {
  /** Path inside the templates repo, e.g. "templates/react" */
  path: string;
  /** Shown in the interactive picker */
  description: string;
  /** Git ref (branch or tag) to use when none is passed on the CLI */
  defaultRef: string;
}

export interface Manifest {
  templates: Record<string, TemplateManifestEntry>;
}

interface GitHubHeaders extends Record<string, string> {
  "User-Agent": string;
  Accept: string;
}

function authHeaders(token?: string): GitHubHeaders {
  const headers: GitHubHeaders = {
    "User-Agent": "startdevcode-cli",
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `token ${token}`;
  return headers;
}

/**
 * Reads manifest.json from the templates repo.
 * - Public repos: fetched via the fast raw.githubusercontent.com CDN.
 * - Private repos (token present): fetched via the Contents API, which
 *   requires auth and returns base64-encoded content.
 */
export async function fetchManifest(
  owner: string,
  repo: string,
  ref: string,
  token?: string
): Promise<Manifest> {
  const url = token
    ? `https://api.github.com/repos/${owner}/${repo}/contents/manifest.json?ref=${encodeURIComponent(ref)}`
    : `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/manifest.json`;

  const res = await fetch(url, { headers: authHeaders(token) });

  if (!res.ok) {
    throw new Error(
      `Could not load template manifest from ${owner}/${repo}@${ref} (HTTP ${res.status}). ` +
        (token
          ? "Check your STARTDEVCODE_GITHUB_TOKEN and repo access."
          : "If this repo is private, set STARTDEVCODE_GITHUB_TOKEN.")
    );
  }

  if (token) {
    const json = (await res.json()) as { content: string; encoding: string };
    const decoded = Buffer.from(json.content, json.encoding as BufferEncoding).toString("utf-8");
    return JSON.parse(decoded) as Manifest;
  }

  return (await res.json()) as Manifest;
}

export interface FetchTemplateOptions {
  owner: string;
  repo: string;
  /** Git tag or branch to download, e.g. "react-v1.2.0" or "main" */
  ref: string;
  /** Sub-folder inside the repo that holds this specific template */
  templatePath: string;
  /** Empty target directory to copy the template into */
  destination: string;
  token?: string;
}

/**
 * Downloads a full repo tarball at a given ref via the GitHub REST API
 * (works for public AND private repos with a token), extracts it to a
 * temp dir, then copies just the requested template sub-folder into the
 * destination directory.
 *
 * Using the tarball API (not `git clone`) means the user's machine never
 * needs git installed, and it works identically for tags, branches, or
 * commit SHAs.
 */
export async function fetchTemplate(opts: FetchTemplateOptions): Promise<void> {
  const { owner, repo, ref, templatePath, destination, token } = opts;

  const url = `https://api.github.com/repos/${owner}/${repo}/tarball/${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: authHeaders(token), redirect: "follow" });

  if (!res.ok) {
    throw new Error(
      `Failed to download template (HTTP ${res.status} ${res.statusText}). ` +
        `Verify that "${owner}/${repo}" exists and ref "${ref}" is valid` +
        (token ? "." : " — if this is a private repo, set STARTDEVCODE_GITHUB_TOKEN.")
    );
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "startdevcode-"));
  try {
    const tarballPath = path.join(tmpDir, "template.tar.gz");
    await fs.writeFile(tarballPath, Buffer.from(await res.arrayBuffer()));

    const extractDir = path.join(tmpDir, "extracted");
    await fs.ensureDir(extractDir);
    await tar.x({ file: tarballPath, cwd: extractDir });

    // GitHub tarballs always extract into a single root folder like
    // "owner-repo-<sha>" — find it dynamically.
    const [rootFolder] = await fs.readdir(extractDir);
    if (!rootFolder) throw new Error("Downloaded template archive was empty.");

    const sourceDir = path.join(extractDir, rootFolder, templatePath);
    if (!(await fs.pathExists(sourceDir))) {
      throw new Error(`Template path "${templatePath}" was not found in ${owner}/${repo}@${ref}.`);
    }

    await fs.copy(sourceDir, destination, { overwrite: false, errorOnExist: true });
  } finally {
    await fs.remove(tmpDir);
  }
}
