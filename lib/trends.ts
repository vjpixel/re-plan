import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFrontmatterObject, FrontmatterValue } from './archive.js';

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
  count: number;
  sprints: SprintRecord[]; // ascending by date
  latest_carryover: { on_my_mind: CarryoverAge[]; on_hold: CarryoverAge[] };
  projects: ProjectCadence[];
}

const asArr = (v: FrontmatterValue | undefined): string[] => (Array.isArray(v) ? v : []);
const asMap = (v: FrontmatterValue | undefined): Record<string, string> =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const asNum = (v: FrontmatterValue | undefined): number | undefined => {
  if (typeof v !== 'string') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function loadSprintRecords(repoPath: string): SprintRecord[] {
  const archiveDir = path.join(repoPath, '.sprints', 'archive');
  if (!fs.existsSync(archiveDir)) return [];

  const records: SprintRecord[] = [];
  const files = fs.readdirSync(archiveDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort(); // ascending by date (YYYY-MM-DD)

  for (const f of files) {
    const obj = parseFrontmatterObject(fs.readFileSync(path.join(archiveDir, f), 'utf8'));
    if (!obj) continue; // pre-frontmatter archives are skipped from trends
    records.push({
      date: f.replace(/\.md$/, ''),
      review_period: typeof obj.review_period === 'string' ? obj.review_period : undefined,
      plan_period: typeof obj.plan_period === 'string' ? obj.plan_period : undefined,
      review_workdays: asNum(obj.review_workdays),
      plan_workdays: asNum(obj.plan_workdays),
      projects: asArr(obj.projects),
      improvement_goals: asArr(obj.improvement_goals),
      health_goals: asMap(obj.health_goals),
      on_my_mind: asArr(obj.on_my_mind),
      on_hold: asArr(obj.on_hold),
      results_improvement: 'results_improvement' in obj ? asMap(obj.results_improvement) : undefined,
      results_health: 'results_health' in obj ? asMap(obj.results_health) : undefined,
      results_planned: asNum(obj.results_planned),
      results_shipped: asNum(obj.results_shipped),
    });
  }

  return records;
}

/** For the latest sprint's items, count consecutive sprints (from latest back) containing each. */
function consecutiveAge(records: SprintRecord[], pick: (r: SprintRecord) => string[]): CarryoverAge[] {
  if (records.length === 0) return [];
  return pick(records[records.length - 1]).map(item => {
    let age = 0;
    for (let i = records.length - 1; i >= 0; i--) {
      if (pick(records[i]).includes(item)) age++;
      else break;
    }
    return { item, age };
  });
}

function projectCadence(records: SprintRecord[]): ProjectCadence[] {
  const names = new Set<string>();
  records.forEach(r => r.projects.forEach(p => names.add(p)));

  const out: ProjectCadence[] = [];
  for (const name of names) {
    let sprints = 0;
    let lastSeen = '';
    for (const r of records) if (r.projects.includes(name)) { sprints++; lastSeen = r.date; }
    let streak = 0;
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].projects.includes(name)) streak++;
      else break;
    }
    out.push({ name, sprints, streak, lastSeen });
  }

  return out.sort((a, b) => b.sprints - a.sprints || a.name.localeCompare(b.name));
}

export function computeTrends(repoPath: string): Trends {
  const sprints = loadSprintRecords(repoPath);
  return {
    count: sprints.length,
    sprints,
    latest_carryover: {
      on_my_mind: consecutiveAge(sprints, r => r.on_my_mind),
      on_hold: consecutiveAge(sprints, r => r.on_hold),
    },
    projects: projectCadence(sprints),
  };
}
