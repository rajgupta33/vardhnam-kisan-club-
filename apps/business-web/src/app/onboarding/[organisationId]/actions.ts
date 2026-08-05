'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  KycDocumentStatus,
  OrganisationReviewDecision,
  ReviewKycDocumentInput,
} from '@vardhnam/api-client';
import { createBusinessApiClient, formatApiError } from '../../../lib/marketplace-api';

export async function reviewOrganisationAction(formData: FormData): Promise<void> {
  const organisationId = requireFormValue(formData, 'organisationId');
  const decision = requireFormValue(formData, 'decision') as OrganisationReviewDecision;
  const reason = optionalFormValue(formData, 'reason');
  const { client, config } = createBusinessApiClient();

  if (!client) {
    redirectWithMessage(organisationId, 'error', `Missing ${config.missingVariables.join(', ')}`);
  }

  try {
    await client.reviewOrganisation(organisationId, {
      decision,
      ...(reason ? { reason } : {}),
    });
    revalidatePath('/');
    revalidatePath('/audit');
    revalidatePath(`/onboarding/${organisationId}`);
    redirectWithMessage(
      organisationId,
      'notice',
      decision === 'APPROVE' ? 'Organisation approved' : 'Organisation rejected',
    );
  } catch (error) {
    redirectWithMessage(organisationId, 'error', formatApiError(error));
  }
}

export async function reviewKycDocumentAction(formData: FormData): Promise<void> {
  const organisationId = requireFormValue(formData, 'organisationId');
  const documentId = requireFormValue(formData, 'documentId');
  const status = requireFormValue(formData, 'status') as KycDocumentStatus;
  const reason = optionalFormValue(formData, 'reason');
  const rejectionReason = optionalFormValue(formData, 'rejectionReason');
  const { client, config } = createBusinessApiClient();

  if (!client) {
    redirectWithMessage(organisationId, 'error', `Missing ${config.missingVariables.join(', ')}`);
  }

  const input: ReviewKycDocumentInput = { status };
  if (reason) {
    input.reason = reason;
  }
  if (status === 'REJECTED') {
    input.rejectionReason = rejectionReason ?? reason ?? 'Rejected during onboarding review';
  }

  try {
    await client.updateKycDocument(organisationId, documentId, input);
    revalidatePath('/');
    revalidatePath('/audit');
    revalidatePath(`/onboarding/${organisationId}`);
    redirectWithMessage(organisationId, 'notice', `KYC metadata marked ${status.toLowerCase()}`);
  } catch (error) {
    redirectWithMessage(organisationId, 'error', formatApiError(error));
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

function redirectWithMessage(
  organisationId: string,
  type: 'notice' | 'error',
  message: string,
): never {
  const params = new URLSearchParams({ [type]: message });
  redirect(`/onboarding/${organisationId}?${params.toString()}`);
}
