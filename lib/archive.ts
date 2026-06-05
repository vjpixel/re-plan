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

type PriorPlanning = Pick<ArchiveContext, 'on_my_mind' | 'on_hold' | 'health_goals' | 'improvement_goals'>;

export function parsePriorPlanning(content: string): PriorPlanning {
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

function stripScalar(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && ((t[0] === '"' && t.endsWith('"')) || (t[0] === "'" && t.endsWith("'")))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseInlineList(val: string): string[] {
  const inner = val.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map(stripScalar).filter(s => s.length > 0);
}

export type FrontmatterValue = string | string[] | Record<string, string>;

/**
 * Parse leading YAML frontmatter into a generic object. Supports the subset the
 * sprint docs use: scalars, block/inline lists of scalars, and one level of
 * nested maps (e.g. health_goals, results_*). Returns null when there is no
 * frontmatter block. Deliberately tiny and schema-shaped — no YAML dependency.
 */
export function parseFrontmatterObject(content: string): Record<string, FrontmatterValue> | null {
  const m = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return null;

  const obj: Record<string, FrontmatterValue> = {};
  let pendingKey: string | null = null; // empty-valued key awaiting indented children

  for (const rawLine of m[1].split(/\r?\n/)) {
    if (!rawLine.trim() || /^\s*#/.test(rawLine)) continue;
    const indent = rawLine.length - rawLine.replace(/^\s+/, '').length;
    const line = rawLine.trim();

    if (pendingKey && indent > 0) {
      if (line.startsWith('- ')) {
        if (!Array.isArray(obj[pendingKey])) obj[pendingKey] = [];
        (obj[pendingKey] as string[]).push(stripScalar(line.slice(2)));
      } else {
        const kv = line.match(/^(.+?):\s*(.*)$/);
        if (kv) {
          if (typeof obj[pendingKey] !== 'object' || Array.isArray(obj[pendingKey])) obj[pendingKey] = {};
          (obj[pendingKey] as Record<string, string>)[stripScalar(kv[1])] = stripScalar(kv[2]);
        }
      }
      continue;
    }

    const top = indent === 0 ? rawLine.match(/^([A-Za-z_][\w-]*):[ \t]*(.*)$/) : null;
    pendingKey = null;
    if (!top) continue;

    const key = top[1];
    const val = top[2].trim();
    if (val === '') pendingKey = key;                       // children decide list vs map
    else if (val === '[]') obj[key] = [];
    else if (val === '{}') obj[key] = {};
    else if (val.startsWith('[') && val.endsWith(']')) obj[key] = parseInlineList(val);
    else obj[key] = stripScalar(val);
  }

  return obj;
}

/**
 * Read the prior sprint's planning fields from frontmatter. Returns null if
 * there is no frontmatter or it carries none of the planning keys, so callers
 * fall back to parsePriorPlanning (prose) for pre-frontmatter archives (#61).
 */
export function parseFrontmatter(content: string): PriorPlanning | null {
  const obj = parseFrontmatterObject(content);
  if (!obj) return null;
  const planningKeys = ['on_my_mind', 'on_hold', 'improvement_goals', 'health_goals'];
  if (!planningKeys.some(k => Object.prototype.hasOwnProperty.call(obj, k))) return null;

  const arr = (v: FrontmatterValue | undefined): string[] => (Array.isArray(v) ? v : []);
  const map = (v: FrontmatterValue | undefined): Record<string, string> =>
    v && typeof v === 'object' && !Array.isArray(v) ? v : {};

  return {
    on_my_mind: arr(obj.on_my_mind),
    on_hold: arr(obj.on_hold),
    improvement_goals: arr(obj.improvement_goals),
    health_goals: map(obj.health_goals),
  };
}

export function loadLatestArchive(repoPath: string): ArchiveContext | null {
  const filePath = latestArchivePath(repoPath);
  if (!filePath) return null;

  const content = fs.readFileSync(filePath, 'utf8');
  const dateMatch = path.basename(filePath).match(/^(\d{4}-\d{2}-\d{2})\.md$/);
  const date = dateMatch ? dateMatch[1] : 'unknown';

  // Frontmatter is authoritative when present; prose parsing is the fallback
  // for archives written before the frontmatter schema (#61).
  const planning = parseFrontmatter(content) ?? parsePriorPlanning(content);
  return { path: filePath, date, ...planning };
}
