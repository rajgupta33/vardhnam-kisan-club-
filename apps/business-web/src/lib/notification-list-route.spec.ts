import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  notificationListPath,
  parseNotificationChannel,
  parseNotificationPage,
  parseNotificationStatus,
} from './notification-list-route';

describe('notification list route state', () => {
  it('preserves valid filters and the current page', () => {
    assert.equal(
      notificationListPath('FAILED', 'SMS', 3),
      '/notifications?page=3&status=FAILED&channel=SMS',
    );
  });

  it('rejects malformed filter values', () => {
    assert.equal(parseNotificationStatus('NOT_A_STATUS'), undefined);
    assert.equal(parseNotificationChannel('WEB'), undefined);
  });

  it('defaults malformed or unsafe pages to the first page', () => {
    assert.equal(parseNotificationPage('../3'), 1);
    assert.equal(parseNotificationPage('0'), 1);
    assert.equal(parseNotificationPage('9007199254740992'), 1);
  });
});
