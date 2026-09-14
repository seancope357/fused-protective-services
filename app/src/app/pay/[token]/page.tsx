import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { InvoicePaper } from '@/components/invoice-paper';
import { PayPanel } from '@/components/pay-panel';
import { PrintButton } from '@/components/print-button';
import { appUrl, site, logoSrc } from '@/lib/shared';
import { qrSvg } from '@/lib/qr';
import type { Invoice, Payment } from '@/lib/db/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pay invoice' };

/**
 * Public pay page reached from the emailed link. The token is a 48-hex-char
 * secret unique to the invoice; nothing else on the page is guessable and no
 * other client data is exposed. Drafts are never reachable.
 *
 * Most people open it on a phone, so the pay panel (amount due and the pay
 * button) is first in the source and the invoice follows. From 600px the two
 * sit side by side. The header and the panel are no-print, so printing shows
 * only the paper — the grid's auto-fit collapses the empty track and the paper
 * takes the full page width.
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
            {/* Both halves wrap: at 320px the lockup takes one line and the two buttons the next. */}
            <header className="row row--between mb-4 no-print">
                <div className="brand">
                    <img src={logoSrc} alt="" width={34} height={34} />
                    <div><div className="brand__title">{site.shortName}</div><div className="brand__sub">Invoice {invoice.invoice_number}</div></div>
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
