import { PageHead, Field } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { importLegacyInvoices } from '@/lib/actions/invoices';
import { site } from '@/lib/shared';

export default async function ImportPage({ searchParams }: { searchParams: Promise<SearchStatus> }) {
    return (
        <>
            <PageHead
                eyebrow="Billing"
                title="Import old invoices"
                primary={<button type="submit" form="import-invoices" className="btn btn--gold">Import</button>}
            >
                Import invoices from the old invoice tool. It saved invoices in one browser only, so do this on the computer and browser you used it in.
            </PageHead>
            <StatusFromSearch params={await searchParams} />
            <section className="card mt-4">
                <h2 className="mb-2">How to import</h2>
                {/* The base reset zeroes list padding; the numbers are the point of this list. */}
                <ol className="stack small" style={{ paddingLeft: '1.25rem' }}>
                    <li>In that browser, open <a href={`${site.url}/invoice`} className="wrap-anywhere">{site.url.replace(/^https?:\/\//, '')}/invoice</a>.</li>
                    <li>Press <strong>Export saved invoices</strong>.</li>
                    <li>Paste everything it gives you into the box below, then press <strong>Import</strong>.</li>
                </ol>
                <p className="small muted mt-4">Invoice numbers stay the same. Totals are recalculated and must match the old tool.</p>
            </section>
            {/* The submit lives in the page head (pinned above the tab bar on a
                phone) and reaches this form through its id. */}
            <form id="import-invoices" action={importLegacyInvoices} className="card stack mt-4">
                <Field id="payload" label="Exported invoices">
                    <textarea id="payload" name="payload" rows={14} className="mono" required placeholder='[{"number":"FPS-2026-0001", ...}]' autoComplete="off" autoCapitalize="off" spellCheck={false} />
                </Field>
            </form>
        </>
    );
}
