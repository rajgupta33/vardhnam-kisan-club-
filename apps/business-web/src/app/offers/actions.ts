'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  OfferReviewDecision,
  OfferStatusOperationInput,
  ReviewOfferInput,
} from '@vardhnam/api-client';
import {
  archiveOffer,
  createBusinessApiClient,
  formatApiError,
  pauseOffer,
  reactivateOffer,
} from '../../lib/marketplace-api';

export async function reviewOfferAction(formData: FormData): Promise<void> {
  const offerId = requireFormValue(formData, 'offerId');
  const decision = requireFormValue(formData, 'decision') as OfferReviewDecision;
  const reason = optionalFormValue(formData, 'reason');
  const { client, config } = await createBusinessApiClient();

  if (!client) {
    redirectWithOfferMessage(offerId, 'error', `Missing ${config.missingVariables.join(', ')}`);
  }

  const input: ReviewOfferInput = {
    decision,
    ...(reason ? { reason } : {}),
  };

  try {
    await client.reviewOffer(offerId, input);
    revalidatePath('/offers');
    revalidatePath('/audit');
    revalidatePath(`/offers/${offerId}`);
    redirectWithOfferMessage(
      offerId,
      'notice',
      decision === 'APPROVE' ? 'Offer approved' : 'Offer rejected',
    );
  } catch (error) {
    redirectWithOfferMessage(offerId, 'error', formatApiError(error));
  }
}

export async function pauseOfferAction(formData: FormData): Promise<void> {
  const offerId = requireFormValue(formData, 'offerId');
  const input = offerStatusInput(formData);

  try {
    await pauseOffer(offerId, input);
    revalidateOfferPaths(offerId);
    redirectWithOfferMessage(offerId, 'notice', 'Offer paused');
  } catch (error) {
    redirectWithOfferMessage(offerId, 'error', formatApiError(error));
  }
}

export async function reactivateOfferAction(formData: FormData): Promise<void> {
  const offerId = requireFormValue(formData, 'offerId');
  const input = offerStatusInput(formData);

  try {
    await reactivateOffer(offerId, input);
    revalidateOfferPaths(offerId);
    redirectWithOfferMessage(offerId, 'notice', 'Offer reactivated');
  } catch (error) {
    redirectWithOfferMessage(offerId, 'error', formatApiError(error));
  }
}

export async function archiveOfferAction(formData: FormData): Promise<void> {
  const offerId = requireFormValue(formData, 'offerId');
  const input = offerStatusInput(formData);

  try {
    await archiveOffer(offerId, input);
    revalidateOfferPaths(offerId);
    redirectWithOfferMessage(offerId, 'notice', 'Offer archived');
  } catch (error) {
    redirectWithOfferMessage(offerId, 'error', formatApiError(error));
  }
}

function offerStatusInput(formData: FormData): OfferStatusOperationInput {
  return {
    reason: requireFormValue(formData, 'reason'),
  };
}

function revalidateOfferPaths(offerId: string): void {
  revalidatePath('/offers');
  revalidatePath('/audit');
  revalidatePath(`/offers/${offerId}`);
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

function redirectWithOfferMessage(
  offerId: string,
  type: 'notice' | 'error',
  message: string,
): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/offers/${offerId}?${params.toString()}`);
}
