import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type Role = 'owner' | 'staff' | 'client' | 'officer';

export type Session = {
    userId: string;
    email: string | null;
    role: Role;
    clientId: string | null;
    officerId: string | null;
    fullName: string | null;
};

/** The signed-in user's profile, or null. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return null;
    const { data: profile } = await supabase
        .from('profiles')
        .select('role, client_id, officer_id, full_name')
        .eq('id', user.id)
        .maybeSingle();
    if (!profile) return null;
    return {
        userId: user.id,
        email: user.email ?? null,
        role: profile.role as Role,
        clientId: profile.client_id,
        officerId: profile.officer_id,
        fullName: profile.full_name
    };
});

export const homeFor = (role: Role): string =>
    role === 'owner' || role === 'staff' ? '/portal' : role === 'client' ? '/client' : '/officer';

export async function requireStaff(): Promise<Session> {
    const session = await getSession();
    if (!session) redirect('/login?next=/portal');
    if (session.role !== 'owner' && session.role !== 'staff') redirect(homeFor(session.role));
    return session;
}

export async function requireClient(): Promise<Session & { clientId: string }> {
    const session = await getSession();
    if (!session) redirect('/login?next=/client');
    if (session.role !== 'client' || !session.clientId) redirect(session.role === 'client' ? '/login?unscoped=1' : homeFor(session.role));
    return session as Session & { clientId: string };
}
