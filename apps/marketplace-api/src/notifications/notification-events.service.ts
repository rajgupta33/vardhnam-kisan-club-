import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationStatus, Prisma, type PlatformRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

export enum FarmerNotificationEvent {
  RETURN_REQUESTED = 'RETURN_REQUESTED',
  RETURN_APPROVED = 'RETURN_APPROVED',
  RETURN_REJECTED = 'RETURN_REJECTED',
  RETURN_IN_TRANSIT = 'RETURN_IN_TRANSIT',
  RETURN_RECEIVED = 'RETURN_RECEIVED',
  RETURN_INSPECTED = 'RETURN_INSPECTED',
  RETURN_CANCELLED = 'RETURN_CANCELLED',
  REFUND_INITIATED = 'REFUND_INITIATED',
  REFUND_SUCCEEDED = 'REFUND_SUCCEEDED',
  REFUND_FAILED = 'REFUND_FAILED',
}

export enum FarmerOrderNotificationEvent {
  ORDER_ACCEPTED = 'ORDER_ACCEPTED',
  ORDER_REJECTED = 'ORDER_REJECTED',
  ORDER_PACKED = 'ORDER_PACKED',
  INVOICE_GENERATED = 'INVOICE_GENERATED',
  ORDER_READY_FOR_PICKUP = 'ORDER_READY_FOR_PICKUP',
  ORDER_OUT_FOR_DELIVERY = 'ORDER_OUT_FOR_DELIVERY',
  ORDER_DELIVERED = 'ORDER_DELIVERED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
}

export enum FarmerSupportNotificationEvent {
  SUPPORT_TICKET_CREATED = 'SUPPORT_TICKET_CREATED',
  SUPPORT_TICKET_ASSIGNED = 'SUPPORT_TICKET_ASSIGNED',
  SUPPORT_TICKET_WAITING_FOR_CUSTOMER = 'SUPPORT_TICKET_WAITING_FOR_CUSTOMER',
  SUPPORT_TICKET_WAITING_FOR_SELLER = 'SUPPORT_TICKET_WAITING_FOR_SELLER',
  SUPPORT_TICKET_RESUMED = 'SUPPORT_TICKET_RESUMED',
  SUPPORT_TICKET_ESCALATED = 'SUPPORT_TICKET_ESCALATED',
  SUPPORT_TICKET_RESOLVED = 'SUPPORT_TICKET_RESOLVED',
  SUPPORT_TICKET_CLOSED = 'SUPPORT_TICKET_CLOSED',
  SUPPORT_TICKET_REOPENED = 'SUPPORT_TICKET_REOPENED',
}

export enum FarmerPaymentNotificationEvent {
  PAYMENT_SUCCEEDED = 'PAYMENT_SUCCEEDED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
}

export enum FarmerDisputeNotificationEvent {
  DISPUTE_RAISED = 'DISPUTE_RAISED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
}

export interface FarmerNotificationEventInput {
  event: FarmerNotificationEvent;
  recipientUserId: string;
  returnRequestId: string;
  productOrderId: string;
  orderNumber: string;
  actorUserId: string;
  actorRole: PlatformRole;
  requestId?: string | undefined;
  refundId?: string | undefined;
  amountPaise?: number | undefined;
}

export interface FarmerOrderNotificationEventInput {
  event: FarmerOrderNotificationEvent;
  farmerProfileId: string;
  productOrderId: string;
  orderNumber: string;
  actorUserId: string;
  actorRole: PlatformRole;
  requestId?: string | undefined;
  invoiceId?: string | undefined;
}

export interface FarmerSupportNotificationEventInput {
  event: FarmerSupportNotificationEvent;
  recipientUserId: string;
  supportTicketId: string;
  actorUserId: string;
  actorRole: PlatformRole;
  requestId?: string | undefined;
}

export interface FarmerPaymentNotificationEventInput {
  event: FarmerPaymentNotificationEvent;
  farmerProfileId: string;
  productCheckoutId: string;
  paymentIntentId: string;
  amountPaise: number;
  /**
   * Absent when the platform acted on its own -- a payment settled from a
   * gateway webhook has no human behind it. The notification is still the
   * farmer's, only its actor is null.
   */
  actorUserId?: string | undefined;
  actorRole?: PlatformRole | undefined;
  requestId?: string | undefined;
}

