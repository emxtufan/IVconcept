/**
 * Where the visitor's cookie answer is kept, and for how long it counts.
 *
 * The answer is stored per browser, with the date it was given. After six
 * months it expires and the banner asks once more - the interval European
 * data protection authorities recommend. A refusal is never re-asked sooner
 * and never blocks anything on the site.
 */
export const CONSENT_KEY = 'iv-cookie-consent';
export const NOTICE_KEY = 'iv-cookie-notice';
export const ANSWER_MAX_AGE_MS = 183 * 24 * 60 * 60 * 1000;

export type CookieChoice = 'accepted' | 'rejected';

interface StoredAnswer {
  choice: CookieChoice | 'seen';
  at?: number;
}

export function serializeAnswer(choice: CookieChoice | 'seen', now = Date.now()) {
  return JSON.stringify({ choice, at: now } satisfies StoredAnswer);
}

/**
 * Returns the answer while it is still valid, or null when there is none, it
 * cannot be read, or it is older than six months. Values written by earlier
 * versions were plain strings and are still accepted.
 */
export function parseStoredAnswer(raw: string | null, now = Date.now()): CookieChoice | 'seen' | null {
  if (!raw) return null;

  const isChoice = (value: unknown): value is CookieChoice | 'seen' =>
    value === 'accepted' || value === 'rejected' || value === 'seen';

  if (isChoice(raw)) return raw;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const answer = parsed as StoredAnswer | null;
  if (!answer || !isChoice(answer.choice)) return null;
  if (typeof answer.at === 'number' && now - answer.at > ANSWER_MAX_AGE_MS) return null;

  return answer.choice;
}

export function readStoredValue(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private windows and blocked storage: behave as if nothing was answered.
    return null;
  }
}

export function writeStoredValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The answer is still honoured for this page view.
  }
}

export function clearStoredAnswers() {
  try {
    window.localStorage.removeItem(CONSENT_KEY);
    window.localStorage.removeItem(NOTICE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** True only while the visitor's acceptance is present and still valid. */
export function hasTrackingConsent() {
  return parseStoredAnswer(readStoredValue(CONSENT_KEY)) === 'accepted';
}
