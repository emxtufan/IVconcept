import { createHash, randomUUID } from 'node:crypto';

// Tracking is secondary to the signup: nothing here may throw into the request
// handler, and no personal data is ever written to the logs.
const DEFAULT_GRAPH_VERSION = 'v26.0';
const REQUEST_TIMEOUT_MS = 3000;

export interface MetaLeadEvent {
  eventId: string;
  eventSourceUrl?: string;
  email?: string;
  phone?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
}

export interface MetaConversionsConfig {
  pixelId: string;
  accessToken: string;
  graphVersion: string;
  testEventCode?: string;
}

/** One id per signup, shared by the browser pixel and the server event. */
export function createEventId() {
  return randomUUID();
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

/** Meta expects the email trimmed, lowercased and hashed. */
export function hashEmail(email?: string) {
  const normalized = email?.trim().toLowerCase();
  return normalized ? sha256(normalized) : undefined;
}

/** Meta expects digits only - no spaces, plus sign, dashes or brackets - then hashed. */
export function hashPhone(phone?: string) {
  const digits = phone?.replace(/\D/g, '');
  return digits ? sha256(digits) : undefined;
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/**
 * The access token lives only in the environment. The pixel id may also come
 * from the site content, so the administrator can set it without a redeploy.
 */
export function getMetaConversionsConfig(fallbackPixelId?: string): MetaConversionsConfig | null {
  const pixelId = readEnv('META_PIXEL_ID') ?? fallbackPixelId?.trim();
  const accessToken = readEnv('META_CAPI_ACCESS_TOKEN');

  if (!pixelId || !accessToken) return null;

  return {
    pixelId,
    accessToken,
    graphVersion: readEnv('META_GRAPH_VERSION') ?? DEFAULT_GRAPH_VERSION,
    testEventCode: readEnv('META_TEST_EVENT_CODE'),
  };
}

export function buildMetaLeadPayload(event: MetaLeadEvent, config: MetaConversionsConfig) {
  // Only hashed contact details leave the server; the IP, user agent and the
  // Meta browser cookies are sent as they are, exactly as the API expects.
  const userData: Record<string, string[] | string> = {};
  const email = hashEmail(event.email);
  const phone = hashPhone(event.phone);
  if (email) userData.em = [email];
  if (phone) userData.ph = [phone];
  if (event.clientIpAddress) userData.client_ip_address = event.clientIpAddress;
  if (event.clientUserAgent) userData.client_user_agent = event.clientUserAgent;
  if (event.fbp) userData.fbp = event.fbp;
  if (event.fbc) userData.fbc = event.fbc;

  return {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: event.eventId,
      action_source: 'website',
      ...(event.eventSourceUrl ? { event_source_url: event.eventSourceUrl } : {}),
      user_data: userData,
    }],
    ...(config.testEventCode ? { test_event_code: config.testEventCode } : {}),
  };
}

export function buildMetaEventsUrl(config: MetaConversionsConfig) {
  return `https://graph.facebook.com/${config.graphVersion}/${config.pixelId}/events`;
}

/**
 * Sends the Lead event to the Conversions API. Resolves to false on any
 * failure - a Meta outage must never affect the signup that was already saved.
 */
export async function sendMetaLeadEvent(
  event: MetaLeadEvent,
  config: MetaConversionsConfig,
  fetchImplementation: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchImplementation(buildMetaEventsUrl(config), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The token travels in the body so it never reaches a URL or an access log.
      body: JSON.stringify({ ...buildMetaLeadPayload(event, config), access_token: config.accessToken }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      console.error(`Meta Conversions API rejected the Lead event (${response.status}):`, details.slice(0, 500));
      return false;
    }

    return true;
  } catch (error) {
    console.error('Meta Conversions API request failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}