export interface FarmerDisputeNotificationEventInput {
  event: FarmerDisputeNotificationEvent;
  recipientUserId: string;
  disputeId: string;
  productOrderId: string;
  orderNumber: string;
  actorUserId: string;
  actorRole: PlatformRole;
  requestId?: string | undefined;
  resolutionAmountPaise?: number | undefined;
}

type LocalizedCopy = { title: string; body: string };

type NotificationEvent =
  | FarmerNotificationEvent
  | FarmerOrderNotificationEvent
  | FarmerPaymentNotificationEvent
  | FarmerSupportNotificationEvent
  | FarmerDisputeNotificationEvent;

/**
 * Events that also go out by SMS, on top of the in-app record.
 *
 * Kept deliberately short. Every SMS costs money per message and a farmer who
 * receives one for each of a dozen status changes will stop reading them, so
 * this covers only the moments where not knowing has a real consequence: money
 * moved, someone is about to arrive at the door, or an expected refund landed.
 * Everything else stays in the app.
 *
 * Push is not listed anywhere yet: device-token registration does not exist, so
 * a PUSH row would only ever record a failure. It is added with the farmer app's
 * push work in WP-10r.
 */
const smsEvents = new Set<NotificationEvent>([
  FarmerPaymentNotificationEvent.PAYMENT_SUCCEEDED,
  FarmerOrderNotificationEvent.ORDER_OUT_FOR_DELIVERY,
  FarmerOrderNotificationEvent.ORDER_DELIVERED,
  FarmerOrderNotificationEvent.ORDER_CANCELLED,
  FarmerNotificationEvent.REFUND_SUCCEEDED,
]);

export function channelsForEvent(event: NotificationEvent): NotificationChannel[] {
  return smsEvents.has(event)
    ? [NotificationChannel.IN_APP, NotificationChannel.SMS]
    : [NotificationChannel.IN_APP];
}

