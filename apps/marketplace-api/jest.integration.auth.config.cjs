/**
 * The one integration spec that needs `AUTH_MODE=production`. See the note in
 * `jest.integration.config.cjs` for why this is a separate invocation rather
 * than a Jest project.
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
  testMatch: ['<rootDir>/test/integration/phase1d-authentication.spec.ts'],
  setupFiles: ['<rootDir>/test/integration/env/production-auth.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/integration/setup.ts'],
};
