import * as path from 'node:path';

/**
 * Directory holding the sprint data — `sprint-wip.md`, `archive/`, `projects/`,
 * and the Obsidian vault.
 *
 * Defaults to `<repo>/.sprints` (the historical layout), but can be relocated
 * via the `SPRINT_DATA_DIR` env var — e.g. into a OneDrive-synced folder so the
 * data is backed up and shared across machines while the code stays in the Git
 * repo. An empty/whitespace value is treated as unset. `bin/sprint.ts` loads
 * `<repo>/.env` so the variable can be set there once for both the CLI and
 * `upload-sprint.js`. (#74)
 */
export function sprintsDir(repoPath: string): string {
  const override = process.env.SPRINT_DATA_DIR;
  return override && override.trim() ? override : path.join(repoPath, '.sprints');
}
