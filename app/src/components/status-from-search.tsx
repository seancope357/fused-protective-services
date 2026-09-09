import { Notice } from '@/components/ui';

export type SearchStatus = { msg?: string; tone?: string };

/** Renders the `?msg=&tone=` status a server action redirected back with. */
export function StatusFromSearch({ params }: { params: SearchStatus }) {
    const tone = params.tone === 'bad' || params.tone === 'warn' ? params.tone : 'good';
    return <Notice message={params.msg ?? null} tone={tone} />;
}
