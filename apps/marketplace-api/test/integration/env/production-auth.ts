// See the note in `mock-auth.ts`. `phase1d-authentication.spec.ts` exercises the
// real JWT bearer path and is the one spec that requires `AUTH_MODE=production`,
// so it runs as a separate Jest project with this setup file.
process.env.AUTH_MODE = 'production';
