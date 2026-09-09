import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Magic-link landing: exchanges the hashed token for a session cookie. */
export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type') as EmailOtpType | null;
    const next = url.searchParams.get('next') || '/';
    const target = next.startsWith('/') && !next.startsWith('//') ? next : '/';

    if (!tokenHash || !type) {
        return NextResponse.redirect(new URL('/login?error=invalid_link', url.origin));
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
        console.error('[auth] verifyOtp failed:', error.message);
        return NextResponse.redirect(new URL('/login?error=expired_link', url.origin));
    }
    return NextResponse.redirect(new URL(target, url.origin));
}
