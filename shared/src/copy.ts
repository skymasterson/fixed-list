/** Outbound message wording, kept in one place so SMS, email and the UI agree. */

export const APP_NAME = 'Fixed List';

/** Body of the tenant entry-notice email; the date and time follow it. */
export const TENANT_ENTRY_NOTICE =
  'To repair or maintain your unit, a contractor will enter your apartment with a provided access code at the following date and time.';

/** Opening line of any email sent because an earlier text or push went unanswered. */
export const EMAIL_FALLBACK_REASON =
  'We are emailing because we have not received an answer back by text message.';

export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
  });
}

/** "Mon, Nov 23" from YYYY-MM-DD, without timezone drift. */
export function formatDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function taskSmsBody(t: {
  title: string;
  address: string;
  budgetCents: number;
  urgent: boolean;
  desiredDate: string | null;
  link: string;
}): string {
  const parts = [
    `${t.urgent ? 'URGENT ' : ''}${APP_NAME} job: ${t.title} at ${t.address}.`,
    `Budget ${formatMoney(t.budgetCents)}.`,
  ];
  if (t.desiredDate) parts.push(`Needed by ${formatDay(t.desiredDate)}.`);
  parts.push(`Details and reply: ${t.link}`);
  return parts.join(' ');
}

/** URL-safe random token; 32 bytes → 43 chars. Works in browsers and Node 20+. */
export function newToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function todayYmd(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
