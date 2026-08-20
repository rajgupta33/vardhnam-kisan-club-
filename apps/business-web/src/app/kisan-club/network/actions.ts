'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type {
  CreatePromoterTerritoryInput,
  PromoterTerritoryStatus,
  UpsertKisanClubPromoterProfileInput,
} from '@vardhnam/api-client';
import {
  createPromoterTerritory,
  formatApiError,
  updatePromoterTerritory,
  upsertKisanClubPromoterProfile,
} from '../../../lib/marketplace-api';
import { parseWholeNumberInput } from '../../../lib/whole-number-input';

export async function createTerritoryAction(formData: FormData): Promise<void> {
  try {
    await createPromoterTerritory(readTerritoryInput(formData));
  } catch (error) {
    redirectWithMessage('error', formatApiError(error));
  }
  revalidateNetwork();
  redirectWithMessage('notice', 'Promoter territory created');
}

export async function updateTerritoryAction(formData: FormData): Promise<void> {
  const territoryId = requireValue(formData, 'territoryId');
  try {
    await updatePromoterTerritory(territoryId, readTerritoryInput(formData));
  } catch (error) {
    redirectWithMessage('error', formatApiError(error));
  }
  revalidateNetwork();
  redirectWithMessage('notice', 'Promoter territory updated');
}

export async function upsertPromoterProfileAction(formData: FormData): Promise<void> {
  try {
    const territoryId = optionalValue(formData, 'territoryId');
    const homeVillage = optionalValue(formData, 'homeVillage');
    const homePincode = optionalValue(formData, 'homePincode');
    const input: UpsertKisanClubPromoterProfileInput = {
      promoterUserId: requireValue(formData, 'promoterUserId'),
      promoterOrganisationId: requireValue(formData, 'promoterOrganisationId'),
      ...(territoryId ? { territoryId } : {}),
      ...(homeVillage ? { homeVillage } : {}),
      ...(homePincode ? { homePincode } : {}),
      clubEnabled: checked(formData, 'clubEnabled'),
      acceptingNewFarmers: checked(formData, 'acceptingNewFarmers'),
      maxActiveFarmers: requireInteger(formData, 'maxActiveFarmers', 1, 10_000),
    };
    await upsertKisanClubPromoterProfile(input);
  } catch (error) {
    redirectWithMessage('error', formatApiError(error));
  }
  revalidateNetwork();
  redirectWithMessage('notice', 'Club promoter profile saved');
}

function readTerritoryInput(formData: FormData): CreatePromoterTerritoryInput {
  return {
    name: requireValue(formData, 'name'),
    state: requireValue(formData, 'state'),
    district: requireValue(formData, 'district'),
    blocks: csv(formData, 'blocks'),
    pincodes: csv(formData, 'pincodes'),
    villages: csv(formData, 'villages'),
    status: requireValue(formData, 'status') as PromoterTerritoryStatus,
  };
}

function csv(formData: FormData, key: string): string[] {
  return (optionalValue(formData, key) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function requireInteger(formData: FormData, key: string, min: number, max: number): number {
  const value = parseWholeNumberInput(optionalValue(formData, key), {
    fieldName: key,
    min,
    max,
  });
  if (value === undefined) throw new Error(`${key} is required`);
  return value;
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on';
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

function revalidateNetwork(): void {
  revalidatePath('/kisan-club/network');
  revalidatePath('/kisan-club');
  revalidatePath('/audit');
}

function redirectWithMessage(type: 'notice' | 'error', message: string): never {
  redirect(`/kisan-club/network?${new URLSearchParams({ [type]: message }).toString()}`);
}
