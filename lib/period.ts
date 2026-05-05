import { holidaysBetween } from './holidays.js';

export interface Period {
  start: string;    // YYYY-MM-DD
  end: string;      // YYYY-MM-DD
  workdays: number;
  holidays: string[]; // YYYY-MM-DD — falls within start..end
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

function isHolidayDate(date: Date, holidays: Date[]): boolean {
  const iso = toISO(date);
  return holidays.some(h => toISO(h) === iso);
}

function isWorkday(date: Date, holidays: Date[]): boolean {
  return !isWeekend(date) && !isHolidayDate(date, holidays);
}

function countWorkdays(start: Date, end: Date, holidays: Date[]): number {
  let count = 0;
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    if (isWorkday(d, holidays)) count++;
  }
  return count;
}

export function inferCurrentPeriod(today: Date): Period {
  // Sprints are fixed Mon–Sun calendar weeks. The closing sprint is the most
  // recently completed Mon–Sun week (end = last Sunday ≤ today).
  const dow = today.getDay(); // 0=Sun … 6=Sat
  const end = addDays(today, -dow); // rewind to Sunday (0 days if today is Sun)
  const start = addDays(end, -6);   // Monday = Sunday − 6
  const holidays = holidaysBetween(start, end);
  return {
    start: toISO(start),
    end: toISO(end),
    workdays: countWorkdays(start, end, holidays),
    holidays: holidays.map(toISO),
  };
}

export function nextPeriod(currentEnd: Date): Period {
  // Next sprint: the Mon–Sun week immediately following currentEnd.
  // currentEnd must be a Sunday (the canonical output of inferCurrentPeriod).
  if (currentEnd.getDay() !== 0) {
    throw new Error(`nextPeriod expects a Sunday, got ${toISO(currentEnd)} (dow=${currentEnd.getDay()})`);
  }
  const start = addDays(currentEnd, 1); // Monday
  const end = addDays(start, 6);        // Sunday
  const holidays = holidaysBetween(start, end);
  return {
    start: toISO(start),
    end: toISO(end),
    workdays: countWorkdays(start, end, holidays),
    holidays: holidays.map(toISO),
  };
}

const PT_MONTHS: Record<number, string> = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez',
};

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(d)}/${PT_MONTHS[parseInt(m)]}`;
}

export function formatPeriodHeader(period: Period): string {
  const range = `${fmtDate(period.start)}–${fmtDate(period.end)}`;
  const days = `${period.workdays} workdays`;
  if (period.holidays.length === 0) return `${range}, ${days}`;
  const hols = period.holidays.map(fmtDate).join(', ');
  return `${range}, ${days} — ${hols} feriado`;
}
