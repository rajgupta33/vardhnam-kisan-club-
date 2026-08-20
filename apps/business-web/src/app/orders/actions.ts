'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  AssignDeliveryInput,
  CompleteDeliveryInput,
  FulfilmentOrderDecisionInput,
  GenerateProductInvoiceInput,
} from '@vardhnam/api-client';
import {
  acceptFulfilmentOrder,
  assignFulfilmentOrderDelivery,
  completeFulfilmentOrderDelivery,
  downloadFulfilmentInvoicePdf,
  formatApiError,
  generateProductInvoice,
  markFulfilmentOrderOutForDelivery,
  markFulfilmentOrderReadyToPack,
  markFulfilmentOrderReadyForPickup,
  packFulfilmentOrder,
  requestFulfilmentInvoicePdf,
  rejectFulfilmentOrder,
} from '../../lib/marketplace-api';
import { requireHttpDownloadUrl } from '../../lib/document-download';

export async function acceptOrderAction(formData: FormData): Promise<void> {
  const orderId = requireFormValue(formData, 'orderId');
  const reason = optionalFormValue(formData, 'reason');
  const input: FulfilmentOrderDecisionInput = {
    ...(reason ? { reason } : {}),
  };

  try {
    await acceptFulfilmentOrder(orderId, input);
    revalidateOrderPaths(orderId);
    redirectWithOrderMessage(orderId, 'notice', 'Order accepted');
  } catch (error) {
    redirectWithOrderMessage(orderId, 'error', formatApiError(error));
  }
}

export async function rejectOrderAction(formData: FormData): Promise<void> {
  const orderId = requireFormValue(formData, 'orderId');
  const input: FulfilmentOrderDecisionInput = {
    reason: requireFormValue(formData, 'reason'),
  };

  try {
    await rejectFulfilmentOrder(orderId, input);
    revalidateOrderPaths(orderId);
    redirectWithOrderMessage(orderId, 'notice', 'Order rejected');
  } catch (error) {
    redirectWithOrderMessage(orderId, 'error', formatApiError(error));
  }
}

export async function markReadyToPackAction(formData: FormData): Promise<void> {
  const orderId = requireFormValue(formData, 'orderId');
  const reason = optionalFormValue(formData, 'reason');
  const input: FulfilmentOrderDecisionInput = {
    ...(reason ? { reason } : {}),
  };

  try {
    await markFulfilmentOrderReadyToPack(orderId, input);
    revalidateOrderPaths(orderId);
    redirectWithOrderMessage(orderId, 'notice', 'Order marked ready to pack');
  } catch (error) {
    redirectWithOrderMessage(orderId, 'error', formatApiError(error));
  }
}

export async function packOrderAction(formData: FormData): Promise<void> {
  const orderId = requireFormValue(formData, 'orderId');
  const reason = optionalFormValue(formData, 'reason');
  const input: FulfilmentOrderDecisionInput = {
    ...(reason ? { reason } : {}),
  };

  try {
    await packFulfilmentOrder(orderId, input);
    revalidateOrderPaths(orderId);
    redirectWithOrderMessage(orderId, 'notice', 'Order packed');
  } catch (error) {
    redirectWithOrderMessage(orderId, 'error', formatApiError(error));
  }
}

export async function generateInvoiceAction(formData: FormData): Promise<void> {
  const orderId = requireFormValue(formData, 'orderId');
  const reason = optionalFormValue(formData, 'reason');
  const input: GenerateProductInvoiceInput = {
    ...(reason ? { reason } : {}),
  };

  try {
    await generateProductInvoice(orderId, input);
    revalidateOrderPaths(orderId);
    redirectWithOrderMessage(orderId, 'notice', 'Invoice generated');
  } catch (error) {
    redirectWithOrderMessage(orderId, 'error', formatApiError(error));
  }
}

export async function requestInvoicePdfAction(formData: FormData): Promise<void> {
  const orderId = requireFormValue(formData, 'orderId');
  try {
    await requestFulfilmentInvoicePdf(orderId);
  } catch (error) {
    redirectWithOrderMessage(orderId, 'error', formatApiError(error));
  }
  revalidateOrderPaths(orderId);
  redirectWithOrderMessage(orderId, 'notice', 'Invoice PDF requested');
}

