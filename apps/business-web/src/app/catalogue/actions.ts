'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { CatalogueReviewDecision, ReviewCatalogueInput } from '@vardhnam/api-client';
import { createBusinessApiClient, formatApiError } from '../../lib/marketplace-api';

export async function reviewBrandAction(formData: FormData): Promise<void> {
  const brandId = requireFormValue(formData, 'brandId');
  const decision = requireFormValue(formData, 'decision') as CatalogueReviewDecision;
  const reason = optionalFormValue(formData, 'reason');
  const { client, config } = await createBusinessApiClient();

  if (!client) {
    redirectWithCatalogueMessage('error', `Missing ${config.missingVariables.join(', ')}`);
  }

  const input: ReviewCatalogueInput = {
    decision,
    ...(reason ? { reason } : {}),
  };

  try {
    await client.reviewBrand(brandId, input);
    revalidatePath('/catalogue');
    revalidatePath('/audit');
    redirectWithCatalogueMessage(
      'notice',
      decision === 'APPROVE' ? 'Brand approved' : 'Brand rejected',
    );
  } catch (error) {
    redirectWithCatalogueMessage('error', formatApiError(error));
  }
}

export async function reviewProductAction(formData: FormData): Promise<void> {
  const productId = requireFormValue(formData, 'productId');
  const decision = requireFormValue(formData, 'decision') as CatalogueReviewDecision;
  const reason = optionalFormValue(formData, 'reason');
  const { client, config } = await createBusinessApiClient();

  if (!client) {
    redirectWithProductMessage(productId, 'error', `Missing ${config.missingVariables.join(', ')}`);
  }

  const input: ReviewCatalogueInput = {
    decision,
    ...(reason ? { reason } : {}),
  };

  try {
    await client.reviewProduct(productId, input);
    revalidatePath('/catalogue');
    revalidatePath('/audit');
    revalidatePath(`/catalogue/products/${productId}`);
    redirectWithProductMessage(
      productId,
      'notice',
      decision === 'APPROVE' ? 'Product approved' : 'Product rejected',
    );
  } catch (error) {
    redirectWithProductMessage(productId, 'error', formatApiError(error));
  }
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

function redirectWithCatalogueMessage(type: 'notice' | 'error', message: string): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/catalogue?${params.toString()}`);
}

function redirectWithProductMessage(
  productId: string,
  type: 'notice' | 'error',
  message: string,
): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/catalogue/products/${productId}?${params.toString()}`);
}
