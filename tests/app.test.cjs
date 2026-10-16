const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(new URL('../app.js', `file://${__filename}`), 'utf8');
const preview = {
  fullName: 'ALI Member', email: 'member@example.org', eventDate: '2026-10-24',
  eventSlug: 'topgolf-wellness-2026-10-24', capacity: 25, isOpen: true, isFull: false, existingStatus: null, existingPosition: null,
};
async function page(values = {}, rejectSubmission = false) {
  const elements = new Map();
  const document = { querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      textContent: '', hidden: false, disabled: false, classList: { toggle() {} },
      removeAttribute() {}, addEventListener() {},
    });
    return elements.get(selector);
  }};
  const calls = [];
  const context = vm.createContext({ document, URL, URLSearchParams, Intl, Date,
    window: { location: { search: '?token=fixture-only' } },
    fetch: async (_url, options) => {
      calls.push(options?.method || 'GET');
      if (options?.method === 'POST' && rejectSubmission) throw new Error('Connection failed');
      return { ok: true, json: async () => ({success: true, data: {preview: {...preview, ...values}, result: {signup_status: 'WAITLISTED', submission_position: 26, duplicate: false}}}) };
    },
  });
  vm.runInContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { context, calls, element: id => elements.get(`#${id}`) };
}
test('full event has a warm notice and no signup action', async () => {
  const p = await page({isFull: true});
  assert.equal(p.element('page-title').textContent, 'This Topgolf event is now full');
  assert.equal(p.element('action-area').hidden, true);
  assert.equal(p.element('full-notice').hidden, false);
  assert.equal(p.element('intro').hidden, true);
  assert.equal(p.element('availability').textContent, 'Event full');
  assert.deepEqual(p.calls, ['GET']);
});
test('open event retains RSVP action', async () => {
  const p = await page();
  assert.equal(p.element('confirm-button').textContent, 'Submit RSVP');
  assert.equal(p.element('action-area').hidden, false);
  assert.equal(p.element('full-notice').hidden, true);
});
test('existing confirmation remains visible when full with cancellation help', async () => {
  const p = await page({isFull: true, existingStatus: 'CONFIRMED', existingPosition: 25});
  assert.equal(p.element('page-title').textContent, 'Your spot is confirmed');
  assert.equal(p.element('action-area').hidden, true);
  assert.equal(p.element('full-notice').hidden, true);
  assert.equal(p.element('cancellation-note').hidden, false);
  assert.match(p.element('outcome-message').textContent, /position 25 of 25/);
});
test('existing waitlisted member sees full notice without a new signup action', async () => {
  const p = await page({isFull: true, existingStatus: 'WAITLISTED', existingPosition: 28});
  assert.equal(p.element('page-title').textContent, 'This Topgolf event is now full');
  assert.equal(p.element('action-area').hidden, true);
  assert.equal(p.element('full-notice').hidden, false);
  assert.deepEqual(p.calls, ['GET']);
});
test('closed event hides signup when not at capacity', async () => {
  const p = await page({isFull: false, isOpen: false});
  assert.equal(p.element('page-title').textContent, 'Registration closed');
  assert.equal(p.element('availability').textContent, 'Registration closed');
  assert.equal(p.element('action-area').hidden, true);
});
test('older API response uses neutral wording', async () => {
  const p = await page({isFull: undefined});
  assert.equal(p.element('confirm-button').textContent, 'Submit RSVP');
});
test('failed RSVP never restores the old confirmed-spot promise', async () => {
  const p = await page({}, true);
  await p.context.confirmSpot();
  assert.equal(p.element('confirm-button').textContent, 'Submit RSVP');
  assert.deepEqual(p.calls, ['GET', 'POST']);
});
test('static full notice has verified support contact and no waitlist invitation', () => {
  const html = readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
  assert.match(html, /Unfortunately, all spots for our October 24 Topgolf outing have been filled/);
  assert.match(html, /mailto:support@ali-ca.org/);
  assert.doesNotMatch(html + source, /Join waitlist|Confirm my spot|Confirm your spot/);
});

test('another full event keeps its existing RSVP behavior and no Topgolf notice', async () => {
  const p = await page({eventSlug: 'another-event', isFull: true});
  assert.equal(p.element('action-area').hidden, false);
  assert.equal(p.element('full-notice').hidden, true);
  assert.equal(p.element('page-title').textContent, 'Your RSVP');
});

test('another full event preserves waitlist response after its RSVP submission', async () => {
  const p = await page({eventSlug: 'another-event', isFull: true});
  await p.context.confirmSpot();
  assert.equal(p.element('full-notice').hidden, true);
  assert.equal(p.element('outcome-title').textContent, 'You’re on the waitlist');
  assert.deepEqual(p.calls, ['GET', 'POST']);
});
