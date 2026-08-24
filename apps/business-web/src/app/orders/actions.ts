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
  issueDispatchPackageLabel,
  markFulfilmentOrderOutForDelivery,
  markFulfilmentOrderReadyToPack,
  markFulfilmentOrderReadyForPickup,
  packFulfilmentOrder,
  requestFulfilmentInvoicePdf,
  rejectFulfilmentOrder,
} from '../../lib/marketplace-api';
import { requireHttpDownloadUrl } from '../../lib/document-download';
import { writeOrderHandoffCredentials } from '../../lib/order-handoff';

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
    // The farmer OTP is returned once and stored only as a hash. It goes to the
    // handoff panel instead of a banner the tester loses on the next click.
    const mockOtpCode = result.deliveryAssignment?.mockOtpCode;
    if (mockOtpCode) {
      await writeOrderHandoffCredentials(orderId, { deliveryOtp: mockOtpCode });
    }
    redirectWithOrderMessage(orderId, 'notice', 'Delivery assigned');
  } catch (error) {
    redirectWithOrderMessage(orderId, 'error', formatApiError(error));
  }
}

export async function issuePickupCodeAction(formData: FormData): Promise<void> {
  const orderId = requireFormValue(formData, 'orderId');
  const reason = optionalFormValue(formData, 'reason');
  const input: FulfilmentOrderDecisionInput = {
    ...(reason ? { reason } : {}),
  };

  try {
    const result = await issueDispatchPackageLabel(orderId, input);
    revalidateOrderPaths(orderId);
    // Only the hash of this code is persisted, so this response is the single
    // opportunity to show it. Reissuing is allowed until pickup is verified.
    await writeOrderHandoffCredentials(orderId, { pickupCode: result.packageQrCode });
    redirectWithOrderMessage(orderId, 'notice', 'Pickup code issued');
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
