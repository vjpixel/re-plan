const AMAZON_PATTERNS = [
  /amazon\.(com|co\.uk|de|fr|es|it|ca|com\.br|com\.mx)/i,
  /noreply.*amazon/i,
  /shipment.tracking/i,
  /tracking.*number/i,
  /your amazon order/i,
  /sua encomenda da amazon/i,
  /amazon[- ]entrega/i,
];

function isAmazon(from = '', subject = ''): boolean {
  return AMAZON_PATTERNS.some(p => p.test(from) || p.test(subject));
}

export function filterAcceptedCalendarEvents<T extends Record<string, unknown>>(events: T[]): T[] {
  return events.filter(e => e['myResponseStatus'] === 'accepted');
}

export function filterRelevantEmails<T extends Record<string, unknown>>(messages: T[]): T[] {
  return messages.filter(m => !isAmazon(String(m['from'] ?? ''), String(m['subject'] ?? '')));
}

export function windowGithubEvents<T extends Record<string, unknown>>(
  events: T[], startISO: string, endISO: string
): T[] {
  // GitHub timestamps are UTC; compare date strings directly to avoid tz drift.
  return events.filter(e => {
    const raw = String(e['created_at'] ?? '');
    const t = new Date(raw);
    if (isNaN(t.getTime())) return false;
    const dateStr = t.toISOString().slice(0, 10);
    return dateStr >= startISO && dateStr <= endISO;
  });
}
