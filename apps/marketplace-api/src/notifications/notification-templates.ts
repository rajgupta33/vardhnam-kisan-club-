import { NotificationChannel } from '@prisma/client';

/**
 * Channel shaping for an already-localised notification.
 *
 * Copy is authored per event in `notification-events.service.ts` and stored on
 * the `Notification` row in the recipient's language at creation time. This
 * module only adapts that text to the shape a channel needs -- an SMS cannot
 * carry the same length as an email, and a push payload is shorter still.
 *
 * Templates deliberately live in code rather than in a database table. The copy
 * is developer-authored, needs review, and benefits from being versioned in git
 * alongside the events that emit it. A database-backed template editor is a
 * portal surface with its own approval workflow -- worth building when marketing
 * needs to change copy without a deploy, and tracked as part of WP-09r rather
 * than assumed here.
 */

/**
 * SMS is billed per segment, and Devanagari encodes as UCS-2 at 70 characters
 * per segment against GSM-7's 160. The Hindi limit is therefore far lower --
 * getting this wrong means either truncated messages or a surprising bill.
 */
const SMS_LIMIT_GSM7 = 160;
const SMS_LIMIT_UCS2 = 70;
const PUSH_BODY_LIMIT = 120;
const WHATSAPP_LIMIT = 1_024;

export interface RenderedMessage {
  title: string;
  body: string;
}

const DEVANAGARI = /[ऀ-ॿ]/;

export function containsNonGsm7(text: string): boolean {
  return DEVANAGARI.test(text);
}

export function smsSegmentLimit(text: string): number {
  return containsNonGsm7(text) ? SMS_LIMIT_UCS2 : SMS_LIMIT_GSM7;
}

export function renderForChannel(
  channel: NotificationChannel,
  title: string,
  body: string,
): RenderedMessage {
  switch (channel) {
    case NotificationChannel.SMS: {
      const combined = `${title}: ${body}`;
      return { title, body: truncate(combined, smsSegmentLimit(combined)) };
    }
    case NotificationChannel.WHATSAPP:
      return { title, body: truncate(`${title}\n\n${body}`, WHATSAPP_LIMIT) };
    case NotificationChannel.PUSH:
      return { title, body: truncate(body, PUSH_BODY_LIMIT) };
    case NotificationChannel.EMAIL:
    case NotificationChannel.IN_APP:
    default:
      return { title, body };
  }
}

/** Truncates on a word boundary where possible, so a cut message still reads. */
function truncate(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }

  const hardCut = text.slice(0, limit - 1);
  const lastSpace = hardCut.lastIndexOf(' ');
  const body = lastSpace > limit * 0.6 ? hardCut.slice(0, lastSpace) : hardCut;
  return `${body}…`;
}

/**
 * OTP copy. This is not a `Notification` row -- the code must never be persisted
 * in a readable form, and an in-app inbox entry containing it would defeat the
 * point of sending it out of band -- so it is rendered and handed straight to
 * the SMS provider.
 */
export function renderOtpMessage(code: string, expiryMinutes: number, locale: string): string {
  const hindi = locale.toLowerCase().startsWith('hi');
  return hindi
    ? `${code} आपका वर्धनम OTP है। यह ${expiryMinutes} मिनट में समाप्त होगा। इसे किसी को न बताएं।`
    : `${code} is your Vardhnam OTP. It expires in ${expiryMinutes} minutes. Do not share it with anyone.`;
}
