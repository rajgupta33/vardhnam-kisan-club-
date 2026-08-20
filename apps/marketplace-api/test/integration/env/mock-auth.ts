// Jest `setupFiles` run before the test file module is evaluated, which is the
// only point early enough to influence `ConfigModule.forRoot()` -- that runs
// synchronously when a spec imports `app.module.ts`. Assigning AUTH_MODE inside
// a spec file would be too late, because import statements are hoisted above it.
//
// Every integration spec except `phase1d-authentication.spec.ts` authenticates
// with mock identity headers and therefore needs `AUTH_MODE=mock`. The auth spec
// needs the opposite and runs as its own Jest project -- see
// `jest.integration.config.cjs`.
process.env.AUTH_MODE = 'mock';