const copy: Record<NotificationEvent, { en: LocalizedCopy; hi: LocalizedCopy }> = {
  [FarmerDisputeNotificationEvent.DISPUTE_RAISED]: {
    en: { title: 'Dispute opened', body: 'A dispute for order {orderNumber} is now under review.' },
    hi: { title: 'विवाद दर्ज हुआ', body: 'ऑर्डर {orderNumber} का विवाद अब समीक्षा में है।' },
  },
  [FarmerDisputeNotificationEvent.DISPUTE_RESOLVED]: {
    en: { title: 'Dispute resolved', body: 'The dispute for order {orderNumber} has been resolved.' },
    hi: { title: 'विवाद हल हुआ', body: 'ऑर्डर {orderNumber} का विवाद हल कर दिया गया है।' },
  },
  [FarmerNotificationEvent.RETURN_REQUESTED]: {
    en: {
      title: 'Return request received',
      body: 'Your return request for order {orderNumber} was received.',
    },
    hi: {
      title: 'वापसी अनुरोध मिला',
      body: 'ऑर्डर {orderNumber} के लिए आपका वापसी अनुरोध मिल गया है।',
    },
  },
  [FarmerNotificationEvent.RETURN_APPROVED]: {
    en: { title: 'Return approved', body: 'Your return for order {orderNumber} was approved.' },
    hi: { title: 'वापसी स्वीकृत', body: 'ऑर्डर {orderNumber} की वापसी स्वीकृत हो गई है।' },
  },
  [FarmerNotificationEvent.RETURN_REJECTED]: {
    en: {
      title: 'Return not approved',
      body: 'Your return for order {orderNumber} was not approved.',
    },
    hi: { title: 'वापसी स्वीकृत नहीं हुई', body: 'ऑर्डर {orderNumber} की वापसी स्वीकृत नहीं हुई।' },
  },
  [FarmerNotificationEvent.RETURN_IN_TRANSIT]: {
    en: {
      title: 'Return picked up',
      body: 'Your return for order {orderNumber} is on its way to the seller.',
    },
    hi: {
      title: 'वापसी पिकअप हो गई',
      body: 'ऑर्डर {orderNumber} की वापसी विक्रेता के पास भेजी जा रही है।',
    },
  },
  [FarmerNotificationEvent.RETURN_RECEIVED]: {
    en: {
      title: 'Return received',
      body: 'The seller received your return for order {orderNumber}.',
    },
    hi: { title: 'वापसी प्राप्त हुई', body: 'विक्रेता को ऑर्डर {orderNumber} की वापसी मिल गई है।' },
  },
  [FarmerNotificationEvent.RETURN_INSPECTED]: {
    en: {
      title: 'Return inspection completed',
      body: 'Inspection for order {orderNumber} is complete.',
    },
    hi: {
      title: 'वापसी की जाँच पूरी हुई',
      body: 'ऑर्डर {orderNumber} की वापसी जाँच पूरी हो गई है।',
    },
  },
  [FarmerNotificationEvent.RETURN_CANCELLED]: {
    en: { title: 'Return cancelled', body: 'Your return for order {orderNumber} was cancelled.' },
    hi: { title: 'वापसी रद्द हुई', body: 'ऑर्डर {orderNumber} की वापसी रद्द हो गई है।' },
  },
  [FarmerNotificationEvent.REFUND_INITIATED]: {
    en: { title: 'Refund started', body: 'A refund for order {orderNumber} has been started.' },
    hi: { title: 'रिफंड शुरू हुआ', body: 'ऑर्डर {orderNumber} का रिफंड शुरू हो गया है।' },
  },
  [FarmerNotificationEvent.REFUND_SUCCEEDED]: {
    en: { title: 'Refund completed', body: 'Your refund for order {orderNumber} was completed.' },
    hi: { title: 'रिफंड पूरा हुआ', body: 'ऑर्डर {orderNumber} का आपका रिफंड पूरा हो गया है।' },
  },
  [FarmerNotificationEvent.REFUND_FAILED]: {
    en: {
      title: 'Refund needs attention',
      body: 'The refund for order {orderNumber} could not be completed.',
    },
    hi: { title: 'रिफंड पर ध्यान दें', body: 'ऑर्डर {orderNumber} का रिफंड पूरा नहीं हो सका।' },
  },
  [FarmerOrderNotificationEvent.ORDER_ACCEPTED]: {
    en: { title: 'Order accepted', body: 'The seller accepted order {orderNumber}.' },
    hi: { title: 'ऑर्डर स्वीकार हुआ', body: 'विक्रेता ने ऑर्डर {orderNumber} स्वीकार कर लिया है।' },
  },
  [FarmerOrderNotificationEvent.ORDER_REJECTED]: {
    en: { title: 'Order not accepted', body: 'The seller could not accept order {orderNumber}.' },
    hi: {
      title: 'ऑर्डर स्वीकार नहीं हुआ',
      body: 'विक्रेता ऑर्डर {orderNumber} स्वीकार नहीं कर सका।',
    },
  },
  [FarmerOrderNotificationEvent.ORDER_PACKED]: {
    en: { title: 'Order packed', body: 'Order {orderNumber} has been packed.' },
    hi: { title: 'ऑर्डर पैक हो गया', body: 'ऑर्डर {orderNumber} पैक हो गया है।' },
  },
  [FarmerOrderNotificationEvent.INVOICE_GENERATED]: {
    en: { title: 'Invoice ready', body: 'The seller invoice for order {orderNumber} is ready.' },
    hi: { title: 'इनवॉइस तैयार है', body: 'ऑर्डर {orderNumber} का विक्रेता इनवॉइस तैयार है।' },
  },
  [FarmerOrderNotificationEvent.ORDER_READY_FOR_PICKUP]: {
    en: {
      title: 'Order ready for pickup',
      body: 'Order {orderNumber} is ready for delivery pickup.',
    },
    hi: {
      title: 'ऑर्डर पिकअप के लिए तैयार है',
      body: 'ऑर्डर {orderNumber} डिलीवरी पिकअप के लिए तैयार है।',
    },
  },
  [FarmerOrderNotificationEvent.ORDER_OUT_FOR_DELIVERY]: {
    en: { title: 'Out for delivery', body: 'Order {orderNumber} is out for delivery.' },
    hi: {
      title: 'ऑर्डर डिलीवरी के लिए निकला',
      body: 'ऑर्डर {orderNumber} डिलीवरी के लिए निकल गया है।',
    },
  },
  [FarmerOrderNotificationEvent.ORDER_DELIVERED]: {
    en: { title: 'Order delivered', body: 'Order {orderNumber} was delivered.' },
    hi: { title: 'ऑर्डर डिलीवर हुआ', body: 'ऑर्डर {orderNumber} डिलीवर हो गया है।' },
  },
  [FarmerOrderNotificationEvent.ORDER_CANCELLED]: {
    en: { title: 'Order cancelled', body: 'Order {orderNumber} was cancelled.' },
    hi: { title: 'ऑर्डर रद्द हुआ', body: 'ऑर्डर {orderNumber} रद्द हो गया है।' },
  },
  [FarmerSupportNotificationEvent.SUPPORT_TICKET_CREATED]: {
    en: { title: 'Support request received', body: 'Your support request was received.' },
    hi: { title: 'सहायता अनुरोध मिला', body: 'आपका सहायता अनुरोध मिल गया है।' },
  },
  [FarmerSupportNotificationEvent.SUPPORT_TICKET_ASSIGNED]: {
    en: { title: 'Support request assigned', body: 'A support agent is handling your request.' },
    hi: { title: 'सहायता अनुरोध सौंपा गया', body: 'एक सहायता एजेंट आपके अनुरोध पर काम कर रहा है।' },
  },
  [FarmerSupportNotificationEvent.SUPPORT_TICKET_WAITING_FOR_CUSTOMER]: {
    en: { title: 'More information needed', body: 'Support is waiting for information from you.' },
    hi: { title: 'और जानकारी चाहिए', body: 'सहायता टीम को आपसे जानकारी चाहिए।' },
  },
  [FarmerSupportNotificationEvent.SUPPORT_TICKET_WAITING_FOR_SELLER]: {
    en: {
      title: 'Waiting for seller',
      body: 'Support is waiting for information from the seller.',
    },
    hi: {
      title: 'विक्रेता के उत्तर की प्रतीक्षा',
      body: 'सहायता टीम विक्रेता से जानकारी की प्रतीक्षा कर रही है।',
    },
  },
  [FarmerSupportNotificationEvent.SUPPORT_TICKET_RESUMED]: {
    en: { title: 'Support request resumed', body: 'Work on your support request has resumed.' },
    hi: {
      title: 'सहायता अनुरोध फिर शुरू हुआ',
      body: 'आपके सहायता अनुरोध पर काम फिर शुरू हो गया है।',
    },
  },
  [FarmerSupportNotificationEvent.SUPPORT_TICKET_ESCALATED]: {
    en: {
      title: 'Support request escalated',
      body: 'Your request was escalated for further review.',
    },
    hi: {
      title: 'सहायता अनुरोध आगे भेजा गया',
      body: 'आपका अनुरोध आगे की जाँच के लिए भेजा गया है।',
    },
  },
  [FarmerSupportNotificationEvent.SUPPORT_TICKET_RESOLVED]: {
    en: { title: 'Support request resolved', body: 'Your support request was marked resolved.' },
    hi: { title: 'सहायता अनुरोध हल हुआ', body: 'आपका सहायता अनुरोध हल कर दिया गया है।' },
  },
  [FarmerSupportNotificationEvent.SUPPORT_TICKET_CLOSED]: {
    en: { title: 'Support request closed', body: 'Your support request was closed.' },
    hi: { title: 'सहायता अनुरोध बंद हुआ', body: 'आपका सहायता अनुरोध बंद कर दिया गया है।' },
  },
  [FarmerSupportNotificationEvent.SUPPORT_TICKET_REOPENED]: {
    en: { title: 'Support request reopened', body: 'Your support request was reopened.' },
    hi: { title: 'सहायता अनुरोध फिर खोला गया', body: 'आपका सहायता अनुरोध फिर खोल दिया गया है।' },
  },
  [FarmerPaymentNotificationEvent.PAYMENT_SUCCEEDED]: {
    en: { title: 'Payment successful', body: 'Your payment was completed successfully.' },
    hi: { title: 'भुगतान सफल हुआ', body: 'आपका भुगतान सफलतापूर्वक पूरा हो गया है।' },
  },
  [FarmerPaymentNotificationEvent.PAYMENT_FAILED]: {
    en: {
      title: 'Payment failed',
      body: 'Your payment could not be completed. You can try again.',
    },
    hi: {
      title: 'भुगतान विफल हुआ',
      body: 'आपका भुगतान पूरा नहीं हो सका। आप फिर कोशिश कर सकते हैं।',
    },
  },
};

