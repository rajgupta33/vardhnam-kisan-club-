import { NotificationChannel } from '@prisma/client';
import {
  containsNonGsm7,
  renderForChannel,
  renderOtpMessage,
  smsSegmentLimit,
} from '../src/notifications/notification-templates';
import { categoryClassOf, isOptOutable } from '../src/notifications/notification-categories';

describe('notification templates', () => {
  it('applies the shorter Devanagari SMS limit', () => {
    // Hindi encodes as UCS-2, which halves the per-segment budget. Getting this
    // wrong means either truncated messages or an unexpected bill.
    expect(containsNonGsm7('आपका ऑर्डर')).toBe(true);
    expect(containsNonGsm7('Your order')).toBe(false);
    expect(smsSegmentLimit('आपका ऑर्डर')).toBe(70);
    expect(smsSegmentLimit('Your order')).toBe(160);
  });

  it('keeps an SMS within one segment', () => {
    const title = 'Order delivered';
    const body = 'x'.repeat(400);

    const rendered = renderForChannel(NotificationChannel.SMS, title, body);

    expect(rendered.body.length).toBeLessThanOrEqual(160);
    expect(rendered.body.endsWith('…')).toBe(true);
  });

  it('keeps a Hindi SMS within the smaller segment', () => {
    const rendered = renderForChannel(
      NotificationChannel.SMS,
      'ऑर्डर वितरित',
      'आपका ऑर्डर वितरित कर दिया गया है। '.repeat(20),
    );

    expect(rendered.body.length).toBeLessThanOrEqual(70);
  });

  it('leaves email and in-app copy untouched', () => {
    const body = 'x'.repeat(400);

    expect(renderForChannel(NotificationChannel.EMAIL, 'Subject', body).body).toBe(body);
    expect(renderForChannel(NotificationChannel.IN_APP, 'Subject', body).body).toBe(body);
  });

  it('truncates a push body without cutting mid-word where it can avoid it', () => {
    const rendered = renderForChannel(
      NotificationChannel.PUSH,
      'Order update',
      'Your order has been dispatched and will arrive within the next two working days as scheduled',
    );

    expect(rendered.body.length).toBeLessThanOrEqual(121);
    expect(rendered.body).not.toMatch(/\s…$/);
  });

  it('renders the OTP message in the requested language without leaking it elsewhere', () => {
    const english = renderOtpMessage('123456', 10, 'en-IN');
    const hindi = renderOtpMessage('123456', 10, 'hi-IN');

    expect(english).toContain('123456');
    expect(english).toMatch(/expires in 10 minutes/i);
    expect(hindi).toContain('123456');
    expect(hindi).toContain('OTP');
    expect(hindi).not.toBe(english);
  });
});

describe('notification categories', () => {
  it('treats order, payment and refund events as transactional', () => {
    for (const category of ['ORDER_DELIVERED', 'PAYMENT_SUCCEEDED', 'REFUND_SUCCEEDED']) {
      expect(categoryClassOf(category)).toBe('TRANSACTIONAL');
      expect(isOptOutable(category)).toBe(false);
    }
  });

  it('lets advisory and marketing be switched off', () => {
    expect(isOptOutable('ADVISORY')).toBe(true);
    expect(isOptOutable('MARKETING')).toBe(true);
  });

  it('defaults an unknown category to transactional', () => {
    // Safer default: an unclassified category is more likely a new order or
    // payment event than a marketing one, and failing to deliver it is worse
    // than failing to suppress it.
    expect(isOptOutable('SOME_FUTURE_EVENT')).toBe(false);
  });
});
