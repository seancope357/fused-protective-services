#!/usr/bin/env node
/* ==========================================================================
   Rebuilds the test database from scratch: auth shim + every migration in
   supabase/migrations, in filename order. Used by `pnpm test:db` locally and
   by CI (Postgres service container). Needs psql on PATH.

     TEST_DATABASE_URL=postgres://localhost/fused_test node scripts/reset-test-db.mjs
   ========================================================================== */

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
const url = new URL(process.env.TEST_DATABASE_URL || 'postgres://localhost/fused_test');
const dbName = url.pathname.replace(/^\//, '') || 'fused_test';
const adminUrl = new URL(url.toString());
adminUrl.pathname = '/postgres';

const psql = (target, args) => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', target.toString(), ...args], { stdio: ['ignore', 'inherit', 'inherit'] });

psql(adminUrl, ['-c', `DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`]);
psql(adminUrl, ['-c', `CREATE DATABASE "${dbName}"`]);
psql(url, ['-f', join(repo, 'supabase', 'tests', 'auth_shim.sql')]);
const migrations = readdirSync(join(repo, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql')).sort();
for (const file of migrations) {
    process.stdout.write(`  applying ${file}\n`);
    psql(url, ['-f', join(repo, 'supabase', 'migrations', file)]);
}
console.log(`Test database "${dbName}" ready with ${migrations.length} migrations.`);
