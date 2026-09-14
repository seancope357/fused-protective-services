import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { entityHref } from '@/lib/domain/timeline';

/* ==========================================================================
   The activity feed links every row it renders.

   `/portal/activity` maps an audit_log row to a page with `entityHref`. The
   entity vocabulary is declared in SQL — the CASE in `audit_row_change()` —
   and nothing in TypeScript sees it, so a migration that adds a table adds a
   row type the feed will render as dead text. That is how `candidate` arrived
   unlinked. These tests read the SQL and the route tree so the next one can't.
   ========================================================================== */

const MIGRATIONS = path.resolve(__dirname, '../../supabase/migrations');
const APP_DIR = path.resolve(__dirname, '../src/app');

/** The entity vocabulary as the newest declaration of audit_row_change() states it. */
function auditEntityTypes(): string[] {
    const declaring = readdirSync(MIGRATIONS)
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .filter((f) => readFileSync(path.join(MIGRATIONS, f), 'utf8').includes('v_entity := CASE TG_TABLE_NAME'));
    expect(declaring.length).toBeGreaterThan(0);

    const sql = readFileSync(path.join(MIGRATIONS, declaring[declaring.length - 1]), 'utf8');
    const block = sql.slice(sql.indexOf('v_entity := CASE TG_TABLE_NAME'));
    const arms = block.slice(0, block.indexOf('END;')).matchAll(/WHEN '[a-z_]+' THEN '([a-z_]+)'/g);
    return [...new Set([...arms].map((m) => m[1]))];
}

/** The page file a href resolves to, or null when the route tree has no such page. */
function pageFileFor(href: string): string | null {
    const file = path.join(APP_DIR, ...href.split('/').filter(Boolean).map((seg) => (seg === 'ID' ? '[id]' : seg)), 'page.tsx');
    return existsSync(file) ? file : null;
}

describe('entityHref covers the audit vocabulary', () => {
    const types = auditEntityTypes();

    it('reads a non-trivial vocabulary out of the migration', () => {
        expect(types).toContain('candidate');
        expect(types.length).toBeGreaterThanOrEqual(12);
    });

    it.each(types)('%s links somewhere', (entityType) => {
        const href = entityHref(entityType, 'ID');
        expect(href, `${entityType} renders as unlinked text in /portal/activity`).not.toBeNull();
    });

    it.each(types)('%s links to a route that exists', (entityType) => {
        const href = entityHref(entityType, 'ID')!;
        expect(pageFileFor(href), `${href} has no page under src/app`).not.toBeNull();
    });

    it('returns null for a type it does not know, rather than a broken link', () => {
        expect(entityHref('sasquatch', 'ID')).toBeNull();
    });
});
