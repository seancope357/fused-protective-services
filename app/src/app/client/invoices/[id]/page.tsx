import { notFound } from 'next/navigation';
import { getInvoice, listPayments } from '@/lib/domain/queries';
import { PageHead, Badge, Money } from '@/components/ui';
import { InvoicePaper } from '@/components/invoice-paper';
import { PayPanel } from '@/components/pay-panel';
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
    const { status } = await searchParams;
    return (
        <>
            <PageHead eyebrow={`Invoice ${invoice.invoice_number}`} title={invoice.client_company || invoice.client_name} actions={<PrintButton />}><Badge status={invoice.status} /> · balance <Money cents={invoice.total_cents - invoice.amount_paid_cents} /></PageHead>
            <div className="grid grid--2 mt-4" style={{ alignItems: 'start' }}>
                <div className="stack no-print">
                    <PayPanel invoice={invoice} payments={payments} status={status} returnTo={`${appUrl()}/client/invoices/${id}`} />
                </div>
                <InvoicePaper invoice={invoice} payUrl={payUrl} qrSvg={await qrSvg(payUrl)} />
            </div>
        </>
    );
}
