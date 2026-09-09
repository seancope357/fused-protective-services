import 'server-only';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

/** Redirects back to a page with a status line the page renders in a live region. */
export function done(path: string, message: string, tone: 'good' | 'bad' | 'warn' = 'good'): never {
    revalidatePath(path);
    const url = new URL(path, 'http://x');
    url.searchParams.set('msg', message);
    url.searchParams.set('tone', tone);
    redirect(`${url.pathname}${url.search}`);
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
