// ==============================================================================
// Message bodies for the intake chain. Every fact they state (phone, email,
// company name, response promises) is read from src/data/site.mjs so the
// email a visitor receives cannot disagree with the page they submitted from.
// ==============================================================================

import { site } from '../../src/data/site.mjs';
import { escapeHtml } from './http.mjs';

const GOLD = '#c6a25c';
const CARBON = '#090a09';

/* Response promises, mirrored from the intake handler's public copy. */
export const responseWindow = (priority) => (priority === 'emergency' ? '45 minutes' : '2 hours');

/**
 * The one branded email layout. Also used by the portal's notification
 * engine (app/src/lib/notifications), so every email the business sends
 * shares a header, palette and footer.
 * @param {{ title: string, intro: string, rows?: [string, string][], outro?: string }} parts
 */
export function emailShell({ title, intro, rows = [], outro = '' }) {
    const tableRows = rows
        .map(
            ([k, v]) =>
                `<tr><td style="padding:6px 14px 6px 0;color:#78716c;vertical-align:top;white-space:nowrap;font-size:13px">${escapeHtml(k)}</td>` +
                `<td style="padding:6px 0;white-space:pre-wrap;font-size:14px;color:#f5f5f4">${escapeHtml(v)}</td></tr>`
        )
        .join('');
    return `<div style="background:${CARBON};padding:32px 16px;font-family:'Outfit',system-ui,-apple-system,sans-serif;color:#f5f5f4">
  <div style="max-width:560px;margin:0 auto;background:#111211;border:1px solid rgba(186,152,87,0.35);border-radius:14px;padding:28px">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${GOLD};font-weight:800">${escapeHtml(site.name)}</p>
    <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#ffffff">${escapeHtml(title)}</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#a8a29e">${intro}</p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 18px">${tableRows}</table>
    ${outro}
    <p style="margin:24px 0 0;font-size:12px;color:#78716c">${escapeHtml(site.motto)} · <a href="${site.url}" style="color:${GOLD}">${escapeHtml(site.url.replace(/^https?:\/\//, ''))}</a></p>
  </div>
</div>`;
}

/* ---------- Owner alert ---------- */

export function ownerAlert({ isCandidate, record, priority, persisted }) {
    const r = record;
    const rows = isCandidate
        ? [
            ['Reference', r.ref_code],
            ['Position', r.position_id],
            ['License level', r.license_level],
            ['Name', r.full_name],
            ['Phone', r.phone],
            ['Email', r.email],
            ['TOPS #', r.tops_number || '—'],
            ['Service branch', r.service_branch],
            ['Background', r.bio]
        ]
        : [
            ['Reference', r.ref_code],
            ['Priority', priority.toUpperCase()],
            ['Division', r.service_division],
            ['Armed preference', r.armed_preference],
            ['Name', r.full_name],
            ['Company', r.company || '—'],
            ['Phone', r.phone],
            ['Email', r.email],
            ['Location', r.deployment_location],
            ['Schedule', r.schedule],
            ['Notes', r.notes || '—']
        ];

    const tag = priority === 'emergency' ? '🚨 EMERGENCY — ' : priority === 'priority' ? '⚠️ PRIORITY — ' : '';
    const subject = isCandidate
        ? `[FPS] New officer application ${r.ref_code} — ${r.position_id}`
        : `[FPS] ${tag}New quote request ${r.ref_code} — ${r.service_division}`;

    const warning = persisted ? '' : '\n\nWARNING: database write failed — this email is the only record.';
    const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + warning;

    const html = emailShell({
        title: subject,
        intro: persisted
            ? `Respond within ${escapeHtml(responseWindow(priority))} — that is what the site promised this contact.`
            : '<strong style="color:#ef4444">Database write failed. This email is the only record of this submission.</strong>',
        rows,
        outro: r.phone
            ? `<p style="margin:0"><a href="tel:${escapeHtml(r.phone)}" style="display:inline-block;background:${GOLD};color:#050504;font-weight:800;padding:12px 20px;border-radius:8px;text-decoration:none">Call ${escapeHtml(r.full_name)}</a></p>`
            : ''
    });

    return { subject, text, html };
}

/* ---------- Owner SMS (emergency only) ---------- */

export function ownerSms({ record, priority }) {
    const r = record;
    return (
        `FUSED ${priority.toUpperCase()} ${r.ref_code}: ${r.service_division} — ${r.full_name}` +
        `${r.company ? ` (${r.company})` : ''} ${r.phone}. ${r.deployment_location}. ${r.schedule}.` +
        ` Site promised contact within ${responseWindow(priority)}.`
    );
}

/* ---------- Client confirmation ---------- */

export function clientConfirmation({ isCandidate, record, priority }) {
    const r = record;
    const firstName = String(r.full_name || '').split(' ')[0] || 'there';

    if (isCandidate) {
        const subject = `Application received — ${r.ref_code}`;
        const rows = [
            ['Reference', r.ref_code],
            ['Position', r.position_id],
            ['License level', r.license_level]
        ];
        const next = `Command review contacts every candidate within 48 business hours at ${r.phone || r.email}. Keep your reference code handy; it identifies your file.`;
        return {
            subject,
            text: `${firstName},\n\nYour application to ${site.name} was received.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${next}\n\nQuestions: ${site.phone.display} · ${site.email}`,
            html: emailShell({
                title: 'Your application was received',
                intro: `${escapeHtml(firstName)}, your officer application is on file with ${escapeHtml(site.name)}.`,
                rows,
                outro: `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#a8a29e">${escapeHtml(next)}</p><p style="margin:0;font-size:14px;color:#a8a29e">Questions: <a href="tel:${site.phone.e164}" style="color:${GOLD}">${escapeHtml(site.phone.display)}</a> · <a href="mailto:${site.email}" style="color:${GOLD}">${escapeHtml(site.email)}</a></p>`
            })
        };
    }

    const eta = responseWindow(priority);
    const subject = `Request received — dispatch reference ${r.ref_code}`;
    const rows = [
        ['Reference', r.ref_code],
        ['Division', r.service_division],
        ['Location', r.deployment_location],
        ['Schedule', r.schedule]
    ];
    const steps = [
        `A commanding officer reviews your request and contacts you within ${eta} at ${r.phone || r.email}.`,
        'We confirm scope, officer count, armed level, and timing, then send a formal proposal for your approval.',
        `If this is urgent, do not wait for the callback — dial dispatch at ${site.phone.display}.`
    ];
    return {
        subject,
        text: `${firstName},\n\nYour security detail request was received by ${site.name}.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nWhat happens next:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n24/7 dispatch: ${site.phone.display}\n${site.email}`,
        html: emailShell({
            title: 'Your request is with dispatch',
            intro: `${escapeHtml(firstName)}, your security detail request was received. Your dispatch reference is <strong style="color:${GOLD};font-family:'JetBrains Mono',monospace">${escapeHtml(r.ref_code)}</strong>.`,
            rows,
            outro:
                `<p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${GOLD};font-weight:800">What happens next</p>` +
                `<ol style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.7;color:#a8a29e">${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>` +
                `<p style="margin:0"><a href="tel:${site.phone.e164}" style="display:inline-block;background:${GOLD};color:#050504;font-weight:800;padding:12px 20px;border-radius:8px;text-decoration:none">24/7 Dispatch ${escapeHtml(site.phone.display)}</a></p>`
        })
    };
}
