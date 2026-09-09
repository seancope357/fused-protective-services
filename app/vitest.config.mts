import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            /* 'server-only' is a Next.js marker module; tests import server code directly. */
            'server-only': path.resolve(__dirname, 'tests/helpers/server-only.ts')
        }
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        /* Database tests need TEST_DATABASE_URL; they skip themselves otherwise. */
        testTimeout: 30000,
        hookTimeout: 60000
    }
});
