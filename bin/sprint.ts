#!/usr/bin/env node
import { inferCurrentPeriod, nextPeriod } from '../lib/period.js';
import { loadLatestArchive } from '../lib/archive.js';
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
      const next = nextPeriod(currentEnd, current.workdays);
      out({ current, next });
      break;
    }

    case 'archive': {
      out(loadLatestArchive(repoPath()));
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
      const date = flag(args, '--date');
      if (!date) { process.stderr.write('--date YYYY-MM-DD required\n'); process.exit(1); }
      out({ archived_to: archiveWip(repoPath(), date) });
      break;
    }

    case 'filter-gcal': {
      const raw = await readStdin();
      out(filterAcceptedCalendarEvents(JSON.parse(raw)));
      break;
    }

    case 'filter-gmail': {
      const raw = await readStdin();
      out(filterRelevantEmails(JSON.parse(raw)));
      break;
    }

    case 'filter-github': {
      const start = flag(args, '--start');
      const end = flag(args, '--end');
      if (!start || !end) { process.stderr.write('--start and --end YYYY-MM-DD required\n'); process.exit(1); }
      const raw = await readStdin();
      out(windowGithubEvents(JSON.parse(raw), start, end));
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