@Injectable()
export class NotificationEventsService {
  constructor(private readonly auditService: AuditService) {}

  async emitFarmerEvent(tx: Prisma.TransactionClient, input: FarmerNotificationEventInput) {
    const profile = await tx.farmerProfile.findUnique({
      where: { userId: input.recipientUserId },
      select: { preferredLocale: true },
    });
    const payload: Prisma.InputJsonObject = {
      event: input.event,
      returnRequestId: input.returnRequestId,
      productOrderId: input.productOrderId,
      ...(input.refundId ? { refundId: input.refundId } : {}),
      ...(input.amountPaise !== undefined ? { amountPaise: input.amountPaise } : {}),
    };
    return this.createInAppNotification(tx, {
      event: input.event,
      recipientUserId: input.recipientUserId,
      preferredLocale: profile?.preferredLocale,
      relatedResourceType: 'ReturnRequest',
      relatedResourceId: input.returnRequestId,
      orderNumber: input.orderNumber,
      payload,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      requestId: input.requestId,
    });
  }

  async emitOrderEvent(tx: Prisma.TransactionClient, input: FarmerOrderNotificationEventInput) {
    const profile = await tx.farmerProfile.findUnique({
      where: { id: input.farmerProfileId },
      select: { userId: true, preferredLocale: true },
    });
    if (!profile) {
      throw new Error(`Farmer profile ${input.farmerProfileId} was not found for notification`);
    }
    const payload: Prisma.InputJsonObject = {
      event: input.event,
      productOrderId: input.productOrderId,
      ...(input.invoiceId ? { invoiceId: input.invoiceId } : {}),
    };
    return this.createInAppNotification(tx, {
      event: input.event,
      recipientUserId: profile.userId,
      preferredLocale: profile.preferredLocale,
      relatedResourceType: 'ProductOrder',
      relatedResourceId: input.productOrderId,
      orderNumber: input.orderNumber,
      payload,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      requestId: input.requestId,
    });
  }

