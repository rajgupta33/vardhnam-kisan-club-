import { Prisma, type PaymentIntent, type ProductCheckout, type ProductOrder } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * The query shapes and audit projections shared by everything that touches a
 * payment intent.
 *
 * They live here rather than in `PaymentsService` because three callers now
 * need them -- the farmer-facing mock confirm path, the webhook handler and
 * reconciliation -- and an audit projection that drifts between callers makes
 * the audit log lie about what changed.
 */

export const paymentCheckoutInclude = Prisma.validator<Prisma.ProductCheckoutInclude>()({
  orders: {
    orderBy: { createdAt: 'asc' },
  },
});

export const paymentIntentDetailInclude = Prisma.validator<Prisma.PaymentIntentInclude>()({
  checkout: {
    include: paymentCheckoutInclude,
  },
  events: {
    orderBy: { createdAt: 'asc' },
  },
});

export type PaymentClient = PrismaService | Prisma.TransactionClient;

export type PaymentCheckoutWithOrders = Prisma.ProductCheckoutGetPayload<{
  include: typeof paymentCheckoutInclude;
}>;

export type PaymentIntentWithDetails = Prisma.PaymentIntentGetPayload<{
  include: typeof paymentIntentDetailInclude;
}>;

export function checkoutAuditValue(checkout: ProductCheckout): Prisma.InputJsonObject {
  return {
    farmerProfileId: checkout.farmerProfileId,
    sourceCartId: checkout.sourceCartId,
    deliveryAddressId: checkout.deliveryAddressId,
    serviceablePincode: checkout.serviceablePincode,
    status: checkout.status,
    subtotalPaise: checkout.subtotalPaise,
    clubBenefitPaise: checkout.clubBenefitPaise,
    farmerPayablePaise: checkout.farmerPayablePaise,
    itemCount: checkout.itemCount,
    childOrderCount: checkout.childOrderCount,
  };
}

export function productOrderAuditValue(order: ProductOrder): Prisma.InputJsonObject {
  return {
    checkoutId: order.checkoutId,
    orderType: order.orderType,
    farmerProfileId: order.farmerProfileId,
    deliveryAddressId: order.deliveryAddressId,
    sellerOrganisationId: order.sellerOrganisationId,
    orderNumber: order.orderNumber,
    status: order.status,
    serviceablePincode: order.serviceablePincode,
    sellerNameSnapshot: order.sellerNameSnapshot,
    sellerGstinSnapshot: order.sellerGstinSnapshot,
    subtotalPaise: order.subtotalPaise,
    clubBenefitPaise: order.clubBenefitPaise,
    farmerPayablePaise: order.farmerPayablePaise,
    isKisanClubOrder: order.isKisanClubOrder,
    itemCount: order.itemCount,
  };
}

export function paymentIntentAuditValue(paymentIntent: PaymentIntent): Prisma.InputJsonObject {
  return {
    checkoutId: paymentIntent.checkoutId,
    farmerProfileId: paymentIntent.farmerProfileId,
    providerMode: paymentIntent.providerMode,
    providerReference: paymentIntent.providerReference,
    providerPaymentReference: paymentIntent.providerPaymentReference,
    providerStatus: paymentIntent.providerStatus,
    status: paymentIntent.status,
    amountPaise: paymentIntent.amountPaise,
    currency: paymentIntent.currency,
    failureCode: paymentIntent.failureCode,
    failureMessage: paymentIntent.failureMessage,
  };
}

export function toPaymentIntentDetail(paymentIntent: PaymentIntentWithDetails) {
  return {
    id: paymentIntent.id,
    checkoutId: paymentIntent.checkoutId,
    farmerProfileId: paymentIntent.farmerProfileId,
    providerMode: paymentIntent.providerMode,
    providerReference: paymentIntent.providerReference,
    providerPaymentReference: paymentIntent.providerPaymentReference,
    providerStatus: paymentIntent.providerStatus,
    lastProviderSyncAt: paymentIntent.lastProviderSyncAt,
    status: paymentIntent.status,
    amountPaise: paymentIntent.amountPaise,
    currency: paymentIntent.currency,
    failureCode: paymentIntent.failureCode,
    failureMessage: paymentIntent.failureMessage,
    checkout: {
      id: paymentIntent.checkout.id,
      status: paymentIntent.checkout.status,
      subtotalPaise: paymentIntent.checkout.subtotalPaise,
      clubBenefitPaise: paymentIntent.checkout.clubBenefitPaise,
      farmerPayablePaise: paymentIntent.checkout.farmerPayablePaise,
      itemCount: paymentIntent.checkout.itemCount,
      childOrderCount: paymentIntent.checkout.childOrderCount,
      orders: paymentIntent.checkout.orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        sellerOrganisationId: order.sellerOrganisationId,
        sellerNameSnapshot: order.sellerNameSnapshot,
        subtotalPaise: order.subtotalPaise,
        clubBenefitPaise: order.clubBenefitPaise,
        farmerPayablePaise: order.farmerPayablePaise,
        isKisanClubOrder: order.isKisanClubOrder,
        itemCount: order.itemCount,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })),
      createdAt: paymentIntent.checkout.createdAt,
      updatedAt: paymentIntent.checkout.updatedAt,
    },
    events: paymentIntent.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      status: event.status,
      providerReference: event.providerReference,
      payload: event.payload,
      actorUserId: event.actorUserId,
      actorRole: event.actorRole,
      requestId: event.requestId,
      createdAt: event.createdAt,
    })),
    createdAt: paymentIntent.createdAt,
    updatedAt: paymentIntent.updatedAt,
  };
}
