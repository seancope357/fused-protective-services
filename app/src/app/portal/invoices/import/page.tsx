import { PageHead, Field } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { importLegacyInvoices } from '@/lib/actions/invoices';
import { site } from '@/lib/shared';

export default async function ImportPage({ searchParams }: { searchParams: Promise<SearchStatus> }) {
    return (
        <>
            <PageHead eyebrow="Billing" title="Import legacy invoices">
                The old browser tool kept invoices in one browser only. Open <a href={`${site.url}/invoice`}>{site.url.replace(/^https?:\/\//, '')}/invoice</a> in that browser, press <strong>Export saved invoices</strong>, and paste the JSON here. Numbers are kept; totals are recomputed and must match.
            </PageHead>
            <StatusFromSearch params={await searchParams} />
            <form action={importLegacyInvoices} className="card stack mt-4">
                <Field id="payload" label="Export JSON"><textarea id="payload" name="payload" rows={14} className="mono" required placeholder='[{"number":"FPS-2026-0001", ...}]' /></Field>
                <div className="row"><button className="btn btn--gold" type="submit">Import</button></div>
            </form>
        </>
    );
}
