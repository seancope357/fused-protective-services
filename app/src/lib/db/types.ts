/* Row shapes the portal reads. Kept by hand and narrow: only the columns the
   UI and engine touch. Money columns are integer cents. */

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'void';
export type LeadStatus = 'new' | 'contacted' | 'audit_scheduled' | 'proposal_sent' | 'dispatched' | 'closed_won' | 'closed_lost';
export type ArmedLevel = 'level-2' | 'level-3' | 'level-4' | 'mixed';

export type Lead = {
    id: string;
    ref_code: string;
    full_name: string;
    company: string | null;
    phone: string;
    email: string;
    service_division: string;
    armed_preference: string;
    deployment_location: string;
    schedule: string;
    notes: string | null;
    status: LeadStatus;
    priority: 'standard' | 'priority' | 'emergency';
    sms_consent: boolean;
    sms_consent_at: string | null;
    client_id: string | null;
    first_response_at: string | null;
    created_at: string;
};

export type Client = {
    id: string;
    kind: 'company' | 'individual';
    name: string;
    billing_contact_name: string | null;
    billing_email: string | null;
    billing_phone: string | null;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_city: string | null;
    billing_state: string | null;
    billing_postal_code: string | null;
    default_net_term_id: string;
    default_tax_rate_pct: number;
    tax_jurisdiction: string | null;
    tax_exempt: boolean;
    stripe_customer_id: string | null;
    sms_consent: boolean;
    sms_consent_at: string | null;
    sms_opted_out_at: string | null;
    notes: string | null;
    created_at: string;
};

export type Site = {
    id: string;
    client_id: string;
    name: string;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    onsite_contact_name: string | null;
    onsite_contact_phone: string | null;
    access_notes: string | null;
    parking_notes: string | null;
    gear_notes: string | null;
    tax_rate_pct: number | null;
};

export type Quote = {
    id: string;
    quote_number: string;
    client_id: string;
    site_id: string | null;
    source_quote_id: string | null;
    division_quote_value: string;
    armed_level: ArmedLevel;
    officer_count: number;
    hours: number;
    bill_rate_cents: number;
    subtotal_cents: number;
    tax_rate_pct: number;
    tax_cents: number;
    total_cents: number;
    deposit_pct: number;
    starts_at: string | null;
    ends_at: string | null;
    valid_until: string | null;
    status: QuoteStatus;
    sent_at: string | null;
    decided_at: string | null;
    notes: string | null;
    created_at: string;
};

export type Proposal = {
    id: string;
    quote_id: string;
    client_id: string;
    title: string;
    scope: string;
    exclusions: string | null;
    terms: string;
    snapshot: Record<string, unknown> | null;
    status: QuoteStatus;
    sent_at: string | null;
    accepted_at: string | null;
    accepted_name: string | null;
    accepted_ip: string | null;
    declined_at: string | null;
    declined_reason: string | null;
};

export type Job = {
    id: string;
    job_number: string;
    client_id: string;
    site_id: string | null;
    quote_id: string | null;
    division_quote_value: string;
    title: string;
    starts_at: string;
    ends_at: string;
    recurrence_rule: string | null;
    recurrence_until: string | null;
    arrival_window: string | null;
    onsite_contact_name: string | null;
    onsite_contact_phone: string | null;
    client_prep_notes: string | null;
    post_orders: string | null;
    deposit_pct: number;
    deposit_invoice_id: string | null;
    status: JobStatus;
    confirmed_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    completion_summary: string | null;
    created_at: string;
};

export type Shift = {
    id: string;
    job_id: string;
    starts_at: string;
    ends_at: string;
    officers_required: number;
    armed_level: ArmedLevel;
    bill_rate_cents: number;
    pay_rate_cents: number | null;
    status: JobStatus;
    notes: string | null;
};

export type Invoice = {
    id: string;
    invoice_number: string;
    client_id: string | null;
    job_id: string | null;
    kind: 'standard' | 'deposit' | 'balance';
    client_name: string;
    client_company: string | null;
    client_email: string | null;
    client_phone: string | null;
    client_address: string | null;
    issue_date: string;
    due_date: string;
    payment_terms: string;
    net_term_id: string;
    line_items: import('@/lib/money').LineItem[];
    subtotal_cents: number;
    tax_rate_pct: number;
    tax_cents: number;
    total_cents: number;
    amount_paid_cents: number;
    status: InvoiceStatus;
    paid_at: string | null;
    sent_at: string | null;
    voided_at: string | null;
    stripe_payment_intent_id: string | null;
    stripe_checkout_session_id: string | null;
    notes: string | null;
    terms: string | null;
    pay_token: string;
    legacy_source: Record<string, unknown> | null;
    created_at: string;
};

export type Payment = {
    id: string;
    invoice_id: string;
    amount_cents: number;
    method: string;
    status: 'pending' | 'succeeded' | 'failed' | 'refunded';
    stripe_payment_intent_id: string | null;
    failure_message: string | null;
    received_at: string;
};

export type Review = {
    id: string;
    job_id: string;
    client_id: string;
    token: string;
    status: 'requested' | 'submitted';
    rating: number | null;
    body: string | null;
    author_name: string | null;
    permission_to_publish: boolean;
    requested_at: string;
    submitted_at: string | null;
    published_at: string | null;
};

export type NotificationRow = {
    id: string;
    trigger: string;
    channel: 'email' | 'sms';
    recipient: string;
    recipient_role: 'owner' | 'client' | 'officer' | 'visitor';
    entity_type: string | null;
    entity_id: string | null;
    subject: string | null;
    status: 'sent' | 'failed' | 'skipped';
    error: string | null;
    provider: string | null;
    created_at: string;
};
