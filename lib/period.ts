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
  const dow = today.getDay(); // 0=Sun … 6=Sat
  // Last Monday strictly before today; if today is Monday (1), go back 7 days.
  const daysBack = ((dow - 1 + 7) % 7) || 7;
  const start = addDays(today, -daysBack);
  const holidays = holidaysBetween(start, today);
  return {
    start: toISO(start),
    end: toISO(today),
    workdays: countWorkdays(start, today, holidays),
    holidays: holidays.map(toISO),
  };
}

export function nextPeriod(currentEnd: Date, currentWorkdays: number): Period {
  // Next sprint always starts the following Monday.
  const dow = currentEnd.getDay();
  const daysToMonday = dow === 0 ? 1 : 8 - dow;
  const start = addDays(currentEnd, daysToMonday);

  // Walk forward until we've accumulated currentWorkdays workdays.
  const upperBound = addDays(start, currentWorkdays * 3); // generous
  const allHolidays = holidaysBetween(start, upperBound);
  let d = new Date(start);
  let count = 0;
  while (count < currentWorkdays) {
    if (isWorkday(d, allHolidays)) count++;
    if (count < currentWorkdays) d = addDays(d, 1);
  }
  const end = d;
  const periodHolidays = holidaysBetween(start, end);
  return {
    start: toISO(start),
    end: toISO(end),
    workdays: currentWorkdays,
    holidays: periodHolidays.map(toISO),
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