export async function downloadInvoicePdfAction(formData: FormData): Promise<void> {
  const orderId = requireFormValue(formData, 'orderId');
  let downloadUrl: string;
  try {
    const download = await downloadFulfilmentInvoicePdf(orderId);
    downloadUrl = requireHttpDownloadUrl(download.downloadUrl);
  } catch (error) {
    redirectWithOrderMessage(orderId, 'error', formatApiError(error));
  }
  redirect(downloadUrl);
}

export async function markReadyForPickupAction(formData: FormData): Promise<void> {
  const orderId = requireFormValue(formData, 'orderId');
  const reason = optionalFormValue(formData, 'reason');
  const input: FulfilmentOrderDecisionInput = {
    ...(reason ? { reason } : {}),
  };

  try {
    await markFulfilmentOrderReadyForPickup(orderId, input);
    revalidateOrderPaths(orderId);
    redirectWithOrderMessage(orderId, 'notice', 'Order marked ready for pickup');
  } catch (error) {
    redirectWithOrderMessage(orderId, 'error', formatApiError(error));
  }
}

export async function assignDeliveryAction(formData: FormData): Promise<void> {
  const orderId = requireFormValue(formData, 'orderId');
  const deliveryPartnerUserId = requireFormValue(formData, 'deliveryPartnerUserId');
  const reason = optionalFormValue(formData, 'reason');
  const input: AssignDeliveryInput = {
    deliveryPartnerUserId,
    ...(reason ? { reason } : {}),
  };

  try {
    const result = await assignFulfilmentOrderDelivery(orderId, input);
    revalidateOrderPaths(orderId);
    const mockOtpCode = result.deliveryAssignment?.mockOtpCode;
    redirectWithOrderMessage(
      orderId,
      'notice',
      mockOtpCode ? `Delivery assigned. Mock OTP: ${mockOtpCode}` : 'Delivery assigned',
    );
  } catch (error) {
    redirectWithOrderMessage(orderId, 'error', formatApiError(error));
  }
}

export async function markOutForDeliveryAction(formData: FormData): Promise<void> {
  const orderId = requireFormValue(formData, 'orderId');
  const reason = optionalFormValue(formData, 'reason');
  const input: FulfilmentOrderDecisionInput = {
    ...(reason ? { reason } : {}),
  };

  try {
    await markFulfilmentOrderOutForDelivery(orderId, input);
    revalidateOrderPaths(orderId);
    redirectWithOrderMessage(orderId, 'notice', 'Order moved out for delivery');
  } catch (error) {
    redirectWithOrderMessage(orderId, 'error', formatApiError(error));
  }
}

export async function completeDeliveryAction(formData: FormData): Promise<void> {
  const orderId = requireFormValue(formData, 'orderId');
  const otpCode = requireFormValue(formData, 'otpCode');
  const proofNote = optionalFormValue(formData, 'proofNote');
  const input: CompleteDeliveryInput = {
    otpCode,
    proofLocationStatus: 'UNAVAILABLE',
    ...(proofNote ? { proofNote } : {}),
  };

  try {
    await completeFulfilmentOrderDelivery(orderId, input);
    revalidateOrderPaths(orderId);
    redirectWithOrderMessage(orderId, 'notice', 'Delivery completed');
  } catch (error) {
    redirectWithOrderMessage(orderId, 'error', formatApiError(error));
  }
}

function revalidateOrderPaths(orderId: string): void {
  revalidatePath('/orders');
  revalidatePath('/audit');
  revalidatePath(`/orders/${orderId}`);
}

function requireFormValue(formData: FormData, key: string): string {
  const value = optionalFormValue(formData, key);
  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function optionalFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function redirectWithOrderMessage(
  orderId: string,
  type: 'notice' | 'error',
  message: string,
): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/orders/${orderId}?${params.toString()}`);
}
