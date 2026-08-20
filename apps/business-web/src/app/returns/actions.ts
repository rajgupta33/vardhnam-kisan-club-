'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  ReturnTransitionInput,
} from '@vardhnam/api-client';
import {
  approveReturnRequest,
  assignReturnPickup,
  confirmMockRefund,
  createRefund,
  downloadCreditNote,
  formatApiError,
  inspectReturnRequest,
  markReturnInTransit,
  receiveReturnRequest,
  rejectReturnRequest,
} from '../../lib/marketplace-api';
import { requireHttpDownloadUrl } from '../../lib/document-download';
import { parseReturnInspectionDispositions } from '../../lib/return-inspection-input';

export async function approveReturnAction(formData: FormData): Promise<void> {
  await runAction(formData, 'Return approved', approveReturnRequest);
}

export async function rejectReturnAction(formData: FormData): Promise<void> {
  const reason = requireValue(formData, 'reason');
  await runAction(formData, 'Return rejected', rejectReturnRequest, { reason });
}

export async function pickupReturnAction(formData: FormData): Promise<void> {
  await runAction(formData, 'Return pickup recorded', markReturnInTransit);
}

export async function assignReturnPickupAction(formData: FormData): Promise<void> {
  const id = requireValue(formData, 'returnRequestId');
  const deliveryPartnerUserId = requireValue(formData, 'deliveryPartnerUserId');
  const reason = optionalValue(formData, 'reason');
  try {
    await assignReturnPickup(id, {
      deliveryPartnerUserId,
      ...(reason ? { reason } : {}),
    });
    revalidatePath('/returns');
    revalidatePath(`/returns/${id}`);
    revalidatePath('/audit');
    redirect(`/returns/${id}?notice=${encodeURIComponent('Return pickup assigned')}`);
  } catch (error) {
    redirect(`/returns/${id}?error=${encodeURIComponent(formatApiError(error))}`);
  }
}

export async function receiveReturnAction(formData: FormData): Promise<void> {
  await runAction(formData, 'Returned goods received', receiveReturnRequest);
}

export async function inspectReturnAction(formData: FormData): Promise<void> {
  const id = requireValue(formData, 'returnRequestId');
  const inspectionNote = requireValue(formData, 'inspectionNote');
  try {
    const dispositions = parseReturnInspectionDispositions(formData.entries());
    await inspectReturnRequest(id, { inspectionNote, dispositions });
    revalidatePath('/returns');
    revalidatePath(`/returns/${id}`);
    revalidatePath('/inventory');
    revalidatePath('/audit');
    redirect(`/returns/${id}?notice=${encodeURIComponent('Return inspection recorded')}`);
  } catch (error) {
    redirect(`/returns/${id}?error=${encodeURIComponent(formatApiError(error))}`);
  }
}

export async function createRefundAction(formData: FormData): Promise<void> {
  const id = requireValue(formData, 'returnRequestId');
  try {
    await createRefund({ returnRequestId: id }, `portal-refund-create:${id}`);
    revalidateRefundPaths(id);
    redirect(`/returns/${id}?notice=${encodeURIComponent('Refund initiated')}`);
  } catch (error) {
    redirect(`/returns/${id}?error=${encodeURIComponent(formatApiError(error))}`);
  }
}

export async function confirmRefundAction(formData: FormData): Promise<void> {
  const id = requireValue(formData, 'returnRequestId');
  const refundId = requireValue(formData, 'refundId');
  try {
    await confirmMockRefund(
      refundId,
      { outcome: 'SUCCEEDED' },
      `portal-refund-success:${refundId}`,
    );
    revalidateRefundPaths(id);
    redirect(`/returns/${id}?notice=${encodeURIComponent('Mock refund completed')}`);
  } catch (error) {
    redirect(`/returns/${id}?error=${encodeURIComponent(formatApiError(error))}`);
  }
}

export async function downloadCreditNoteAction(formData: FormData): Promise<void> {
  const returnRequestId = requireValue(formData, 'returnRequestId');
  const refundId = requireValue(formData, 'refundId');
  let downloadUrl: string;
  try {
    const download = await downloadCreditNote(refundId);
    downloadUrl = requireHttpDownloadUrl(download.downloadUrl);
  } catch (error) {
    redirect(`/returns/${returnRequestId}?error=${encodeURIComponent(formatApiError(error))}`);
  }
  redirect(downloadUrl);
}

function revalidateRefundPaths(returnRequestId: string): void {
  revalidatePath('/returns');
  revalidatePath(`/returns/${returnRequestId}`);
  revalidatePath('/orders');
  revalidatePath('/finance');
  revalidatePath('/finance/ledger');
  revalidatePath('/finance/commissions');
  revalidatePath('/audit');
}

async function runAction(
  formData: FormData,
  notice: string,
  operation: (id: string, input: ReturnTransitionInput) => Promise<unknown>,
  forcedInput?: ReturnTransitionInput,
): Promise<never> {
  const id = requireValue(formData, 'returnRequestId');
  const reason = optionalValue(formData, 'reason');
  const input = forcedInput ?? (reason ? { reason } : {});
  try {
    await operation(id, input);
    revalidatePath('/returns');
    revalidatePath(`/returns/${id}`);
    revalidatePath('/orders');
    revalidatePath('/audit');
    redirect(`/returns/${id}?notice=${encodeURIComponent(notice)}`);
  } catch (error) {
    redirect(`/returns/${id}?error=${encodeURIComponent(formatApiError(error))}`);
  }
}

function requireValue(formData: FormData, key: string): string {
  const value = optionalValue(formData, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function optionalValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
