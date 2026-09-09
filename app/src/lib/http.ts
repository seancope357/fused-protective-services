import 'server-only';
import { headers } from 'next/headers';

/** Best-effort caller address for audit fields (proposal acceptance). */
export async function requestIp(): Promise<string> {
    const h = await headers();
    const fwd = h.get('x-forwarded-for') || h.get('x-real-ip') || '';
    return fwd.split(',')[0].trim() || 'unknown';
}

export async function requestUserAgent(): Promise<string> {
    const h = await headers();
    return (h.get('user-agent') || '').slice(0, 300);
}
