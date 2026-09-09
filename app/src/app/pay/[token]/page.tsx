import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { InvoicePaper } from '@/components/invoice-paper';
import { PayPanel } from '@/components/pay-panel';
import { PrintButton } from '@/components/print-button';
import { appUrl, site } from '@/lib/shared';
import { qrSvg } from '@/lib/qr';
import type { Invoice, Payment } from '@/lib/db/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pay invoice' };

/**
 * Public pay page reached from the emailed link. The token is a 48-hex-char
 * secret unique to the invoice; nothing else on the page is guessable and no
 * other client data is exposed. Drafts are never reachable.
 */
export default async function PayPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ status?: string }> }) {
    const { token } = await params;
    if (!/^[0-9a-f]{48}$/.test(token)) notFound();
    const db = supabaseAdmin();
    const { data: invoice } = await db.from('invoices').select('*').eq('pay_token', token).neq('status', 'draft').maybeSingle();
    if (!invoice) notFound();
    const { data: payments } = await db.from('payments').select('*').eq('invoice_id', invoice.id).order('received_at', { ascending: false });
    const { status } = await searchParams;
    const payUrl = `${appUrl()}/pay/${token}`;

    return (
        <div className="doc-shell">
            <a href="#main" className="skip-link">Skip to content</a>
            <header className="row row--between mb-4 no-print">
                <div className="row" style={{ gap: 10 }}>
                    <img src={`${site.url}/${site.logo}`} alt="" width={36} height={36} style={{ borderRadius: 8 }} />
                    <div><div className="shell__brand-title">{site.shortName}</div><div className="shell__brand-sub">Invoice {invoice.invoice_number}</div></div>
                </div>
                <div className="row"><PrintButton /><a className="btn btn--ghost" href="/login">Client portal</a></div>
            </header>
            <main id="main" className="grid grid--2" style={{ alignItems: 'start' }}>
                <div className="stack no-print"><PayPanel invoice={invoice as Invoice} payments={(payments ?? []) as Payment[]} status={status} /></div>
                <InvoicePaper invoice={invoice as Invoice} payUrl={payUrl} qrSvg={await qrSvg(payUrl)} />
            </main>
        </div>
    );
}
