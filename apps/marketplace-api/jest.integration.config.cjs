/**
 * Integration specs that authenticate with mock identity headers -- everything
 * except `phase1d-authentication.spec.ts`, which exercises the real JWT bearer
 * path and needs `AUTH_MODE=production` (see `jest.integration.auth.config.cjs`).
 *
 * The two groups run as separate sequential Jest invocations rather than as Jest
 * `projects`, because projects share one run but not one worker queue: they
 * execute concurrently, and both groups reset the same database, so specs
 * truncate each other's fixtures mid-test. `npm run test:integration` chains
 * them so a single command still runs everything.
 *
 * `maxWorkers: 1` is required within a group for the same reason.
 */

/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  maxWorkers: 1,
  testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
  testPathIgnorePatterns: ['<rootDir>/test/integration/phase1d-authentication.spec.ts'],
  setupFiles: ['<rootDir>/test/integration/env/mock-auth.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/integration/setup.ts'],
};
