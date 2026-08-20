'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  AdvisoryCategory,
  CreateAdvisoryRuleInput,
  UpdateAdvisoryRuleInput,
} from '@vardhnam/api-client';
import { createBusinessApiClient, formatApiError } from '../../lib/marketplace-api';
import { parseWholeNumberInput } from '../../lib/whole-number-input';

export async function createAdvisoryRuleAction(formData: FormData): Promise<void> {
  const { client, config } = await createBusinessApiClient();
  if (!client) redirectWithListMessage('error', `Missing ${config.missingVariables.join(', ')}`);

  try {
    const rule = await client.createAdvisoryRule(readRuleInput(formData));
    revalidateAdvisory(rule.id);
    redirectWithRuleMessage(rule.id, 'notice', 'Advisory draft created');
  } catch (error) {
    redirectWithListMessage('error', formatApiError(error));
  }
}

export async function updateAdvisoryRuleAction(formData: FormData): Promise<void> {
  const ruleId = requireFormValue(formData, 'ruleId');
  const { client, config } = await createBusinessApiClient();
  if (!client) redirectWithRuleMessage(ruleId, 'error', `Missing ${config.missingVariables.join(', ')}`);

  try {
    const input: UpdateAdvisoryRuleInput = readRuleInput(formData);
    const rule = await client.updateAdvisoryRule(ruleId, input);
    revalidateAdvisory(rule.id);
    redirectWithRuleMessage(rule.id, 'notice', 'Advisory draft updated');
  } catch (error) {
    redirectWithRuleMessage(ruleId, 'error', formatApiError(error));
  }
}

export async function submitAdvisoryRuleAction(formData: FormData): Promise<void> {
  const ruleId = requireFormValue(formData, 'ruleId');
  const reason = requireFormValue(formData, 'reason');
  const { client, config } = await createBusinessApiClient();
  if (!client) redirectWithRuleMessage(ruleId, 'error', `Missing ${config.missingVariables.join(', ')}`);

  try {
    await client.submitAdvisoryRule(ruleId, reason);
    revalidateAdvisory(ruleId);
    redirectWithRuleMessage(ruleId, 'notice', 'Advisory submitted for independent review');
  } catch (error) {
    redirectWithRuleMessage(ruleId, 'error', formatApiError(error));
  }
}

export async function reviewAdvisoryRuleAction(formData: FormData): Promise<void> {
  const ruleId = requireFormValue(formData, 'ruleId');
  const approved = requireFormValue(formData, 'decision') === 'APPROVE';
  const reason = optionalFormValue(formData, 'reason');
  const { client, config } = await createBusinessApiClient();
  if (!client) redirectWithRuleMessage(ruleId, 'error', `Missing ${config.missingVariables.join(', ')}`);

  try {
    await client.reviewAdvisoryRule(ruleId, { approved, ...(reason ? { reason } : {}) });
    revalidateAdvisory(ruleId);
    redirectWithRuleMessage(ruleId, 'notice', approved ? 'Advisory approved' : 'Advisory rejected');
  } catch (error) {
    redirectWithRuleMessage(ruleId, 'error', formatApiError(error));
  }
}

export async function archiveAdvisoryRuleAction(formData: FormData): Promise<void> {
  const ruleId = requireFormValue(formData, 'ruleId');
  const reason = requireFormValue(formData, 'reason');
  const { client, config } = await createBusinessApiClient();
  if (!client) redirectWithRuleMessage(ruleId, 'error', `Missing ${config.missingVariables.join(', ')}`);

  try {
    await client.archiveAdvisoryRule(ruleId, reason);
    revalidateAdvisory(ruleId);
    redirectWithRuleMessage(ruleId, 'notice', 'Advisory archived');
  } catch (error) {
    redirectWithRuleMessage(ruleId, 'error', formatApiError(error));
  }
}

function readRuleInput(formData: FormData): CreateAdvisoryRuleInput {
  const varietyName = optionalFormValue(formData, 'varietyName');
  const sourceReference = optionalFormValue(formData, 'sourceReference');
  return {
    cropName: requireFormValue(formData, 'cropName'),
    ...(varietyName ? { varietyName } : {}),
    category: requireFormValue(formData, 'category') as AdvisoryCategory,
    minDaysAfterSowing: requireInteger(formData, 'minDaysAfterSowing', 0, 1000),
    maxDaysAfterSowing: requireInteger(formData, 'maxDaysAfterSowing', 0, 1000),
    eligibleStates: readCsv(formData, 'eligibleStates'),
    eligibleDistricts: readCsv(formData, 'eligibleDistricts'),
    seasons: readCsv(formData, 'seasons'),
    titleEn: requireFormValue(formData, 'titleEn'),
    bodyEn: requireFormValue(formData, 'bodyEn'),
    titleHi: requireFormValue(formData, 'titleHi'),
    bodyHi: requireFormValue(formData, 'bodyHi'),
    ...(sourceReference ? { sourceReference } : {}),
    reason: requireFormValue(formData, 'reason'),
  };
}

function requireInteger(formData: FormData, key: string, min: number, max: number): number {
  const value = parseWholeNumberInput(optionalFormValue(formData, key), {
    fieldName: key,
    min,
    max,
  });
  if (value === undefined) throw new Error(`${key} is required`);
  return value;
}

function readCsv(formData: FormData, key: string): string[] {
  return (optionalFormValue(formData, key) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function requireFormValue(formData: FormData, key: string): string {
  const value = optionalFormValue(formData, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function optionalFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function revalidateAdvisory(ruleId: string): void {
  revalidatePath('/advisory');
  revalidatePath(`/advisory/${ruleId}`);
  revalidatePath('/audit');
}

function redirectWithListMessage(type: 'notice' | 'error', message: string): never {
  redirect(`/advisory?${new URLSearchParams({ [type]: message }).toString()}`);
}

function redirectWithRuleMessage(
  ruleId: string,
  type: 'notice' | 'error',
  message: string,
): never {
  redirect(`/advisory/${ruleId}?${new URLSearchParams({ [type]: message }).toString()}`);
}
