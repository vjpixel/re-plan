import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  archiveFiles,
  legacyArchivePath,
  parseFrontmatterObject,
  parsePriorPlanning,
  fmArray,
  fmMap,
  fmNumber,
  normalizeGoalMap,
} from './archive.js';
import { sprintsDir } from './paths.js';

export interface SprintRecord {
  date: string;
  review_period?: string;
  plan_period?: string;
  review_workdays?: number;
  plan_workdays?: number;
  projects: string[];
  improvement_goals: string[];
  health_goals: Record<string, string>;
  on_my_mind: string[];
  on_hold: string[];
  // Results (filled at sprint-close, #65)
  results_improvement?: Record<string, string>;
  results_health?: Record<string, string>;
  results_planned?: number;
  results_shipped?: number;
}

export interface CarryoverAge { item: string; age: number; }
export interface ProjectCadence { name: string; sprints: number; streak: number; lastSeen: string; }

export interface Trends {
  sprints: SprintRecord[]; // ascending by date
  latest_carryover: { on_my_mind: CarryoverAge[]; on_hold: CarryoverAge[] };
  projects: ProjectCadence[];
}

/** Count consecutive items from the end that satisfy `pred`, stopping at the first miss. */
function countFromEnd<T>(items: T[], pred: (x: T) => boolean): number {
  let n = 0;
  for (let i = items.length - 1; i >= 0; i--) {
    if (pred(items[i])) n++;
    else break;
  }
  return n;
}

/**
 * Map alternate project spellings → canonical name, from `.sprints/projects/*.md`
 * notes: the filename is the canonical name and its `aliases:` frontmatter lists
 * the variants. Without notes, names pass through unchanged. (#69)
 */
export function loadProjectAliases(repoPath: string): Map<string, string> {
  const dir = path.join(sprintsDir(repoPath), 'projects');
  const aliases = new Map<string, string>(); // variant → canonical (canonical names rely on canon()'s ?? fallback)
  if (!fs.existsSync(dir)) return aliases;

  const files = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.md'))
    .map(e => e.name)
    .sort(); // deterministic resolution order, independent of filesystem order
  const canonicals = new Set(files.map(f => f.replace(/\.md$/, '')));

  for (const name of files) {
    const canonical = name.replace(/\.md$/, '');
    const raw = parseFrontmatterObject(fs.readFileSync(path.join(dir, name), 'utf8'))?.aliases;
    // accept a YAML list OR a single scalar; ignore other shapes
    const list = Array.isArray(raw) ? raw : typeof raw === 'string' && raw.trim() ? [raw] : [];
    for (const alias of list) {
      const a = alias.trim();
      if (!a || canonicals.has(a)) continue;          // never let an alias shadow a real project note
      if (!aliases.has(a)) aliases.set(a, canonical); // first (sorted) declaration wins — deterministic
    }
  }
  return aliases;
}

export function loadSprintRecords(repoPath: string): SprintRecord[] {
  let paths = archiveFiles(repoPath);
  if (paths.length === 0) {
    const legacy = legacyArchivePath(repoPath);
    if (fs.existsSync(legacy)) paths = [legacy]; // match loadLatestArchive's legacy fallback
  }

  const records: SprintRecord[] = [];
  for (const fp of paths) {
    const content = fs.readFileSync(fp, 'utf8');
    const date = path.basename(fp).replace(/\.md$/, '');
    const obj = parseFrontmatterObject(content);

    if (obj) {
      records.push({
        date,
        review_period: typeof obj.review_period === 'string' ? obj.review_period : undefined,
        plan_period: typeof obj.plan_period === 'string' ? obj.plan_period : undefined,
        review_workdays: fmNumber(obj.review_workdays),
        plan_workdays: fmNumber(obj.plan_workdays),
        projects: fmArray(obj.projects),
        improvement_goals: fmArray(obj.improvement_goals),
        health_goals: normalizeGoalMap(fmMap(obj.health_goals)),
        on_my_mind: fmArray(obj.on_my_mind),
        on_hold: fmArray(obj.on_hold),
        results_improvement: 'results_improvement' in obj ? fmMap(obj.results_improvement) : undefined,
        results_health: 'results_health' in obj ? normalizeGoalMap(fmMap(obj.results_health)) : undefined,
        results_planned: fmNumber(obj.results_planned),
        results_shipped: fmNumber(obj.results_shipped),
      });
    } else {
      // Pre-frontmatter (prose) archive: keep it in the series via the prose
      // parser so gaps and "latest" stay consistent with loadLatestArchive,
      // instead of silently dropping it (which over-counts age/streak).
      const p = parsePriorPlanning(content);
      records.push({
        date,
        projects: [],
        improvement_goals: p.improvement_goals,
        health_goals: normalizeGoalMap(p.health_goals),
        on_my_mind: p.on_my_mind,
        on_hold: p.on_hold,
      });
    }
  }

  return records;
}

/** For the latest sprint's (deduped) items, count consecutive sprints from latest back. */
function consecutiveAge(records: SprintRecord[], pick: (r: SprintRecord) => string[]): CarryoverAge[] {
  if (records.length === 0) return [];
  const latest = [...new Set(pick(records[records.length - 1]))];
  return latest.map(item => ({ item, age: countFromEnd(records, r => pick(r).includes(item)) }));
}

function projectCadence(records: SprintRecord[], aliases: Map<string, string>): ProjectCadence[] {
  const canon = (name: string): string => aliases.get(name) ?? name;
  // canonicalize each sprint's projects once (parallel to `records`)
  const canonSets = records.map(r => new Set(r.projects.map(canon)));

  const names = new Set<string>();
  canonSets.forEach(s => s.forEach(n => names.add(n)));

  const out: ProjectCadence[] = [];
  for (const name of names) {
    let sprints = 0;
    let lastSeen = '';
    for (let i = 0; i < records.length; i++) if (canonSets[i].has(name)) { sprints++; lastSeen = records[i].date; }
    out.push({ name, sprints, streak: countFromEnd(canonSets, s => s.has(name)), lastSeen });
  }

  return out.sort((a, b) => b.sprints - a.sprints || a.name.localeCompare(b.name));
}

export function computeTrends(repoPath: string): Trends {
  const sprints = loadSprintRecords(repoPath);
  return {
    sprints,
    latest_carryover: {
      on_my_mind: consecutiveAge(sprints, r => r.on_my_mind),
      on_hold: consecutiveAge(sprints, r => r.on_hold),
    },
    projects: projectCadence(sprints, loadProjectAliases(repoPath)),
  };
}
