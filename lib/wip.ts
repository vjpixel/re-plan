import * as fs from 'node:fs';
import * as path from 'node:path';
import { stripDayPlan } from './document.js';
import { sprintsDir } from './paths.js';

export interface WipData {
  path: string;
  period: string;
  generated_at: string;
  content: string;
}

function wipPath(repoPath: string): string {
  return path.join(sprintsDir(repoPath), 'sprint-wip.md');
}

function parseWipHeader(content: string): { period: string; generated_at: string } {
  const m = content.match(/<!--\s*sprint-wip:\s*([^|]+?)\s*\|\s*gerado em:\s*(.+?)\s*-->/);
  return { period: m ? m[1].trim() : '', generated_at: m ? m[2].trim() : '' };
}

export function readWip(repoPath: string): WipData | null {
  const p = wipPath(repoPath);
  if (!fs.existsSync(p)) return null;
  const content = fs.readFileSync(p, 'utf8');
  return { path: p, ...parseWipHeader(content), content };
}

export function archiveWip(repoPath: string, endDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw new Error(`Invalid date: ${endDate}`);
  const src = wipPath(repoPath);
  if (!fs.existsSync(src)) throw new Error('sprint-wip.md not found');
  // Finalize the wip on archive: drop the `## Plano do dia` morning snapshot so
  // both the archive and the file uploaded to the Google Doc carry only
  // Review/Retro/Planning. Idempotent — a no-op once the section is gone. (#73)
  const cleaned = stripDayPlan(fs.readFileSync(src, 'utf8'));
  fs.writeFileSync(src, cleaned);
  const archiveDir = path.join(sprintsDir(repoPath), 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  const dest = path.join(archiveDir, `${endDate}.md`);
  fs.writeFileSync(dest, cleaned);
  return dest;
}
