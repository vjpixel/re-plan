import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferCurrentPeriod, nextPeriod, formatPeriodHeader, toISO } from '../lib/period.js';

function d(iso: string): Date {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, m - 1, day);
}

// inferCurrentPeriod

test('inferCurrentPeriod: Friday → starts preceding Monday', () => {
  const result = inferCurrentPeriod(d('2026-05-08')); // Friday
  assert.equal(result.start, '2026-05-04');
  assert.equal(result.end, '2026-05-08');
  assert.equal(result.workdays, 5);
  assert.deepEqual(result.holidays, []);
});

test('inferCurrentPeriod: Monday → starts previous Monday (7 days back)', () => {
  const result = inferCurrentPeriod(d('2026-05-04')); // Monday
  assert.equal(result.start, '2026-04-27');
  assert.equal(result.end, '2026-05-04');
  // Apr 27–May 4: Mon Apr 27, Tue 28, Wed 29, Thu 30, [May 1 holiday], Sat, Sun, Mon May 4 = 5 workdays
  assert.equal(result.workdays, 5);
  assert.deepEqual(result.holidays, ['2026-05-01']);
});

test('inferCurrentPeriod: week containing Dia do Trabalho (May 1)', () => {
  const result = inferCurrentPeriod(d('2026-04-30')); // Thursday before May 1
  assert.equal(result.start, '2026-04-27');
  assert.equal(result.end, '2026-04-30');
  assert.equal(result.workdays, 4);
  assert.deepEqual(result.holidays, []);
});

test('inferCurrentPeriod: Good Friday 2026 (April 3)', () => {
  const result = inferCurrentPeriod(d('2026-04-03')); // Friday = Good Friday
  assert.equal(result.start, '2026-03-30');
  assert.equal(result.end, '2026-04-03');
  // Mon–Fri, but Fri is holiday → 4 workdays
  assert.equal(result.workdays, 4);
  assert.deepEqual(result.holidays, ['2026-04-03']);
});

test('inferCurrentPeriod: Good Friday 2025 (April 18)', () => {
  const result = inferCurrentPeriod(d('2025-04-18')); // Friday = Good Friday
  assert.equal(result.start, '2025-04-14');
  assert.equal(result.end, '2025-04-18');
  assert.equal(result.workdays, 4);
  assert.deepEqual(result.holidays, ['2025-04-18']);
});

test('inferCurrentPeriod: Wednesday mid-week run', () => {
  const result = inferCurrentPeriod(d('2026-05-06')); // Wednesday
  assert.equal(result.start, '2026-05-04');
  assert.equal(result.end, '2026-05-06');
  assert.equal(result.workdays, 3);
  assert.deepEqual(result.holidays, []);
});

// nextPeriod

test('nextPeriod: after normal Friday → following Mon–Fri, no holidays', () => {
  const result = nextPeriod(d('2026-05-08'), 5); // Friday
  assert.equal(result.start, '2026-05-11');
  assert.equal(result.end, '2026-05-15');
  assert.equal(result.workdays, 5);
  assert.deepEqual(result.holidays, []);
});

test('nextPeriod: after Apr 30 (Thu) with 4 workdays → May 4–7', () => {
  const result = nextPeriod(d('2026-04-30'), 4);
  assert.equal(result.start, '2026-05-04');
  assert.equal(result.end, '2026-05-07');
  assert.equal(result.workdays, 4);
  assert.deepEqual(result.holidays, []);
});

test('nextPeriod: holiday within next period reduces available days, extends end', () => {
  // Sprint ending Apr 24 (Fri) with 5 workdays → next starts Apr 27 (Mon)
  // Apr 27–May 1 has May 1 as holiday → need to go to May 4 to get 5 workdays
  const result = nextPeriod(d('2026-04-24'), 5);
  assert.equal(result.start, '2026-04-27');
  assert.equal(result.end, '2026-05-04'); // Mon Apr 27,Tue 28,Wed 29,Thu 30,[May1 hol],Sat,Sun,Mon May 4
  assert.equal(result.workdays, 5);
  assert.deepEqual(result.holidays, ['2026-05-01']);
});

test('nextPeriod: after Monday → next Monday is 7 days later', () => {
  const result = nextPeriod(d('2026-05-04'), 5); // Monday
  assert.equal(result.start, '2026-05-11');
});

// formatPeriodHeader

test('formatPeriodHeader: no holidays', () => {
  const h = formatPeriodHeader({ start: '2026-05-04', end: '2026-05-08', workdays: 5, holidays: [] });
  assert.equal(h, '4/Mai–8/Mai, 5 workdays');
});

test('formatPeriodHeader: one holiday', () => {
  const h = formatPeriodHeader({ start: '2026-04-27', end: '2026-05-04', workdays: 5, holidays: ['2026-05-01'] });
  assert.equal(h, '27/Abr–4/Mai, 5 workdays — 1/Mai feriado');
});

test('formatPeriodHeader: multiple holidays', () => {
  const h = formatPeriodHeader({
    start: '2026-04-20', end: '2026-04-24', workdays: 3,
    holidays: ['2026-04-21', '2026-04-22'],
  });
  assert.equal(h, '20/Abr–24/Abr, 3 workdays — 21/Abr, 22/Abr feriado');
});

// toISO utility

test('toISO: formats date correctly', () => {
  assert.equal(toISO(new Date(2026, 4, 1)), '2026-05-01');
  assert.equal(toISO(new Date(2026, 0, 1)), '2026-01-01');
});
