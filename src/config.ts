/**
 * Central configuration for where templates live.
 *
 * All of these can be overridden with environment variables, which is what
 * lets the SAME published CLI work for public templates out of the box,
 * while still letting you (or anyone you grant access to) point at a
 * private fork or a different org.
 */
export const CONFIG = {
  /** GitHub username or org that owns the templates repo */
  owner: process.env.STARTDEVCODE_OWNER || "krupal-036",

  /** Name of the repo that stores all boilerplates + manifest.json */
  repo: process.env.STARTDEVCODE_REPO || "startdevcode-templates",

  /** Default branch/ref used to read manifest.json (per-template ref can override this) */
  ref: process.env.STARTDEVCODE_REF || "main",

  /**
   * Personal Access Token (classic, `repo` scope, or fine-grained with
   * "Contents: Read-only") — required only if the templates repo is
   * PRIVATE. Public repos work with no token (subject to GitHub's
   * unauthenticated rate limit, ~60 req/hour).
   */
  token: process.env.STARTDEVCODE_GITHUB_TOKEN,
};
