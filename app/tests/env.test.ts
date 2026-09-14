/* ==========================================================================
   Which deployment is this? (SPEC-002)

   The asymmetry is the point and it is easy to invert: a preview that thinks
   it is production pages the owner, and a production deploy that thinks it is
   a preview goes silent on real leads. The absent case is tested first because
   it is the one every non-Vercel runtime hits.
   ========================================================================== */

import { afterEach, describe, expect, it } from 'vitest';
import { deployEnv, deployEnvLabel, isProduction, supabaseProjectRef } from '@/lib/env';

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe('deployEnv', () => {
    it('is development, not production, when VERCEL_ENV is absent', () => {
        delete process.env.VERCEL_ENV;
        expect(deployEnv()).toBe('development');
        expect(isProduction()).toBe(false);
    });

    it('returns production only when VERCEL_ENV says production', () => {
        for (const [value, expected] of [
            ['production', 'production'],
            ['preview', 'preview'],
            ['development', 'development'],
            ['', 'development'],
            ['prod', 'development'],
            ['staging', 'development'],
            ['productionish', 'development']
        ] as const) {
            process.env.VERCEL_ENV = value;
            expect(deployEnv(), `VERCEL_ENV=${JSON.stringify(value)}`).toBe(expected);
            expect(isProduction(), `VERCEL_ENV=${JSON.stringify(value)}`).toBe(expected === 'production');
        }
    });

    it('does not demote production over whitespace or casing', () => {
        for (const value of [' production ', 'PRODUCTION', 'Production']) {
            process.env.VERCEL_ENV = value;
            expect(deployEnv(), `VERCEL_ENV=${JSON.stringify(value)}`).toBe('production');
        }
    });

    it('names each environment for the banner', () => {
        expect(deployEnvLabel('preview')).toMatch(/preview/i);
        expect(deployEnvLabel('development')).toMatch(/local/i);
        expect(deployEnvLabel('production')).toMatch(/production/i);
    });
});

describe('supabaseProjectRef', () => {
    it('reads the project ref out of the Supabase URL', () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://zphyvnouierjwjqjvahs.supabase.co';
        expect(supabaseProjectRef()).toBe('zphyvnouierjwjqjvahs');
    });

    it('distinguishes a branch project from production', () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co';
        expect(supabaseProjectRef()).toBe('abcdefghijklmnopqrst');
    });

    it('labels a local stack instead of reporting "127" as a project', () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54621';
        expect(supabaseProjectRef()).toBe('local');
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
        expect(supabaseProjectRef()).toBe('local');
    });

    it('returns null rather than inventing a project', () => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.SUPABASE_URL;
        expect(supabaseProjectRef()).toBeNull();

        process.env.NEXT_PUBLIC_SUPABASE_URL = 'not a url';
        expect(supabaseProjectRef()).toBeNull();
    });
});
