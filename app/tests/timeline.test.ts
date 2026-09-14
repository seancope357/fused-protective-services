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

    // Every row carries its parent id when the trigger records one, so both are given here.
    it.each(types)('%s links somewhere', (entityType) => {
        const href = entityHref(entityType, 'ID', 'ID');
        expect(href, `${entityType} renders as unlinked text in /portal/activity`).not.toBeNull();
    });

    it.each(types)('%s links to a route that exists', (entityType) => {
        const href = entityHref(entityType, 'ID', 'ID')!;
        expect(pageFileFor(href), `${href} has no page under src/app`).not.toBeNull();
    });

    it('returns null for a type it does not know, rather than a broken link', () => {
        expect(entityHref('sasquatch', 'ID')).toBeNull();
        expect(entityHref('sasquatch', 'ID', 'PARENT')).toBeNull();
    });
});

/* ==========================================================================
   Child records have no page of their own. A payment lives on its invoice, a
   shift and a review on their job, a site on its client, a proposal on its
   quote — so their feed rows link to the parent the trigger recorded, by the
   parent's id. Linking the parent route with the child's own id is a 404.
   ========================================================================== */

/** (child entity, parent entity) pairs as the newest audit_row_change() records them. */
function auditParents(): { child: string; parent: string }[] {
    const declaring = readdirSync(MIGRATIONS)
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .filter((f) => readFileSync(path.join(MIGRATIONS, f), 'utf8').includes('v_entity := CASE TG_TABLE_NAME'));
    const sql = readFileSync(path.join(MIGRATIONS, declaring[declaring.length - 1]), 'utf8');
    const entityBlock = sql.slice(sql.indexOf('v_entity := CASE TG_TABLE_NAME'));
    const entityOf = new Map([...entityBlock.slice(0, entityBlock.indexOf('END;')).matchAll(/WHEN '([a-z_]+)' THEN '([a-z_]+)'/g)].map((m) => [m[1], m[2]]));
    const parentBlock = sql.slice(sql.indexOf('-- Parent for grouping.'));
    return [...parentBlock.slice(0, parentBlock.indexOf('END CASE;')).matchAll(/WHEN '([a-z_]+)' THEN v_parent_type := '([a-z_]+)'/g)].map((m) => ({ child: entityOf.get(m[1]) ?? m[1], parent: m[2] }));
}

/** Children that do have a detail page of their own and link by their own id. */
const OWN_PAGE = new Set(['invoice']);

describe('entityHref links child records through their parent', () => {
    it.each([
        ['payment', '/portal/invoices/PARENT'],
        ['shift', '/portal/jobs/PARENT'],
        ['review', '/portal/jobs/PARENT'],
        ['site', '/portal/clients/PARENT'],
        ['proposal', '/portal/quotes/PARENT']
    ])('%s links to its parent page by the parent id', (entityType, expected) => {
        expect(entityHref(entityType, 'RECORD', 'PARENT')).toBe(expected);
    });

    it.each(['payment', 'shift', 'review', 'site', 'proposal'])('%s with no parent id renders without a link', (entityType) => {
        expect(entityHref(entityType, 'RECORD')).toBeNull();
        expect(entityHref(entityType, 'RECORD', null)).toBeNull();
    });

    it('records with their own page ignore the parent id', () => {
        expect(entityHref('invoice', 'RECORD', 'PARENT')).toBe('/portal/invoices/RECORD');
        expect(entityHref('job', 'RECORD', null)).toBe('/portal/jobs/RECORD');
    });

    it('reads the parent relationships out of the migration', () => {
        expect(auditParents()).toEqual(expect.arrayContaining([{ child: 'payment', parent: 'invoice' }, { child: 'shift', parent: 'job' }, { child: 'site', parent: 'client' }]));
    });

    it.each(auditParents())('$child rows never put their own id on a parent route', ({ child, parent }) => {
        const href = entityHref(child, 'RECORD', 'PARENT');
        if (OWN_PAGE.has(child)) {
            expect(href).toContain('RECORD');
        } else {
            expect(href).toBe(entityHref(parent, 'PARENT'));
        }
    });
});
