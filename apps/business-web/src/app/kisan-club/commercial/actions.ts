'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  CreateKisanClubBenefitRuleInput,
  CreateKisanClubProgrammeInput,
  KisanClubBenefitStatus,
  KisanClubBenefitType,
  KisanClubProgrammeStatus,
  UpdateKisanClubBenefitRuleInput,
  UpdateKisanClubProgrammeInput,
} from '@vardhnam/api-client';
import {
  createKisanClubBenefitRule,
  createKisanClubProgramme,
  formatApiError,
  updateKisanClubBenefitRule,
  updateKisanClubProgramme,
} from '../../../lib/marketplace-api';
import { parseWholeNumberInput } from '../../../lib/whole-number-input';

export async function createProgrammeAction(formData: FormData): Promise<void> {
  try {
    await createKisanClubProgramme(readProgrammeCreate(formData));
  } catch (error) {
    fail(error);
  }
  finish('Club programme draft created');
}

export async function updateProgrammeAction(formData: FormData): Promise<void> {
  const programmeId = requireValue(formData, 'programmeId');
  try {
    const endsAt = optionalValue(formData, 'endsAt');
    const input: UpdateKisanClubProgrammeInput = {
      status: requireValue(formData, 'status') as KisanClubProgrammeStatus,
      startsAt: requireValue(formData, 'startsAt'),
      ...(endsAt ? { endsAt } : {}),
      eligiblePincodes: csv(formData, 'eligiblePincodes'),
      eligibleDistricts: csv(formData, 'eligibleDistricts'),
      displayPriority: requireInteger(formData, 'displayPriority', { min: -10_000, max: 10_000 }),
      reason: requireValue(formData, 'reason'),
    };
    await updateKisanClubProgramme(programmeId, input);
  } catch (error) {
    fail(error);
  }
  finish('Club programme updated');
}

export async function createBenefitRuleAction(formData: FormData): Promise<void> {
  try {
    await createKisanClubBenefitRule(readBenefitCreate(formData));
  } catch (error) {
    fail(error);
  }
  finish('Benefit rule draft created');
}

export async function updateBenefitRuleAction(formData: FormData): Promise<void> {
  const ruleId = requireValue(formData, 'ruleId');
  try {
    const economicEditable = formData.get('economicEditable') === 'true';
    const input: UpdateKisanClubBenefitRuleInput = {
      status: requireValue(formData, 'status') as KisanClubBenefitStatus,
      reason: requireValue(formData, 'reason'),
      ...(economicEditable ? readBenefitEconomicFields(formData) : {}),
    };
    await updateKisanClubBenefitRule(ruleId, input);
  } catch (error) {
    fail(error);
  }
  finish('Benefit rule updated');
}

function readProgrammeCreate(formData: FormData): CreateKisanClubProgrammeInput {
  const variantId = optionalValue(formData, 'variantId');
  const endsAt = optionalValue(formData, 'endsAt');
  return {
    productId: requireValue(formData, 'productId'),
    ...(variantId ? { variantId } : {}),
    startsAt: requireValue(formData, 'startsAt'),
    ...(endsAt ? { endsAt } : {}),
    eligiblePincodes: csv(formData, 'eligiblePincodes'),
    eligibleDistricts: csv(formData, 'eligibleDistricts'),
    displayPriority: requireInteger(formData, 'displayPriority', { min: -10_000, max: 10_000 }),
    reason: requireValue(formData, 'reason'),
  };
}

function readBenefitCreate(formData: FormData): CreateKisanClubBenefitRuleInput {
  return {
    programmeId: requireValue(formData, 'programmeId'),
    ...readBenefitEconomicFields(formData),
    reason: requireValue(formData, 'reason'),
  };
}

function readBenefitEconomicFields(
  formData: FormData,
): Omit<CreateKisanClubBenefitRuleInput, 'programmeId' | 'reason'> {
  const endsAt = optionalValue(formData, 'endsAt');
  const flatAmountPaise = optionalInteger(formData, 'flatAmountPaise', { min: 1 });
  const percentBps = optionalInteger(formData, 'percentBps', { min: 1, max: 10_000 });
  const maxBenefitPaise = optionalInteger(formData, 'maxBenefitPaise', { min: 1 });
  const totalUsageLimit = optionalInteger(formData, 'totalUsageLimit', { min: 1 });
  const perMemberUsageLimit = optionalInteger(formData, 'perMemberUsageLimit', { min: 1 });
  return {
    benefitType: requireValue(formData, 'benefitType') as KisanClubBenefitType,
    ...(flatAmountPaise !== undefined ? { flatAmountPaise } : {}),
    ...(percentBps !== undefined ? { percentBps } : {}),
    ...(maxBenefitPaise !== undefined ? { maxBenefitPaise } : {}),
    minimumQuantity: requireInteger(formData, 'minimumQuantity', { min: 1 }),
    eligiblePincodes: csv(formData, 'eligiblePincodes'),
    eligibleCropIds: csv(formData, 'eligibleCropIds'),
    startsAt: requireValue(formData, 'startsAt'),
    ...(endsAt ? { endsAt } : {}),
    ...(totalUsageLimit !== undefined ? { totalUsageLimit } : {}),
    ...(perMemberUsageLimit !== undefined ? { perMemberUsageLimit } : {}),
  };
}

function csv(formData: FormData, key: string): string[] {
  return (optionalValue(formData, key) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function requireInteger(
  formData: FormData,
  key: string,
  bounds: { min?: number; max?: number } = {},
): number {
  const value = optionalInteger(formData, key, bounds);
  if (value === undefined) throw new Error(`${key} is required`);
  return value;
}

function optionalInteger(
  formData: FormData,
  key: string,
  bounds: { min?: number; max?: number } = {},
): number | undefined {
  const text = optionalValue(formData, key);
  return parseWholeNumberInput(text, { fieldName: key, ...bounds });
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

function revalidateCommercial(): void {
  revalidatePath('/kisan-club/commercial');
  revalidatePath('/kisan-club');
  revalidatePath('/audit');
}

function finish(message: string): never {
  revalidateCommercial();
  redirect(`/kisan-club/commercial?${new URLSearchParams({ notice: message }).toString()}`);
}

function fail(error: unknown): never {
  redirect(
    `/kisan-club/commercial?${new URLSearchParams({ error: formatApiError(error) }).toString()}`,
  );
}
