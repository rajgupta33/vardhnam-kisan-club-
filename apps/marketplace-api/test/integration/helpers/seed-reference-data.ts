import type { PrismaClient } from '@prisma/client';

/**
 * Reference data that production receives from a migration INSERT rather than
 * from application code.
 *
 * `resetIntegrationDatabase()` truncates every table except `_prisma_migrations`.
 * Because the migration is already recorded as applied, Prisma will never re-run
 * it, so any reference rows it inserted are gone for the rest of the run. Every
 * spec that reads them then fails with a confusing "undefined" rather than an
 * obvious "your fixture is missing".
 *
 * This module restores that data after truncation. Keep it in step with the
 * migrations listed against each block — if you add reference data in a new
 * migration, add it here in the same change or the integration suite will start
 * failing the moment a spec touches it.
 */

/** Source: `prisma/migrations/20260811210000_add_farm_crop_registry/migration.sql`. */
const cropVocabulary: ReadonlyArray<{ code: string; nameEn: string; nameHi: string }> = [
  { code: 'WHEAT', nameEn: 'Wheat', nameHi: 'गेहूँ' },
  { code: 'RICE', nameEn: 'Rice', nameHi: 'धान' },
  { code: 'MUSTARD', nameEn: 'Mustard', nameHi: 'सरसों' },
  { code: 'POTATO', nameEn: 'Potato', nameHi: 'आलू' },
  { code: 'SUGARCANE', nameEn: 'Sugarcane', nameHi: 'गन्ना' },
  { code: 'MAIZE', nameEn: 'Maize', nameHi: 'मक्का' },
];

export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
  for (const crop of cropVocabulary) {
    await prisma.crop.upsert({
      where: { code: crop.code },
      create: crop,
      update: { nameEn: crop.nameEn, nameHi: crop.nameHi, isActive: true },
    });
  }
}
