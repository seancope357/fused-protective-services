#!/usr/bin/env node
/* ==========================================================================
   VERIFY RESTORE — three checks against a restored database, nothing more.

     1. table counts      every expected table is present; how many rows each has
     2. RLS policies      row-level security on, and how many policies survived
     3. invoice sequence  the next minted number cannot reissue a used one

   Used by docs/RESTORE-DRILL.md step 4. Three checks that are always run beat
   twelve that are not — resist adding a fourth.

     node scripts/verify-restore.mjs "postgres://user:pass@host:5432/postgres"
     RESTORE_DATABASE_URL=… node scripts/verify-restore.mjs

   Exit 0 all three pass · 1 a check failed · 2 bad usage or no connection.
   ========================================================================== */

import { pathToFileURL } from 'node:url';
import pg from 'pg';

/* The tables created by supabase/migrations. A restore missing one of these is
   a failed restore however healthy the dashboard looks. */
export const EXPECTED_TABLES = [
    'audit_log', 'candidate_applications', 'client_quotes', 'clients', 'intake_gate',
    'invoices', 'jobs', 'notifications', 'officers', 'payments', 'profiles', 'proposals',
    'quotes', 'reviews', 'settings', 'shift_assignments', 'shifts', 'sites',
    'sms_opt_outs', 'stripe_events'
];

/* RLS is on for these and they carry no policy on purpose: only the service
   role touches them, so "no policy" is deny-all to every signed-in session. */
export const SERVICE_ROLE_ONLY_TABLES = ['intake_gate', 'stripe_events'];

const SQL = {
    policies: `
        SELECT c.relname AS table_name,
               c.relrowsecurity AS rls_enabled,
               (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid)::int AS policy_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname`,
    sequence: `
        SELECT (SELECT last_value FROM public.invoice_number_seq)::bigint          AS last_value,
               (SELECT is_called FROM public.invoice_number_seq)                   AS is_called,
               (SELECT count(*) FROM public.invoices)::int                         AS invoice_count,
               (SELECT max(substring(invoice_number FROM '^[A-Z]+-\\d{4}-(\\d+)$')::bigint)
                  FROM public.invoices
                 WHERE invoice_number ~ ('^[A-Z]+-' || to_char(now(), 'YYYY') || '-\\d+$'))
                                                                                   AS highest_issued_seq`
};

/* ---------- Pure: raw rows in, report out (this is what the test pins) ---------- */

/**
 * `sequence` is null when `public.invoice_number_seq` or `public.invoices` did not
 * come back — a restore can lose a sequence while every table looks healthy.
 * @param {{ present: string[], counts: Record<string, number>, policies: Array<{table_name: string, rls_enabled: boolean, policy_count: number}>, sequence: {last_value: number|string, is_called: boolean, invoice_count: number, highest_issued_seq: number|string|null} | null }} raw
 */
export function buildReport(raw) {
    const present = new Set(raw.present);
    const missing = EXPECTED_TABLES.filter((t) => !present.has(t));
    const tables = EXPECTED_TABLES.filter((t) => present.has(t)).map((name) => ({ name, rows: Number(raw.counts[name] ?? 0) }));

    const tableCounts = {
        ok: missing.length === 0,
        expected: EXPECTED_TABLES.length,
        found: tables.length,
        missing,
        totalRows: tables.reduce((sum, t) => sum + t.rows, 0),
        empty: tables.filter((t) => t.rows === 0).map((t) => t.name),
        tables
    };

    const relevant = raw.policies.filter((p) => present.has(p.table_name));
    const withoutRls = relevant.filter((p) => !p.rls_enabled).map((p) => p.table_name);
    const withoutPolicies = relevant.filter((p) => p.policy_count === 0).map((p) => p.table_name);
    const unexpectedlyUnprotected = withoutPolicies.filter((t) => !SERVICE_ROLE_ONLY_TABLES.includes(t));
    const rlsPolicies = {
        ok: withoutRls.length === 0 && unexpectedlyUnprotected.length === 0,
        tables: relevant.length,
        policies: relevant.reduce((sum, p) => sum + p.policy_count, 0),
        withoutRls,
        withoutPolicies,
        unexpectedlyUnprotected
    };

    const invoiceSequence = sequenceCheck(raw.sequence);

    return { checks: { tableCounts, rlsPolicies, invoiceSequence }, ok: tableCounts.ok && rlsPolicies.ok && invoiceSequence.ok };
}

