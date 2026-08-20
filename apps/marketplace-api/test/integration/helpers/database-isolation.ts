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
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE table_record RECORD;
    BEGIN
      FOR table_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
      LOOP
        EXECUTE 'TRUNCATE TABLE "'
          || replace(table_record.tablename, '"', '""')
          || '" RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);

  // The truncation above also removes reference data that production gets from
  // migration INSERTs. Prisma will not re-run an applied migration, so restoring
  // it here is the counterpart of the reset -- see seed-reference-data.ts.
  await seedReferenceData(prisma);
}