  async emitSupportEvent(tx: Prisma.TransactionClient, input: FarmerSupportNotificationEventInput) {
    const profile = await tx.farmerProfile.findUnique({
      where: { userId: input.recipientUserId },
      select: { preferredLocale: true },
    });
    if (!profile) {
      throw new Error(`Farmer profile for user ${input.recipientUserId} was not found`);
    }
    return this.createInAppNotification(tx, {
      event: input.event,
      recipientUserId: input.recipientUserId,
      preferredLocale: profile.preferredLocale,
      relatedResourceType: 'SupportTicket',
      relatedResourceId: input.supportTicketId,
      payload: {
        event: input.event,
        supportTicketId: input.supportTicketId,
      },
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      requestId: input.requestId,
    });
  }

  async emitPaymentEvent(tx: Prisma.TransactionClient, input: FarmerPaymentNotificationEventInput) {
    const profile = await tx.farmerProfile.findUnique({
      where: { id: input.farmerProfileId },
      select: { userId: true, preferredLocale: true },
    });
    if (!profile) {
      throw new Error(`Farmer profile ${input.farmerProfileId} was not found for notification`);
    }
    return this.createInAppNotification(tx, {
      event: input.event,
      recipientUserId: profile.userId,
      preferredLocale: profile.preferredLocale,
      relatedResourceType: 'ProductCheckout',
      relatedResourceId: input.productCheckoutId,
      payload: {
        event: input.event,
        productCheckoutId: input.productCheckoutId,
        paymentIntentId: input.paymentIntentId,
        amountPaise: input.amountPaise,
      },
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      requestId: input.requestId,
    });
  }

