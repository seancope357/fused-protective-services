import { describe, expect, it } from 'vitest';
import { safeReturnTo } from '@/lib/actions/util';

/* ==========================================================================
   startCheckout sends the payer back to `return_to` after Stripe. That field
   comes from a form, so it is attacker-controlled: only a path inside the
   client portal on our own origin is honoured, and anything else falls back
   to the public /pay page (the caller's null branch).
   ========================================================================== */

const ORIGIN = 'https://portal.example.com';

describe('safeReturnTo', () => {
    it('accepts a client-portal path', () => {
        expect(safeReturnTo('/client/invoices/abc', ORIGIN)).toBe('/client/invoices/abc');
        expect(safeReturnTo('/client/invoices/0b6f2a3c-9d1e-4f5a-8b7c-1d2e3f4a5b6c', ORIGIN)).toBe('/client/invoices/0b6f2a3c-9d1e-4f5a-8b7c-1d2e3f4a5b6c');
    });

    it('accepts our own origin spelled out, and reduces it to the path', () => {
        // The client invoice page renders `${appUrl()}/client/invoices/<id>`.
        expect(safeReturnTo(`${ORIGIN}/client/invoices/abc`, ORIGIN)).toBe('/client/invoices/abc');
        expect(safeReturnTo(`${ORIGIN}/client/invoices/abc`, `${ORIGIN}/`)).toBe('/client/invoices/abc');
    });

    it.each([
        ['an absolute URL elsewhere', 'https://evil.com'],
        ['an absolute URL elsewhere with a client path', 'https://evil.com/client/invoices/abc'],
        ['a lookalike host that starts with our origin', `${ORIGIN}.evil.com/client/invoices/abc`],
        ['our origin over plain http', 'http://portal.example.com/client/invoices/abc'],
        ['a protocol-relative URL', '//evil.com'],
        ['a protocol-relative URL with a client path', '//evil.com/client/invoices/abc'],
        ['a backslash', '/\\evil.com'],
        ['a backslash inside the client path', '/client\\..\\portal'],
        ['a staff portal path', '/portal/x'],
        ['a path that escapes /client with ..', '/client/../portal/x'],
        ['an encoded traversal', '/client/%2e%2e/portal/x'],
        ['an empty segment', '/client//evil.com'],
        ['/client on its own', '/client'],
        ['a lookalike prefix', '/clients/x'],
        ['a query string', '/client/invoices/abc?next=//evil.com'],
        ['a fragment', '/client/invoices/abc#x'],
        ['a javascript: URL', 'javascript:alert(1)'],
        ['a relative path', 'client/invoices/abc'],
        ['surrounding whitespace', ' /client/invoices/abc'],
        ['a newline', '/client/invoices/abc\n'],
        ['an empty string', '']
    ])('rejects %s', (_label, value) => {
        expect(safeReturnTo(value, ORIGIN)).toBeNull();
    });

    it('rejects a missing value', () => {
        expect(safeReturnTo(null, ORIGIN)).toBeNull();
        expect(safeReturnTo(undefined, ORIGIN)).toBeNull();
    });
});
