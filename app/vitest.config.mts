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

        /* One test database is shared by every file under tests/db, and some of
           that state is global rather than per-row — above all the invoice
           number sequence. tests/db/invoices.test.ts reads the sequence,
           reserves a number ahead of it, and asserts the next mint lands
           exactly one past the reservation; tests/db/rls.test.ts creates
           invoices of its own. Run those files concurrently and the second
           file's mints land between the first file's read and its assertion,
           which fails by exactly the number of interleaved mints. It surfaced
           in CI as `expected 115 to be 113` once a third db file changed the
           scheduling — a latent race, not a new one.

           Files therefore run one at a time. Tests within a file are already
           sequential unless marked .concurrent, so this is the only knob
           needed. Measured cost: 3.5s serialized against 1.7s parallel, so
           about 1.8s. That is a fair price for removing a whole class of
           intermittent failure from a suite this size; revisit it if the
           suite grows enough that the difference is felt. The alternative —
           an advisory lock around
           every sequence-touching test — keeps the parallelism but has to be
           remembered by every future test author, and this does not. */
        fileParallelism: false,

        testTimeout: 30000,
        hookTimeout: 60000
    }
});
