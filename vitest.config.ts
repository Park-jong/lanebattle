import { defineConfig } from 'vitest/config';

// Generated reports and archived source copies under output are not test suites.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } });
