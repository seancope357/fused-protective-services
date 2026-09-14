import { notFound } from 'next/navigation';
import { getInvoice, listPayments } from '@/lib/domain/queries';
import { PageHead, Badge, Money } from '@/components/ui';
import { InvoicePaper } from '@/components/invoice-paper';
import { PayPanel, PayButton, canPayOnline } from '@/components/pay-panel';
import { PrintButton } from '@/components/print-button';
import { appUrl } from '@/lib/shared';
import { qrSvg } from '@/lib/qr';

export const dynamic = 'force-dynamic';

export default async function ClientInvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
    const { id } = await params;
    const invoice = await getInvoice(id);
    if (!invoice) notFound();
    const payments = await listPayments(id);
    const payUrl = `${appUrl()}/pay/${invoice.pay_token}`;
    const returnTo = `${appUrl()}/client/invoices/${id}`;
    const { status } = await searchParams;
    const balance = invoice.total_cents - invoice.amount_paid_cents;
    /* Paying is what this screen is for, so the button is the page's primary
       action: pinned above the tab bar on a phone, in the header on desktop.
       The panel then shows the amount and breakdown without repeating it. */
    const payable = canPayOnline(invoice);
    return (
        <>
            <PageHead
                eyebrow={`Invoice ${invoice.invoice_number}`}
                title={invoice.client_company || invoice.client_name}
                actions={<PrintButton />}
                primary={payable ? <PayButton invoice={invoice} returnTo={returnTo}>Pay <Money cents={balance} /></PayButton> : undefined}
            >
                <Badge status={invoice.status} /> · balance <Money cents={balance} />
            </PageHead>
            <div className="split mt-4">
                <div className="stack no-print">
                    <PayPanel invoice={invoice} payments={payments} status={status} returnTo={returnTo} payButton={!payable} />
                </div>
                <InvoicePaper invoice={invoice} payUrl={payUrl} qrSvg={await qrSvg(payUrl)} />
            </div>
        </>
    );
}