  async emitDisputeEvent(tx: Prisma.TransactionClient, input: FarmerDisputeNotificationEventInput) {
    const profile = await tx.farmerProfile.findUnique({
      where: { userId: input.recipientUserId },
      select: { preferredLocale: true },
    });
    if (!profile) {
      throw new Error(`Farmer profile for user ${input.recipientUserId} was not found`);
    }
    return this.createInAppNotification(tx, {
      event: input.event,
      recipientUserId: input.recipientUserId,
      preferredLocale: profile.preferredLocale,
      relatedResourceType: 'ProductOrder',
      relatedResourceId: input.productOrderId,
      orderNumber: input.orderNumber,
      payload: {
        event: input.event,
        disputeId: input.disputeId,
        productOrderId: input.productOrderId,
        ...(input.resolutionAmountPaise !== undefined
          ? { resolutionAmountPaise: input.resolutionAmountPaise }
          : {}),
      },
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      requestId: input.requestId,
    });
  }

  private async createInAppNotification(
    tx: Prisma.TransactionClient,
    input: {
      event: NotificationEvent;
      recipientUserId: string;
      preferredLocale?: string | undefined;
      relatedResourceType: 'ProductCheckout' | 'ProductOrder' | 'ReturnRequest' | 'SupportTicket';
      relatedResourceId: string;
      orderNumber?: string | undefined;
      payload: Prisma.InputJsonObject;
      /** Null for platform-initiated events; operator surfaces render "system". */
      actorUserId?: string | undefined;
      actorRole?: PlatformRole | undefined;
      requestId?: string | undefined;
    },
  ) {
    const language = input.preferredLocale?.toLowerCase().startsWith('hi') ? 'hi' : 'en';
    const localizedCopy = copy[input.event][language];
    const interpolate = (value: string) =>
      input.orderNumber ? value.replaceAll('{orderNumber}', input.orderNumber) : value;
    const title = interpolate(localizedCopy.title);
    const body = interpolate(localizedCopy.body);

    let inAppNotification: Awaited<ReturnType<typeof tx.notification.create>> | undefined;

    // One row per channel this event goes out on. Separate rows rather than one
    // row with several channels, so each transport has its own status, attempt
    // history and provider reference -- an SMS that failed must not make the
    // in-app copy look undelivered.
    for (const channel of channelsForEvent(input.event)) {
      const isInApp = channel === NotificationChannel.IN_APP;
      const reason = `Automatic ${isInApp ? 'in-app' : channel.toLowerCase()} notification for ${input.event}`;

      const notification = await tx.notification.create({
        data: {
          recipientUserId: input.recipientUserId,
          channel,
          category: input.event,
          title,
          body,
          payloadSnapshot: input.payload,
          // In-app is delivered by existing; every other channel waits for the
          // delivery worker to pick it up.
          status: isInApp ? NotificationStatus.SENT : NotificationStatus.PENDING,
          relatedResourceType: input.relatedResourceType,
          relatedResourceId: input.relatedResourceId,
          triggeredByUserId: input.actorUserId ?? null,
          triggeredByRole: input.actorRole ?? null,
          reason,
        },
      });

      await this.auditService.record(
        {
          actorUserId: input.actorUserId,
          actorRole: input.actorRole,
          action: 'NOTIFICATION_ENQUEUED',
          resourceType: 'Notification',
          resourceId: notification.id,
          newValue: {
            recipientUserId: input.recipientUserId,
            channel,
            category: input.event,
            status: notification.status,
            relatedResourceType: input.relatedResourceType,
            relatedResourceId: input.relatedResourceId,
          },
          requestId: input.requestId,
          reason,
        },
        tx,
      );

      if (isInApp) {
        inAppNotification = notification;
      }
    }

    // Callers rely on the in-app row being returned; it is always created.
    return inAppNotification!;
  }
}
