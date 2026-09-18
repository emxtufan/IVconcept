import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  buildMetaEventsUrl,
  buildMetaLeadPayload,
  createEventId,
  getMetaConversionsConfig,
  hashEmail,
  hashPhone,
  sendMetaLeadEvent,
} from '../server/metaConversions.ts';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const config = { pixelId: '1234567890', accessToken: 'test-token', graphVersion: 'v26.0' };

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const previous = Object.keys(values).map((key) => [key, process.env[key]] as const);
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  try {
    run();
  } finally {
    previous.forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
}

test('contact details are normalized before hashing, and empty values are left out', () => {
  assert.equal(hashEmail('  Ana.Popescu@Example.COM '), sha256('ana.popescu@example.com'));
  assert.equal(hashPhone(' +40 (712) 345-678 '), sha256('40712345678'));
  assert.equal(hashEmail(''), undefined);
  assert.equal(hashEmail(undefined), undefined);
  assert.equal(hashPhone('   '), undefined);
  assert.equal(hashPhone('---'), undefined);
});

test('the event id is unique per signup', () => {
  const ids = new Set(Array.from({ length: 50 }, () => createEventId()));
  assert.equal(ids.size, 50);
});

test('the payload carries the required fields and never the raw contact details', () => {
  const payload = buildMetaLeadPayload({
    eventId: 'event-1',
    email: 'Ana@Example.com',
    phone: '0712 345 678',
    clientIpAddress: '203.0.113.9',
    clientUserAgent: 'Mozilla/5.0 (test)',
    fbp: 'fb.1.1700000000.123',
    fbc: 'fb.1.1700000000.abc',
    eventSourceUrl: 'https://course.ivconcept.ro/',
  }, config);
  const [event] = payload.data;

  assert.equal(event.event_name, 'Lead');
  assert.equal(event.event_id, 'event-1');
  assert.equal(event.action_source, 'website');
  assert.equal(event.event_source_url, 'https://course.ivconcept.ro/');
  assert.ok(Number.isInteger(event.event_time) && event.event_time > 1_600_000_000);

  assert.deepEqual(event.user_data.em, [sha256('ana@example.com')]);
  assert.deepEqual(event.user_data.ph, [sha256('0712345678')]);
  // The IP, user agent and Meta cookies are sent as they are, never hashed.
  assert.equal(event.user_data.client_ip_address, '203.0.113.9');
  assert.equal(event.user_data.client_user_agent, 'Mozilla/5.0 (test)');
  assert.equal(event.user_data.fbp, 'fb.1.1700000000.123');
  assert.equal(event.user_data.fbc, 'fb.1.1700000000.abc');

  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /ana@example\.com/i);
  assert.doesNotMatch(serialized, /0712 345 678/);
});

test('missing browser cookies and page url are simply left out of the payload', () => {
  const [event] = buildMetaLeadPayload({ eventId: 'event-2', email: 'ana@example.com' }, config).data;

  assert.equal('fbp' in event.user_data, false);
  assert.equal('fbc' in event.user_data, false);
  assert.equal('event_source_url' in event, false);
  assert.deepEqual(Object.keys(event.user_data), ['em']);
});

test('the test event code is attached only while it is configured', () => {
  assert.equal('test_event_code' in buildMetaLeadPayload({ eventId: 'e' }, config), false);
  const payload = buildMetaLeadPayload({ eventId: 'e' }, { ...config, testEventCode: 'TEST1234' });
  assert.equal(payload.test_event_code, 'TEST1234');
});

test('the integration stays off until both the pixel id and the token are configured', () => {
  withEnv({ META_PIXEL_ID: undefined, META_CAPI_ACCESS_TOKEN: undefined, META_GRAPH_VERSION: undefined }, () => {
    assert.equal(getMetaConversionsConfig(), null);
    assert.equal(getMetaConversionsConfig('1234567890'), null, 'A pixel id without a token is not enough');
  });

  withEnv({ META_PIXEL_ID: undefined, META_CAPI_ACCESS_TOKEN: 'token', META_GRAPH_VERSION: undefined }, () => {
    assert.equal(getMetaConversionsConfig(), null, 'A token without a pixel id is not enough');
    // The pixel id may come from the admin panel instead of the environment.
    const fromContent = getMetaConversionsConfig('  1234567890  ');
    assert.equal(fromContent?.pixelId, '1234567890');
    assert.equal(fromContent?.graphVersion, 'v26.0', 'Falls back to a known Graph API version');
  });

  withEnv({ META_PIXEL_ID: '999', META_CAPI_ACCESS_TOKEN: 'token', META_GRAPH_VERSION: 'v27.0' }, () => {
    const resolved = getMetaConversionsConfig('1234567890');
    assert.equal(resolved?.pixelId, '999', 'The environment wins over the admin panel');
    assert.equal(resolved?.graphVersion, 'v27.0');
  });
});

test('the request goes to the pixel events endpoint with the token in the body', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const ok = await sendMetaLeadEvent({ eventId: 'event-3', email: 'ana@example.com' }, config, (async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
  }) as typeof fetch);

  assert.equal(ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://graph.facebook.com/v26.0/1234567890/events');
  assert.equal(buildMetaEventsUrl(config), calls[0].url);
  assert.doesNotMatch(calls[0].url, /access_token/, 'The token must never appear in a URL');
  assert.equal(JSON.parse(String(calls[0].init.body)).access_token, 'test-token');
});

test('a rejected or unreachable Meta API never throws into the signup', async (context) => {
  context.mock.method(console, 'error', () => undefined);

  const rejected = await sendMetaLeadEvent({ eventId: 'event-4' }, config, (async () => (
    new Response('{"error":{"message":"Invalid parameter"}}', { status: 400 })
  )) as typeof fetch);
  assert.equal(rejected, false);

  const offline = await sendMetaLeadEvent({ eventId: 'event-5' }, config, (async () => {
    throw new Error('network unreachable');
  }) as typeof fetch);
  assert.equal(offline, false);
});
