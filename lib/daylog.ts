import * as fs from 'node:fs';
import * as path from 'node:path';
import { sprintsDir } from './paths.js';

/**
 * Appends one line to `day-log.md` in the sprint data directory. Used by
 * `/day-wrap` to leave a running record (output + blocker) that the next
 * `/sprint-start` can read instead of reconstructing the week from scratch.
 *
 * Writing happens entirely in Node (not shell `cat >>`) so the line's
 * free-text content is never subject to shell expansion — the caller
 * supplies the already-assembled line, this function only adds the leading
 * date stamp and a trailing newline.
 */
export function appendDayLog(repoPath: string, date: string, line: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date: ${date}`);
  const dir = sprintsDir(repoPath);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, 'day-log.md');
  const entry = `- [${date}]: ${line.trim()}\n`;
  fs.appendFileSync(dest, entry);
  return dest;
}
