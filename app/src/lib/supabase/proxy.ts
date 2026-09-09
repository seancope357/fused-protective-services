import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/portal', '/client', '/officer'];

/** Refreshes the auth cookie on every request and bounces anonymous visitors
    away from authenticated areas. Role checks happen in the area layouts,
    which can query the profile; the proxy only knows "signed in or not". */
export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (toSet) => {
                for (const { name, value } of toSet) request.cookies.set(name, value);
                response = NextResponse.next({ request });
                for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
            }
        }
    });

    const { data } = await supabase.auth.getClaims();
    const signedIn = Boolean(data?.claims);
    const path = request.nextUrl.pathname;

    if (!signedIn && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('next', path);
        return NextResponse.redirect(url);
    }
    if (signedIn && path === '/login') {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        url.search = '';
        return NextResponse.redirect(url);
    }
    return response;
}
