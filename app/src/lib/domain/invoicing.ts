/* ==========================================================================
   INVOICING — pure derivations
   Line items from shifts, totals, deposit and balance maths, legacy import
   parsing. No I/O here; actions/invoices.ts persists.
   ========================================================================== */

import { computeTotals, depositCents, lineCents, type LineItem, type Totals } from '@/lib/money';
import { armedLevels } from '@/lib/shared';
import { fmtDate, fmtTime } from '@/lib/format';
import type { Shift } from '@/lib/db/types';

const hoursBetween = (a: string, b: string): number => Math.round(((new Date(b).getTime() - new Date(a).getTime()) / 3600000) * 100) / 100;

/** One line per shift: "Level III Armed — Fri Oct 24, 8:00 PM–2:00 AM". */
export function linesFromShifts(shifts: Shift[]): LineItem[] {
    return shifts
        .filter((s) => s.status !== 'cancelled')
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
        .map((s) => {
            const hours = hoursBetween(s.starts_at, s.ends_at);
            const level = armedLevels.find((l) => l.id === s.armed_level)?.label ?? s.armed_level;
            return {
                description: `${level} — ${fmtDate(s.starts_at, { weekday: 'short' })}, ${fmtTime(s.starts_at)}–${fmtTime(s.ends_at)}`,
                officers: s.officers_required,
                hours,
                rate_cents: s.bill_rate_cents,
                amount_cents: lineCents(s.officers_required, hours, s.bill_rate_cents),
                shift_id: s.id
            };
        });
}

/** Recomputes amounts for edited lines and returns lines + totals. */
export function settleLines(lines: Omit<LineItem, 'amount_cents'>[], taxRatePct: number, taxExempt = false): { lines: LineItem[]; totals: Totals } {
    const settled = lines.map((l) => ({ ...l, amount_cents: lineCents(l.officers, l.hours, l.rate_cents) }));
    return { lines: settled, totals: computeTotals(settled, taxRatePct, taxExempt) };
}

/** A deposit invoice is one line for the percentage of the full total. */
export function depositLine(jobTitle: string, fullTotalCents: number, depositPct: number): LineItem {
    const amount = depositCents(fullTotalCents, depositPct);
    return { description: `Deposit (${depositPct}%) — ${jobTitle}`, officers: 1, hours: 1, rate_cents: amount, amount_cents: amount };
}

/**
 * Balance invoice: full lines, less the deposit already invoiced, as a credit
 * line. The deposit was invoiced untaxed against the taxed total, so the
 * credit is applied pre-tax (deposit ÷ (1 + rate)); after tax the balance
 * comes out to total − deposit, within a cent.
 */
export function balanceLines(full: LineItem[], depositCentsPaid: number, taxRatePct = 0): LineItem[] {
    if (depositCentsPaid <= 0) return full;
    const credit = Math.round(depositCentsPaid / (1 + Math.max(0, taxRatePct) / 100));
    return [...full, { description: 'Less deposit invoiced', officers: 1, hours: 1, rate_cents: -credit, amount_cents: -credit }];
}

/* ---------- Legacy import (invoice.html localStorage export) ---------- */

export type LegacyRecord = {
    number: string;
    status?: string;
    issueDate?: string;
    dueDate?: string;
    netTermId?: string;
    client?: { name?: string; company?: string; email?: string; phone?: string; address?: string };
    lines?: { tierId?: string; desc?: string; officers?: number; hours?: number; rate?: number }[];
    notes?: string;
    terms?: string;
    totals?: { subtotalCents?: number; taxCents?: number; taxRatePct?: number; totalCents?: number };
    savedAt?: string;
};

export type ParsedLegacy = {
    invoice_number: string;
    status: 'draft' | 'sent' | 'paid';
    issue_date: string;
    due_date: string;
    net_term_id: string;
    client_name: string;
    client_company: string | null;
    client_email: string | null;
    client_phone: string | null;
    client_address: string | null;
    line_items: LineItem[];
    notes: string | null;
    terms: string | null;
    totals: Totals;
    legacy_source: LegacyRecord;
};

const NUMBER_RE = /^[A-Z]+-\d{4}-\d{4,}$/;

/** Validates one exported record; throws with a plain reason on a bad one. */
export function parseLegacyRecord(raw: unknown): ParsedLegacy {
    const r = raw as LegacyRecord;
    if (!r || typeof r !== 'object' || typeof r.number !== 'string' || !NUMBER_RE.test(r.number)) throw new Error('missing or malformed invoice number');
    if (!r.client?.name) throw new Error(`${r.number}: missing client name`);
    const lines: LineItem[] = (r.lines ?? []).map((l) => {
        const rate_cents = Math.round((l.rate ?? 0) * 100);
        const officers = l.officers ?? 1;
        const hours = l.hours ?? 0;
        return { description: l.desc || 'Service', officers, hours, rate_cents, amount_cents: lineCents(officers, hours, rate_cents) };
    });
    const taxRate = r.totals?.taxRatePct ?? 0;
    const totals = computeTotals(lines, taxRate);
    if (r.totals?.totalCents !== undefined && r.totals.totalCents !== totals.total_cents) {
        throw new Error(`${r.number}: stored total ${r.totals.totalCents} does not match recomputed ${totals.total_cents}`);
    }
    const status = r.status === 'paid' ? 'paid' : r.status === 'sent' ? 'sent' : 'draft';
    const issue = r.issueDate && /^\d{4}-\d{2}-\d{2}$/.test(r.issueDate) ? r.issueDate : new Date().toISOString().slice(0, 10);
    const due = r.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(r.dueDate) ? r.dueDate : issue;
    return {
        invoice_number: r.number,
        status,
        issue_date: issue,
        due_date: due,
        net_term_id: r.netTermId || 'net-30',
        client_name: r.client.name,
        client_company: r.client.company || null,
        client_email: r.client.email || null,
        client_phone: r.client.phone || null,
        client_address: r.client.address || null,
        line_items: lines,
        notes: r.notes || null,
        terms: r.terms || null,
        totals,
        legacy_source: r
    };
}
