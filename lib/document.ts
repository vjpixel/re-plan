/**
 * Remove the "## Plano do dia" section from a sprint document.
 *
 * `/sprint-start` writes a day-plan block (day goal, status, focus, suggested
 * time blocks) at the top of `sprint-wip.md`. That block is a morning snapshot
 * and does not belong in the closed sprint document, which should hold only
 * Sprint Review / Retrospective / Planning — matching the archived format
 * (`.sprints/archive/<date>.md`), where `# <date>` is followed directly by
 * `## Sprint Review`.
 *
 * Strips from the `## Plano do dia …` heading up to — but not including — the
 * next `## ` heading (normally `## Sprint Review`), collapsing the blank lines
 * left behind so the date header is followed by a single blank line. Returns
 * the content unchanged when there is no day-plan section, so it is safe to run
 * more than once (idempotent). Match is case-insensitive to tolerate heading
 * casing drift.
 */
export function stripDayPlan(content: string): string {
  // Split on \r?\n so the scan is line-ending-agnostic (CRLF checkouts on
  // Windows): a trailing \r would otherwise leak into the rejoined output.
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex(l => /^##\s+plano do dia\b/i.test(l));
  if (start === -1) return content;

  // First H2 at or after the day-plan heading marks the end of the section.
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { end = i; break; }
  }

  const before = lines.slice(0, start);
  const after = lines.slice(end);
  // Drop trailing blanks left above the removed section (e.g. after `# <date>`).
  while (before.length && before[before.length - 1].trim() === '') before.pop();

  // Day-plan ran to EOF (no following section): just drop it.
  if (after.length === 0) return before.join('\n') + '\n';

  // Re-join the date header to the next section with a single blank line.
  return [...before, '', ...after].join('\n');
}
