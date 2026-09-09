import Link from 'next/link';
import { formatMoney } from '@/lib/money';
import { statusLabel } from '@/lib/format';

export function PageHead({ eyebrow, title, actions, children }: { eyebrow?: string; title: string; actions?: React.ReactNode; children?: React.ReactNode }) {
    return (
        <header className="page-head">
            <div>
                {eyebrow ? <div className="page-head__eyebrow">{eyebrow}</div> : null}
                <h1>{title}</h1>
                {children ? <p className="mt-2">{children}</p> : null}
            </div>
            {actions ? <div className="page-head__actions">{actions}</div> : null}
        </header>
    );
}

export function Badge({ status, tone, children }: { status?: string; tone?: 'gold' | 'good' | 'bad'; children?: React.ReactNode }) {
    return (
        <span className="badge" data-status={status} data-tone={tone}>
            {children ?? (status ? statusLabel(status) : '')}
        </span>
    );
}

export function Money({ cents }: { cents: number }) {
    return <span className="num mono">{formatMoney(cents)}</span>;
}

export function Stat({ label, value, hint, gold }: { label: string; value: React.ReactNode; hint?: React.ReactNode; gold?: boolean }) {
    return (
        <div className="card stat">
            <div className="stat__label">{label}</div>
            <div className={`stat__value${gold ? ' stat__value--gold' : ''}`}>{value}</div>
            {hint ? <div className="stat__hint">{hint}</div> : null}
        </div>
    );
}

export function Empty({ children }: { children: React.ReactNode }) {
    return <div className="empty">{children}</div>;
}

/** Server-action status line. `role=status` + aria-live so screen readers hear the outcome. */
export function Notice({ message, tone = 'good' }: { message?: string | null; tone?: 'good' | 'bad' | 'warn' }) {
    return (
        <p className={`alert alert--${tone}`} role="status" aria-live="polite">
            {message ?? ''}
        </p>
    );
}

export function Field({ id, label, hint, children, className }: { id: string; label: string; hint?: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={`field${className ? ` ${className}` : ''}`}>
            <label htmlFor={id}>{label}</label>
            {children}
            {hint ? <div className="field__hint" id={`${id}-hint`}>{hint}</div> : null}
        </div>
    );
}

export function LinkButton({ href, children, variant = 'ghost', small }: { href: string; children: React.ReactNode; variant?: 'gold' | 'ghost' | 'danger'; small?: boolean }) {
    return (
        <Link href={href} className={`btn btn--${variant}${small ? ' btn--sm' : ''}`}>
            {children}
        </Link>
    );
}

export function PlaceholderFlag({ fact, what }: { fact: { placeholder?: boolean }; what: string }) {
    return fact.placeholder ? <span className="placeholder-flag" role="note">Placeholder {what}</span> : null;
}
