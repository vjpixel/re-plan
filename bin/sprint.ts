#!/usr/bin/env node
import { inferCurrentPeriod, nextPeriod } from '../lib/period.js';

const [, , subcommand, ...args] = process.argv;

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

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
    process.stdout.write(JSON.stringify({ current, next }, null, 2) + '\n');
    break;
  }
  default:
    process.stderr.write(`Unknown subcommand: ${subcommand ?? '(none)'}\n`);
    process.exit(1);
}
