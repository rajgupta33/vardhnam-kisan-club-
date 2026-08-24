import { PrismaClient } from '@prisma/client';
import { seedReferenceData } from './seed-reference-data';

const prisma = new PrismaClient();

export async function resetIntegrationDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !new URL(databaseUrl).pathname.toLowerCase().includes('test')) {
    throw new Error(
      'Integration database reset refused: DATABASE_URL must name a dedicated test database. ' +
        'Set TEST_DATABASE_URL to a database whose name contains "test" before running the suite.',
    );
  }
  await prisma.$connect();
  // One TRUNCATE naming every table, rather than one statement per table. This
  // hook runs before all 35 spec files, and a per-table loop takes and releases
  // an ACCESS EXCLUSIVE lock on each of the ~150 tables in turn -- slow enough
  // on a loaded machine to blow the 30s hook timeout intermittently. Naming them
  // together locks and scans once.
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;
  if (tables.length > 0) {
    const quoted = tables
      .map(({ tablename }) => `"${tablename.replace(/"/g, '""')}"`)
      .join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  }

  // The truncation above also removes reference data that production gets from
  // migration INSERTs. Prisma will not re-run an applied migration, so restoring
  // it here is the counterpart of the reset -- see seed-reference-data.ts.
  await seedReferenceData(prisma);
}
