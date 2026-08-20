import { NotificationChannel, NotificationStatus, PlatformRole } from '@prisma/client';
import {
  FarmerNotificationEvent,
  FarmerOrderNotificationEvent,
  FarmerPaymentNotificationEvent,
  FarmerSupportNotificationEvent,
  NotificationEventsService,
} from '../src/notifications/notification-events.service';

describe('NotificationEventsService', () => {
  it.each([
    ['en-IN', 'Refund completed', 'Your refund for order VA-100 was completed.'],
    ['hi-IN', 'रिफंड पूरा हुआ', 'ऑर्डर VA-100 का आपका रिफंड पूरा हो गया है।'],
  ])('creates a sent, localized and audited farmer event for %s', async (locale, title, body) => {
    const notification = { id: notificationId };
    const tx = {
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue({ preferredLocale: locale }),
      },
      notification: { create: jest.fn().mockResolvedValue(notification) },
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = new NotificationEventsService(audit as never);

    const result = await service.emitFarmerEvent(tx as never, {
      event: FarmerNotificationEvent.REFUND_SUCCEEDED,
      recipientUserId: farmerUserId,
      returnRequestId,
      productOrderId,
      orderNumber: 'VA-100',
      actorUserId,
      actorRole: PlatformRole.OPERATIONS_MANAGER,
      requestId: 'request-1',
      refundId,
      amountPaise: 25000,
    });

    expect(result).toBe(notification);
    expect(tx.farmerProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: farmerUserId },
      select: { preferredLocale: true },
    });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipientUserId: farmerUserId,
        channel: NotificationChannel.IN_APP,
        category: FarmerNotificationEvent.REFUND_SUCCEEDED,
        title,
        body,
        status: NotificationStatus.SENT,
        relatedResourceType: 'ReturnRequest',
        relatedResourceId: returnRequestId,
        payloadSnapshot: expect.objectContaining({
          returnRequestId,
          productOrderId,
          refundId,
          amountPaise: 25000,
        }),
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'NOTIFICATION_ENQUEUED',
        resourceId: notificationId,
        requestId: 'request-1',
      }),
      tx,
    );
  });

  it('resolves the farmer owner and creates an order deep-link notification', async () => {
    const notification = { id: notificationId };
    const tx = {
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue({
          userId: farmerUserId,
          preferredLocale: 'hi-IN',
        }),
      },
      notification: { create: jest.fn().mockResolvedValue(notification) },
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = new NotificationEventsService(audit as never);

    await service.emitOrderEvent(tx as never, {
      event: FarmerOrderNotificationEvent.ORDER_OUT_FOR_DELIVERY,
      farmerProfileId,
      productOrderId,
      orderNumber: 'VA-100',
      actorUserId,
      actorRole: PlatformRole.DELIVERY_PARTNER,
      requestId: 'request-order-1',
    });

    expect(tx.farmerProfile.findUnique).toHaveBeenCalledWith({
      where: { id: farmerProfileId },
      select: { userId: true, preferredLocale: true },
    });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipientUserId: farmerUserId,
        category: FarmerOrderNotificationEvent.ORDER_OUT_FOR_DELIVERY,
        title: 'ऑर्डर डिलीवरी के लिए निकला',
        relatedResourceType: 'ProductOrder',
        relatedResourceId: productOrderId,
        status: NotificationStatus.SENT,
      }),
    });
  });

  it('creates a localized support-ticket deep-link notification', async () => {
    const tx = {
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue({ preferredLocale: 'hi-IN' }),
      },
      notification: { create: jest.fn().mockResolvedValue({ id: notificationId }) },
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = new NotificationEventsService(audit as never);

    await service.emitSupportEvent(tx as never, {
      event: FarmerSupportNotificationEvent.SUPPORT_TICKET_RESOLVED,
      recipientUserId: farmerUserId,
      supportTicketId,
      actorUserId,
      actorRole: PlatformRole.SUPPORT_AGENT,
      requestId: 'request-support-1',
    });

    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recipientUserId: farmerUserId,
        category: FarmerSupportNotificationEvent.SUPPORT_TICKET_RESOLVED,
        title: 'सहायता अनुरोध हल हुआ',
        relatedResourceType: 'SupportTicket',
        relatedResourceId: supportTicketId,
        payloadSnapshot: {
          event: FarmerSupportNotificationEvent.SUPPORT_TICKET_RESOLVED,
          supportTicketId,
        },
      }),
    });
  });

  it('creates an informational checkout payment notification from backend amounts', async () => {
    const tx = {
      farmerProfile: {
        findUnique: jest.fn().mockResolvedValue({
          userId: farmerUserId,
          preferredLocale: 'en-IN',
        }),
      },
      notification: { create: jest.fn().mockResolvedValue({ id: notificationId }) },
    };
    const service = new NotificationEventsService({ record: jest.fn() } as never);

    await service.emitPaymentEvent(tx as never, {
      event: FarmerPaymentNotificationEvent.PAYMENT_SUCCEEDED,
      farmerProfileId,
      productCheckoutId,
      paymentIntentId,
      amountPaise: 25000,
      actorUserId,
      actorRole: PlatformRole.FARMER,
    });

    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: FarmerPaymentNotificationEvent.PAYMENT_SUCCEEDED,
        title: 'Payment successful',
        relatedResourceType: 'ProductCheckout',
        relatedResourceId: productCheckoutId,
        payloadSnapshot: {
          event: FarmerPaymentNotificationEvent.PAYMENT_SUCCEEDED,
          productCheckoutId,
          paymentIntentId,
          amountPaise: 25000,
        },
      }),
    });
  });
});

const notificationId = '00000000-0000-4000-8000-000000003001';
const farmerUserId = '00000000-0000-4000-8000-000000003002';
const farmerProfileId = '00000000-0000-4000-8000-000000003007';
const returnRequestId = '00000000-0000-4000-8000-000000003003';
const productOrderId = '00000000-0000-4000-8000-000000003004';
const refundId = '00000000-0000-4000-8000-000000003005';
const actorUserId = '00000000-0000-4000-8000-000000003006';
const supportTicketId = '00000000-0000-4000-8000-000000003008';
const productCheckoutId = '00000000-0000-4000-8000-000000003009';
const paymentIntentId = '00000000-0000-4000-8000-000000003010';
