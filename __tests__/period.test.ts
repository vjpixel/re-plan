import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferCurrentPeriod, nextPeriod, formatPeriodHeader, toISO } from '../lib/period.js';

function d(iso: string): Date {
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(y, m - 1, day);
}

// inferCurrentPeriod — Mon–Sun fixed-week model

test('inferCurrentPeriod: Tuesday → reviews the week containing today', () => {
  // Tue 5/May → this week's Sunday = 10/May → start = 4/May; no holidays
  const r = inferCurrentPeriod(d('2026-05-05'));
  assert.equal(r.start, '2026-05-04');
  assert.equal(r.end, '2026-05-10');
  assert.equal(r.workdays, 5);
  assert.deepEqual(r.holidays, []);
});

test('inferCurrentPeriod: Friday (last workday) → reviews the in-progress week, not the previous one (#68)', () => {
  // Fri 8/May → this week's Sunday = 10/May → start = 4/May; no holidays
  const r = inferCurrentPeriod(d('2026-05-08'));
  assert.equal(r.start, '2026-05-04');
  assert.equal(r.end, '2026-05-10');
  assert.equal(r.workdays, 5);
  assert.deepEqual(r.holidays, []);
});

test('inferCurrentPeriod: Saturday → reviews the week containing today', () => {
  // Sat 9/May → this week's Sunday = 10/May → start = 4/May; no holidays
  const r = inferCurrentPeriod(d('2026-05-09'));
  assert.equal(r.start, '2026-05-04');
  assert.equal(r.end, '2026-05-10');
  assert.equal(r.workdays, 5);
  assert.deepEqual(r.holidays, []);
});

test('inferCurrentPeriod: range spanning year boundary picks up Jan 1 holiday', () => {
  // Wed 30/Dec/2026 → this week's Sunday = 3/Jan/2027 → start = 28/Dec/2026
  // Jan 1, 2027 is in range → 4 workdays (Mon Dec 28 … Thu 31, [Fri Jan 1 holiday])
  const r = inferCurrentPeriod(d('2026-12-30'));
  assert.equal(r.start, '2026-12-28');
  assert.equal(r.end, '2027-01-03');
  assert.equal(r.workdays, 4);
  assert.deepEqual(r.holidays, ['2027-01-01']);
});

test('inferCurrentPeriod: Sunday → reviews the week ending today', () => {
  // Sun 10/May → this week's Sunday = 10/May → start = 4/May; no holidays
  const r = inferCurrentPeriod(d('2026-05-10'));
  assert.equal(r.start, '2026-05-04');
  assert.equal(r.end, '2026-05-10');
  assert.equal(r.workdays, 5);
  assert.deepEqual(r.holidays, []);
});

test('inferCurrentPeriod: Monday → reviews the week just started (containing today)', () => {
  // Mon 4/May → this week's Sunday = 10/May → start = 4/May; no holidays
  const r = inferCurrentPeriod(d('2026-05-04'));
  assert.equal(r.start, '2026-05-04');
  assert.equal(r.end, '2026-05-10');
  assert.equal(r.workdays, 5);
  assert.deepEqual(r.holidays, []);
});

test('inferCurrentPeriod: week with no holidays has 5 workdays', () => {
  // Thu 14/May → this week's Sunday = 17/May → start = 11/May; no holidays
  const r = inferCurrentPeriod(d('2026-05-14'));
  assert.equal(r.start, '2026-05-11');
  assert.equal(r.end, '2026-05-17');
  assert.equal(r.workdays, 5);
  assert.deepEqual(r.holidays, []);
});

test('inferCurrentPeriod: Good Friday 2026 (April 3) in sprint week', () => {
  // Thu 2/Apr/2026 → this week's Sunday = 5/Apr → start = 30/Mar; Good Friday Apr 3 in range
  const r = inferCurrentPeriod(d('2026-04-02'));
  assert.equal(r.start, '2026-03-30');
  assert.equal(r.end, '2026-04-05');
  assert.equal(r.workdays, 4);
  assert.deepEqual(r.holidays, ['2026-04-03']);
});

test('inferCurrentPeriod: week containing Tiradentes (Apr 21) has 4 workdays', () => {
  // Tue 21/Apr → this week's Sunday = 26/Apr → start = 20/Apr; Tiradentes 21/Apr in range
  const r = inferCurrentPeriod(d('2026-04-21'));
  assert.equal(r.start, '2026-04-20');
  assert.equal(r.end, '2026-04-26');
  assert.equal(r.workdays, 4);
  assert.deepEqual(r.holidays, ['2026-04-21']);
});

// nextPeriod — always Mon–Sun, 7 calendar days

test('nextPeriod: follows Sun 3/May → Mon 4 – Sun 10/May, 5 workdays', () => {
  const r = nextPeriod(d('2026-05-03'));
  assert.equal(r.start, '2026-05-04');
  assert.equal(r.end, '2026-05-10');
  assert.equal(r.workdays, 5);
  assert.deepEqual(r.holidays, []);
});

test('nextPeriod: follows Sun 26/Apr (week with Tiradentes) → 27/Apr–3/May, 4 workdays (May 1 holiday)', () => {
  const r = nextPeriod(d('2026-04-26'));
  assert.equal(r.start, '2026-04-27');
  assert.equal(r.end, '2026-05-03');
  assert.equal(r.workdays, 4);
  assert.deepEqual(r.holidays, ['2026-05-01']);
});

test('nextPeriod: always 7 calendar days (Mon–Sun)', () => {
  const r = nextPeriod(d('2026-05-10'));
  assert.equal(r.start, '2026-05-11');
  assert.equal(r.end, '2026-05-17');
});

test('nextPeriod: throws if currentEnd is not a Sunday', () => {
  // Mon 4/May (dow=1) → invalid input
  assert.throws(() => nextPeriod(d('2026-05-04')), /expects a Sunday/);
});

// formatPeriodHeader

test('formatPeriodHeader: no holidays', () => {
  const h = formatPeriodHeader({ start: '2026-05-04', end: '2026-05-10', workdays: 5, holidays: [] });
  assert.equal(h, '4/Mai–10/Mai, 5 workdays');
});

test('formatPeriodHeader: one holiday', () => {
  const h = formatPeriodHeader({ start: '2026-04-27', end: '2026-05-03', workdays: 4, holidays: ['2026-05-01'] });
  assert.equal(h, '27/Abr–3/Mai, 4 workdays — 1/Mai feriado');
});

test('formatPeriodHeader: multiple holidays', () => {
  const h = formatPeriodHeader({
    start: '2026-04-20', end: '2026-04-26', workdays: 4,
    holidays: ['2026-04-21'],
  });
  assert.equal(h, '20/Abr–26/Abr, 4 workdays — 21/Abr feriado');
});

// toISO utility

test('toISO: formats date correctly', () => {
  assert.equal(toISO(new Date(2026, 4, 1)), '2026-05-01');
  assert.equal(toISO(new Date(2026, 0, 1)), '2026-01-01');
});
