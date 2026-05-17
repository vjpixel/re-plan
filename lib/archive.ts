import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ArchiveContext {
  path: string;
  date: string;
  on_my_mind: string[];
  on_hold: string[];
  health_goals: Record<string, string>;
  improvement_goals: string[];
}

export function latestArchivePath(repoPath: string): string | null {
  const archiveDir = path.join(repoPath, '.sprints', 'archive');
  const legacy = path.join(repoPath, '.sprints', 'sprint-final.md');

  if (fs.existsSync(archiveDir)) {
    const files = fs.readdirSync(archiveDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort();
    if (files.length > 0) return path.join(archiveDir, files[files.length - 1]);
  }

  return fs.existsSync(legacy) ? legacy : null;
}

export function parsePriorPlanning(content: string): Pick<ArchiveContext, 'on_my_mind' | 'on_hold' | 'health_goals' | 'improvement_goals'> {
  const lines = content.split('\n');
  const on_my_mind: string[] = [];
  const on_hold: string[] = [];
  const health_goals: Record<string, string> = {};
  const improvement_goals: string[] = [];

  type Section = 'none' | 'on_my_mind' | 'on_hold';
  let section: Section = 'none';
  let inHealthTable = false;
  let inImprovementTable = false;

  for (const raw of lines) {
    const line = raw.trim();

    if (line === '## On my mind') { section = 'on_my_mind'; inHealthTable = false; inImprovementTable = false; continue; }
    if (line === '## On hold') { section = 'on_hold'; inHealthTable = false; inImprovementTable = false; continue; }
    if (line.startsWith('#')) { section = 'none'; inHealthTable = false; inImprovementTable = false; }

    if (section === 'on_my_mind' && line && !line.startsWith('#')) {
      on_my_mind.push(line.replace(/^[*-]\s*/, ''));
    }
    if (section === 'on_hold' && line && !line.startsWith('#')) {
      on_hold.push(line.replace(/^[*-]\s*/, ''));
    }

    if (/^\|\s*Health\s*\|\s*Goal\s*\|/i.test(line)) { inHealthTable = true; inImprovementTable = false; continue; }
    if (inHealthTable) {
      const isSeparator = /^\|[\s:|-]+\|$/.test(line) && /-/.test(line);
      if (line.startsWith('|') && !isSeparator) {
        const cells = line.split('|').map(c => c.replace(/\*\*/g, '').trim()).filter(Boolean);
        if (cells.length >= 2 && cells[0]) health_goals[cells[0]] = cells[1];
      } else if (!line.startsWith('|')) {
        inHealthTable = false;
      }
    }

    if (/^\|\s*Improvement\s*\|$/i.test(line)) { inImprovementTable = true; inHealthTable = false; continue; }
    if (inImprovementTable) {
      const isSeparator = /^\|[\s:|-]+\|$/.test(line) && /-/.test(line);
      if (line.startsWith('|') && !isSeparator) {
        const cells = line.split('|').map(c => c.replace(/\*\*/g, '').trim()).filter(Boolean);
        if (cells.length >= 1 && cells[0]) improvement_goals.push(cells[0]);
      } else if (!line.startsWith('|')) {
        inImprovementTable = false;
      }
    }
  }

  return { on_my_mind, on_hold, health_goals, improvement_goals };
}

export function loadLatestArchive(repoPath: string): ArchiveContext | null {
  const filePath = latestArchivePath(repoPath);
  if (!filePath) return null;

  const content = fs.readFileSync(filePath, 'utf8');
  const dateMatch = path.basename(filePath).match(/^(\d{4}-\d{2}-\d{2})\.md$/);
  const date = dateMatch ? dateMatch[1] : 'unknown';

  return { path: filePath, date, ...parsePriorPlanning(content) };
}
