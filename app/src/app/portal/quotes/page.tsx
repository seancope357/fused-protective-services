import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Money, Empty } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { fmtDateOnly, fmtDateTime } from '@/lib/format';
import { divisionByQuoteValue } from '@/lib/shared';
import type { Quote } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

type QuoteRow = Quote & { clients: { name: string } | null };

/* Desktop keeps the number first, the way quotes are referred to on the phone
   with a client. On a phone the client is the card title (that is who you are
   looking for) and the division and dates wait for a wider screen. */
const columns: Column<QuoteRow>[] = [
    { key: 'number', header: 'Number', cell: (q) => <span className="mono small">{q.quote_number}</span> },
    { key: 'client', header: 'Client', primary: true, cell: (q) => <Link href={`/portal/quotes/${q.id}`}>{q.clients?.name ?? `Quote ${q.quote_number}`}</Link> },
    { key: 'division', header: 'Division', hide: 'phone', cell: (q) => <span className="small">{divisionByQuoteValue(q.division_quote_value)?.heading ?? q.division_quote_value}</span> },
    { key: 'total', header: 'Total', num: true, cell: (q) => <Money cents={q.total_cents} /> },
    { key: 'valid', header: 'Valid until', hide: 'tablet', cell: (q) => <span className="small">{fmtDateOnly(q.valid_until)}</span> },
    { key: 'status', header: 'Status', cell: (q) => <Badge status={q.status} /> },
    { key: 'updated', header: 'Updated', hide: 'tablet', cell: (q) => <span className="small muted">{fmtDateTime(q.sent_at ?? q.created_at)}</span> }
];

export default async function QuotesPage({ searchParams }: { searchParams: Promise<SearchStatus> }) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from('quotes').select('*, clients(name)').order('created_at', { ascending: false }).limit(200);
    const quotes = (data ?? []) as QuoteRow[];
    return (
        <>
            <PageHead eyebrow="Sales" title="Quotes & proposals" primary={<Link href="/portal/quotes/new" className="btn btn--gold">New quote</Link>}>
                Draft, then send the proposal. When the client accepts, the job is created for you.
            </PageHead>
            <StatusFromSearch params={await searchParams} />
            {quotes.length ? (
                <DataTable caption="Quotes and proposals" columns={columns} rows={quotes} rowKey={(q) => q.id} />
            ) : <Empty>No quotes yet. Convert a lead or start one from scratch.</Empty>}
        </>
    );
}
