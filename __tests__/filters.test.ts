import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterAcceptedCalendarEvents, filterRelevantEmails, windowGithubEvents, withMyResponseStatus } from '../lib/filters.js';

// withMyResponseStatus

test('withMyResponseStatus: derives from attendees[].self', () => {
  const events = [
    { id: '1', attendees: [{ email: 'me@x.com', self: true, responseStatus: 'accepted' }, { email: 'other@x.com' }] },
    { id: '2', attendees: [{ email: 'me@x.com', self: true, responseStatus: 'declined' }] },
  ];
  const result = withMyResponseStatus(events);
  assert.equal(result[0].myResponseStatus, 'accepted');
  assert.equal(result[1].myResponseStatus, 'declined');
});

test('withMyResponseStatus: treats self-created events with no attendees as accepted', () => {
  const events = [{ id: '1' }];
  const result = withMyResponseStatus(events);
  assert.equal(result[0].myResponseStatus, 'accepted');
});

test('withMyResponseStatus: defaults to needsAction when self is not found in attendees', () => {
  const events = [{ id: '1', attendees: [{ email: 'other@x.com', responseStatus: 'accepted' }] }];
  const result = withMyResponseStatus(events);
  assert.equal(result[0].myResponseStatus, 'needsAction');
});

test('withMyResponseStatus: leaves a precomputed myResponseStatus untouched', () => {
  const events = [{ id: '1', myResponseStatus: 'tentative', attendees: [{ self: true, responseStatus: 'accepted' }] }];
  const result = withMyResponseStatus(events);
  assert.equal(result[0].myResponseStatus, 'tentative');
});

// filterAcceptedCalendarEvents

test('filterAcceptedCalendarEvents: keeps accepted events', () => {
  const events = [
    { id: '1', myResponseStatus: 'accepted', summary: 'Standup' },
    { id: '2', myResponseStatus: 'declined', summary: 'Team sync' },
    { id: '3', myResponseStatus: 'needsAction', summary: 'Review' },
    { id: '4', myResponseStatus: 'accepted', summary: 'Sprint planning' },
  ];
  const result = filterAcceptedCalendarEvents(events);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, '1');
  assert.equal(result[1].id, '4');
});

test('filterAcceptedCalendarEvents: returns empty for no accepted', () => {
  const events = [{ myResponseStatus: 'declined' }, { myResponseStatus: 'tentative' }];
  assert.equal(filterAcceptedCalendarEvents(events).length, 0);
});

test('filterAcceptedCalendarEvents: drops events with missing status', () => {
  const events = [{ id: '1' }, { id: '2', myResponseStatus: 'accepted' }];
  const result = filterAcceptedCalendarEvents(events);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '2');
});

// filterRelevantEmails

test('filterRelevantEmails: drops Amazon order emails by sender', () => {
  const msgs = [
    { from: 'noreply@amazon.com.br', subject: 'Seu pedido foi enviado' },
    { from: 'joao@example.com', subject: 'Projeto X — atualização' },
  ];
  const result = filterRelevantEmails(msgs);
  assert.equal(result.length, 1);
  assert.equal(result[0].from, 'joao@example.com');
});

test('filterRelevantEmails: drops Amazon by subject', () => {
  const msgs = [
    { from: 'alerts@shop.com', subject: 'Your Amazon order has shipped' },
    { from: 'recruiter@google.com', subject: 'Software Engineer role' },
  ];
  const result = filterRelevantEmails(msgs);
  assert.equal(result.length, 1);
  assert.equal(result[0].from, 'recruiter@google.com');
});

test('filterRelevantEmails: keeps non-Amazon order emails (regression)', () => {
  // "your order" alone must not match — only Amazon-specific phrasing.
  const msgs = [
    { from: 'orders@mercadolivre.com', subject: 'Your order has been shipped' },
    { from: 'noreply@magalu.com.br', subject: 'Sua encomenda saiu para entrega' },
  ];
  const result = filterRelevantEmails(msgs);
  assert.equal(result.length, 2);
});

test('filterRelevantEmails: keeps non-Amazon emails', () => {
  const msgs = [
    { from: 'ceo@startup.com', subject: 'Partnership proposal' },
    { from: 'hr@company.com', subject: 'Interview confirmation' },
  ];
  assert.equal(filterRelevantEmails(msgs).length, 2);
});

test('filterRelevantEmails: drops tracking number emails', () => {
  const msgs = [{ from: 'correios@tracking.com', subject: 'Tracking number: BR123456' }];
  assert.equal(filterRelevantEmails(msgs).length, 0);
});

// windowGithubEvents

test('windowGithubEvents: keeps events within range', () => {
  const events = [
    { id: 1, created_at: '2026-04-27T10:00:00Z' },
    { id: 2, created_at: '2026-04-30T15:30:00Z' },
    { id: 3, created_at: '2026-05-04T08:00:00Z' },
  ];
  const result = windowGithubEvents(events, '2026-04-27', '2026-05-03');
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 1);
  assert.equal(result[1].id, 2);
});

test('windowGithubEvents: drops events before start', () => {
  const events = [{ id: 1, created_at: '2026-04-26T23:59:59Z' }];
  assert.equal(windowGithubEvents(events, '2026-04-27', '2026-05-03').length, 0);
});

test('windowGithubEvents: drops events after end', () => {
  const events = [{ id: 1, created_at: '2026-05-04T00:00:01Z' }];
  assert.equal(windowGithubEvents(events, '2026-04-27', '2026-05-03').length, 0);
});

test('windowGithubEvents: drops events with missing or invalid created_at', () => {
  const events = [{ id: 1 }, { id: 2, created_at: 'not-a-date' }];
  assert.equal(windowGithubEvents(events, '2026-04-27', '2026-05-03').length, 0);
});
