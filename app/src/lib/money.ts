/* ==========================================================================
   MONEY
   Integer cents everywhere. Floats exist only at the input boundary and are
   converted once. Tax is rounded half-up per invoice, matching the browser
   invoice tool this replaces, so an imported invoice reproduces its totals.
   ========================================================================== */

export const dollarsToCents = (value: number | string): number => {
    const n = typeof value === 'string' ? Number(value.replace(/[^0-9.-]/g, '')) : value;
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
};

export const centsToDollars = (cents: number): number => cents / 100;

export const formatMoney = (cents: number, currency = 'USD'): string =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency });

/** Rounds half away from zero on a positive value, like the browser tool did. */
const roundHalfUp = (value: number): number => Math.floor(value + 0.5);

/** Rounds half away from zero, for either sign. */
const roundHalfAway = (value: number): number => Math.sign(value) * Math.floor(Math.abs(value) + 0.5);

/** Line amount: officers × hours × rate, in cents. Hours may be fractional.
    A negative rate is a credit line (the deposit already invoiced); officers
    and hours are never negative. */
export const lineCents = (officers: number, hours: number, rateCents: number): number =>
    roundHalfAway(Math.max(0, officers) * Math.max(0, hours) * rateCents);

export type LineItem = {
    description: string;
    officers: number;
    hours: number;
    rate_cents: number;
    amount_cents: number;
    shift_id?: string | null;
};

export type Totals = { subtotal_cents: number; tax_rate_pct: number; tax_cents: number; total_cents: number };

/** Subtotal + tax at a percentage with three decimals of precision (8.250).
    Credit lines reduce the subtotal; it never goes below zero. */
export const computeTotals = (lines: { amount_cents: number }[], taxRatePct: number, taxExempt = false): Totals => {
    const subtotal_cents = Math.max(0, lines.reduce((sum, l) => sum + Math.trunc(l.amount_cents), 0));
    const rate = taxExempt ? 0 : Math.max(0, taxRatePct);
    const tax_cents = roundHalfUp((subtotal_cents * rate) / 100);
    return { subtotal_cents, tax_rate_pct: rate, tax_cents, total_cents: subtotal_cents + tax_cents };
};

/** Deposit amount for a percentage of a total, in cents. */
export const depositCents = (totalCents: number, depositPct: number): number =>
    roundHalfUp((Math.max(0, totalCents) * Math.min(100, Math.max(0, depositPct))) / 100);

export const parseIntSafe = (value: FormDataEntryValue | null | undefined, fallback = 0): number => {
    const n = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(n) ? n : fallback;
};

export const parseFloatSafe = (value: FormDataEntryValue | null | undefined, fallback = 0): number => {
    const n = Number.parseFloat(String(value ?? ''));
    return Number.isFinite(n) ? n : fallback;
};
