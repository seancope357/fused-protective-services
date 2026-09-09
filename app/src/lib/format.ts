/* Display helpers. All dates render in the business's timezone. */

export const TZ = 'America/Chicago';

export const fmtDate = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric', ...opts });
};

export const fmtDateTime = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const fmtTime = (iso: string): string =>
    new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });

/** A date-only string (YYYY-MM-DD) rendered without timezone shifting. */
export const fmtDateOnly = (ymd: string | null | undefined): string => {
    if (!ymd) return '—';
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d) return ymd;
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
};

export const todayYmd = (): string => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return parts; // en-CA yields YYYY-MM-DD
};

export const addDaysYmd = (ymd: string, days: number): string => {
    const [y, m, d] = ymd.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + days));
    return date.toISOString().slice(0, 10);
};

export const daysBetween = (fromYmd: string, toYmd: string): number => {
    const a = new Date(`${fromYmd}T00:00:00Z`).getTime();
    const b = new Date(`${toYmd}T00:00:00Z`).getTime();
    return Math.round((b - a) / 86400000);
};

export const statusLabel = (s: string): string => s.replace(/_/g, ' ');

export const titleCase = (s: string): string => s.replace(/\b\w/g, (c) => c.toUpperCase());
