import * as fs from 'node:fs';
import * as path from 'node:path';

export interface WipData {
  path: string;
  period: string;
  generated_at: string;
  content: string;
}

function wipPath(repoPath: string): string {
  return path.join(repoPath, '.sprints', 'sprint-wip.md');
}

function parseWipHeader(content: string): { period: string; generated_at: string } {
  const m = content.match(/<!--\s*sprint-wip:\s*([^|]+)\|\s*gerado em:\s*([^-\n]+?)\s*-->/);
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
  const archiveDir = path.join(repoPath, '.sprints', 'archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  const dest = path.join(archiveDir, `${endDate}.md`);
  fs.copyFileSync(src, dest);
  return dest;
}
