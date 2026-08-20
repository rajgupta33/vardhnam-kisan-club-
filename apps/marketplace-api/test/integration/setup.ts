// Prefer a dedicated test database when one is configured. CI instead points
// DATABASE_URL straight at `vardhnam_agrotech_test`, so both routes are valid --
// what matters is that the resulting database is a throwaway, because
// `resetIntegrationDatabase()` truncates every table in it.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Fail here, with an actionable message, rather than part-way through the first
// spec. Running this suite against a development database would destroy it, so
// the reset helper refuses -- but by then the failure looks like a broken test
// instead of a missing environment variable.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.toLowerCase().includes('test')) {
  throw new Error(
    'Integration tests need a dedicated test database. Set TEST_DATABASE_URL (or point ' +
      'DATABASE_URL) at a database whose name contains "test", e.g. ' +
      'postgresql://vardhnam:vardhnam_dev_password@localhost:5432/vardhnam_agrotech_test?schema=public',
  );
}

process.env.KISAN_CLUB_ENABLED = 'true';
jest.setTimeout(30_000);

beforeAll(async () => {
  const { resetIntegrationDatabase } = await import('./helpers/database-isolation');
  await resetIntegrationDatabase();
});
