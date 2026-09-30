import { defineConfig } from 'vitest/config';

// Unit tests live next to the code in src/. Browser tests (Playwright) live in e2e/ and are run
// separately with `npm run e2e`.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
