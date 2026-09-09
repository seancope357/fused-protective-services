import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Money, Empty, LinkButton } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { fmtDateOnly, fmtDateTime } from '@/lib/format';
import { divisionByQuoteValue } from '@/lib/shared';
import type { Quote } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export default async function QuotesPage({ searchParams }: { searchParams: Promise<SearchStatus> }) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from('quotes').select('*, clients(name)').order('created_at', { ascending: false }).limit(200);
    const quotes = (data ?? []) as (Quote & { clients: { name: string } | null })[];
    return (
        <>
            <PageHead eyebrow="Sales" title="Quotes & proposals" actions={<LinkButton href="/portal/quotes/new" variant="gold">New quote</LinkButton>}>
                Draft → sent → accepted. Accepting creates the job.
            </PageHead>
            <StatusFromSearch params={await searchParams} />
            {quotes.length ? (
                <div className="card table-wrap mt-4">
                    <table>
                        <thead><tr><th>Number</th><th>Client</th><th>Division</th><th className="num">Total</th><th>Valid until</th><th>Status</th><th>Updated</th></tr></thead>
                        <tbody>
                            {quotes.map((q) => (
                                <tr key={q.id} className="is-link">
                                    <td><Link href={`/portal/quotes/${q.id}`} className="mono">{q.quote_number}</Link></td>
                                    <td>{q.clients?.name ?? '—'}</td>
                                    <td className="small">{divisionByQuoteValue(q.division_quote_value)?.heading ?? q.division_quote_value}</td>
                                    <td className="num"><Money cents={q.total_cents} /></td>
                                    <td className="small">{fmtDateOnly(q.valid_until)}</td>
                                    <td><Badge status={q.status} /></td>
                                    <td className="small muted">{fmtDateTime(q.sent_at ?? q.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <Empty>No quotes yet. Convert a lead or start one from scratch.</Empty>}
        </>
    );
}