function sequenceCheck(row) {
    if (!row) return { ok: false, present: false, lastValue: null, isCalled: false, nextValue: null, invoiceCount: null, highestIssued: null, wouldReissue: false };
    const lastValue = Number(row.last_value);
    const highestIssued = row.highest_issued_seq === null || row.highest_issued_seq === undefined ? null : Number(row.highest_issued_seq);
    /* nextval() returns last_value itself until the sequence has been called once. */
    const nextValue = row.is_called ? lastValue + 1 : lastValue;
    return {
        ok: highestIssued === null || nextValue > highestIssued,
        present: true,
        lastValue,
        isCalled: Boolean(row.is_called),
        nextValue,
        invoiceCount: Number(row.invoice_count),
        highestIssued,
        wouldReissue: highestIssued !== null && nextValue <= highestIssued
    };
}

/** @param {ReturnType<typeof buildReport>} report */
export function renderReport(report) {
    const { tableCounts: t, rlsPolicies: r, invoiceSequence: s } = report.checks;
    const mark = (ok) => (ok ? 'PASS' : 'FAIL');
    const width = Math.max(...t.tables.map((x) => x.name.length), 10);
    const lines = [];

    lines.push(`1 · TABLE COUNTS  [${mark(t.ok)}]  ${t.found}/${t.expected} tables, ${t.totalRows} rows`);
    for (const { name, rows } of t.tables) lines.push(`    ${name.padEnd(width)}  ${String(rows).padStart(8)}`);
    if (t.missing.length) lines.push(`    MISSING: ${t.missing.join(', ')}`);
    if (t.empty.length) lines.push(`    empty: ${t.empty.join(', ')}`);

    lines.push('');
    lines.push(`2 · RLS POLICIES  [${mark(r.ok)}]  ${r.policies} policies across ${r.tables} tables`);
    lines.push(`    row level security enabled: ${r.tables - r.withoutRls.length}/${r.tables}`);
    if (r.withoutRls.length) lines.push(`    RLS DISABLED: ${r.withoutRls.join(', ')}`);
    if (r.withoutPolicies.length) lines.push(`    no policies: ${r.withoutPolicies.join(', ')}`);
    if (r.unexpectedlyUnprotected.length) lines.push(`    UNPROTECTED: ${r.unexpectedlyUnprotected.join(', ')} — expected at least one policy`);

    lines.push('');
    if (!s.present) {
        lines.push(`3 · INVOICE SEQUENCE  [${mark(false)}]`);
        lines.push('    public.invoice_number_seq or public.invoices did not come back');
    } else {
        lines.push(`3 · INVOICE SEQUENCE  [${mark(s.ok)}]  ${s.invoiceCount} invoices`);
        lines.push(`    invoice_number_seq last_value=${s.lastValue} is_called=${s.isCalled} → next mint ${s.nextValue}`);
        lines.push(`    highest issued this year: ${s.highestIssued === null ? '(none)' : s.highestIssued}`);
        if (s.wouldReissue) lines.push('    WOULD REISSUE A USED NUMBER — setval the sequence past the highest issued number');
    }

    lines.push('');
    lines.push(report.ok ? 'All three checks passed.' : 'FAILED — see the checks marked FAIL above.');
    return lines.join('\n');
}

/* ---------- Impure: talk to the database ---------- */

async function collect(client) {
    const present = (await client.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
    )).rows.map((row) => row.table_name);

    const countable = EXPECTED_TABLES.filter((t) => present.includes(t));
    const counts = {};
    if (countable.length) {
        const union = countable.map((t) => `SELECT '${t}' AS table_name, count(*)::int AS rows FROM public.${t}`).join(' UNION ALL ');
        for (const row of (await client.query(union)).rows) counts[row.table_name] = row.rows;
    }

    const policies = (await client.query(SQL.policies)).rows;
    const hasSequence = (await client.query(`SELECT to_regclass('public.invoice_number_seq') IS NOT NULL AS present`)).rows[0].present;
    const sequence = present.includes('invoices') && hasSequence ? (await client.query(SQL.sequence)).rows[0] : null;

    return { present, counts, policies, sequence };
}

async function main(argv) {
    const connectionString = argv[2] || process.env.RESTORE_DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('usage: node scripts/verify-restore.mjs "postgres://…"   (or set RESTORE_DATABASE_URL)');
        return 2;
    }
    const client = new pg.Client({ connectionString });
    try {
        await client.connect();
    } catch (err) {
        console.error(`could not connect: ${err.message}`);
        return 2;
    }
    try {
        const report = buildReport(await collect(client));
        console.log(renderReport(report));
        return report.ok ? 0 : 1;
    } catch (err) {
        console.error(`query failed: ${err.message}`);
        return 2;
    } finally {
        await client.end();
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exitCode = await main(process.argv);
}
