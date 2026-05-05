function easterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-based
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function nationalHolidaysForYear(year: number): Date[] {
  const easter = easterDate(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(goodFriday.getDate() - 2);

  return [
    new Date(year, 0, 1),   // Ano Novo
    goodFriday,              // Sexta-feira Santa
    new Date(year, 3, 21),  // Tiradentes
    new Date(year, 4, 1),   // Dia do Trabalho
    new Date(year, 8, 7),   // Independência
    new Date(year, 9, 12),  // N.S. Aparecida
    new Date(year, 10, 2),  // Finados
    new Date(year, 10, 15), // Proclamação da República
    new Date(year, 10, 20), // Consciência Negra
    new Date(year, 11, 25), // Natal
  ];
}

export function holidaysBetween(start: Date, end: Date): Date[] {
  const years = new Set<number>();
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) years.add(y);
  return [...years]
    .flatMap(nationalHolidaysForYear)
    .filter(h => h >= start && h <= end);
}
