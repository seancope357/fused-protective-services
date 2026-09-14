import 'server-only';
import { redirect, unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { report } from '@/lib/observability';

/** Redirects back to a page with a status line the page renders in a live region. */
export function done(path: string, message: string, tone: 'good' | 'bad' | 'warn' = 'good'): never {
    revalidatePath(path);
    const url = new URL(path, 'http://x');
    url.searchParams.set('msg', message);
    url.searchParams.set('tone', tone);
    redirect(`${url.pathname}${url.search}`);
}

/**
 * Wraps a server action so an unhandled exception inside it is reported before
 * it disappears (SPEC-003 §4). Without this an action that throws shows the
 * user the error boundary and tells nobody — the failure that the spec lists
 * as "discovered by a customer, if at all".
 *
 * Two things it must get right, and the reason it exists rather than a
 * try/catch at every call site:
 *
 *   1. `redirect()` and `notFound()` signal themselves by throwing. Every
 *      successful action in this codebase ends in `done()`, which redirects,
 *      so a naive wrapper would report every success as a failure and — far
 *      worse — swallow the redirect. `unstable_rethrow` is Next's own test
 *      for its control-flow throws; it re-throws them and returns for
 *      anything else.
 *   2. It re-throws the real error afterwards. The error boundary still
 *      renders, the user still sees what they saw before. Reporting is added
 *      behaviour and never replaces behaviour.
 *
 * Form data is never reported. The action's name and the argument shape are
 * enough to find it; the field values are a client's name, phone number and
 * site address, and an ops alert is not where those belong.
 */
export function reporting<A extends unknown[], R>(
    name: string,
    action: (...args: A) => Promise<R>
): (...args: A) => Promise<R> {
    return async (...args: A): Promise<R> => {
        try {
            return await action(...args);
        } catch (err) {
            unstable_rethrow(err);
            await report(err, {
                severity: 'error',
                source: `action/${name}`,
                context: { arity: args.length }
            });
            throw err;
        }
    };
}

export const str = (fd: FormData, key: string, max = 2000): string => String(fd.get(key) ?? '').trim().slice(0, max);
export const optStr = (fd: FormData, key: string, max = 2000): string | null => str(fd, key, max) || null;
export const bool = (fd: FormData, key: string): boolean => fd.get(key) === 'on' || fd.get(key) === 'true' || fd.get(key) === '1';

/** Reads a datetime-local value entered in the business timezone and returns ISO. */
export function localToIso(value: string, offsetHint = '-05:00'): string | null {
    if (!value) return null;
    // datetime-local has no zone; interpret in America/Chicago using the current offset.
    const probe = new Date(`${value}:00${offsetHint}`);
    const offset = chicagoOffset(probe);
    const d = new Date(`${value}:00${offset}`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** "-05:00" or "-06:00" for the given instant in America/Chicago. */
export function chicagoOffset(at: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', timeZoneName: 'shortOffset' }).formatToParts(at);
    const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-6';
    const m = /GMT([+-]\d+)/.exec(name);
    const hours = m ? Number(m[1]) : -6;
    return `${hours < 0 ? '-' : '+'}${String(Math.abs(hours)).padStart(2, '0')}:00`;
}

/** ISO → value for a datetime-local input, in America/Chicago. */
export function isoToLocal(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}`;
}
