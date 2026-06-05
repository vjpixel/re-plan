#!/usr/bin/env node
import { inferCurrentPeriod, nextPeriod } from '../lib/period.js';
import { loadLatestArchive } from '../lib/archive.js';
import { computeTrends } from '../lib/trends.js';
import { readWip, archiveWip } from '../lib/wip.js';
import { filterAcceptedCalendarEvents, filterRelevantEmails, windowGithubEvents } from '../lib/filters.js';

const [, , subcommand, ...args] = process.argv;

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
}

function parseLocalDate(iso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    process.stderr.write(`Invalid date format: "${iso}" — expected YYYY-MM-DD\n`);
    process.exit(1);
  }
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function repoPath(): string {
  return flag(args, '--repo') ?? process.cwd();
}

function out(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

async function readStdin(): Promise<string> {
  return new Promise(resolve => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', c => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function parseStdinArray(raw: string): Record<string, unknown>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`Invalid JSON on stdin: ${(e as Error).message}\n`);
    process.exit(1);
  }
  if (!Array.isArray(parsed)) {
    process.stderr.write('Stdin JSON must be an array\n');
    process.exit(1);
  }
  return parsed as Record<string, unknown>[];
}

function requireISODate(name: string, value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    process.stderr.write(`${name} requires YYYY-MM-DD\n`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  switch (subcommand) {
    case 'period': {
      const todayStr = flag(args, '--today');
      const today = todayStr ? parseLocalDate(todayStr) : (() => {
        const n = new Date();
        return new Date(n.getFullYear(), n.getMonth(), n.getDate());
      })();
      const current = inferCurrentPeriod(today);
      const currentEnd = parseLocalDate(current.end);
      const next = nextPeriod(currentEnd);
      out({ current, next });
      break;
    }

    case 'archive': {
      out(loadLatestArchive(repoPath()));
      break;
    }

    case 'trends': {
      out(computeTrends(repoPath()));
      break;
    }

    case 'read-wip': {
      const result = readWip(repoPath());
      if (!result) {
        process.stderr.write('sprint-wip.md not found\n');
        process.exit(1);
      }
      out(result);
      break;
    }

    case 'archive-wip': {
      const date = requireISODate('--date', flag(args, '--date'));
      out({ archived_to: archiveWip(repoPath(), date) });
      break;
    }

    case 'filter-gcal': {
      out(filterAcceptedCalendarEvents(parseStdinArray(await readStdin())));
      break;
    }

    case 'filter-gmail': {
      out(filterRelevantEmails(parseStdinArray(await readStdin())));
      break;
    }

    case 'filter-github': {
      const start = requireISODate('--start', flag(args, '--start'));
      const end = requireISODate('--end', flag(args, '--end'));
      out(windowGithubEvents(parseStdinArray(await readStdin()), start, end));
      break;
    }

    default:
      process.stderr.write(`Unknown subcommand: ${subcommand ?? '(none)'}\n`);
      process.exit(1);
  }
}

main().catch(e => {
  process.stderr.write((e as Error).message + '\n');
  process.exit(1);
});
