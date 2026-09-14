'use client';

/* The client and site selects for quotes and jobs, kept consistent. Sites used
   to load only from ?client=, so picking a client in the form left the site
   list empty or stale. Here the site list follows the chosen client without a
   reload (unsaved form entries survive), and a site from the previous client
   is cleared. With no client chosen every site shows, grouped by client — also
   what works before hydration. The server re-checks the pair on save
   (lib/domain/sites.ts), so this is convenience, not the rule. */

import { useState } from 'react';
import { Field } from '@/components/ui';

export type PickerClient = { id: string; name: string };
export type PickerSite = { id: string; name: string; client_id: string };

export function ClientSitePicker({
    clients,
    sites,
    defaultClientId,
    defaultSiteId,
    siteLabel = 'Site',
    siteHint,
    noSiteLabel = 'No site'
}: {
    clients: PickerClient[];
    sites: PickerSite[];
    defaultClientId?: string | null;
    defaultSiteId?: string | null;
    siteLabel?: string;
    siteHint?: string;
    noSiteLabel?: string;
}) {
    const [clientId, setClientId] = useState(defaultClientId ?? '');
    const [siteId, setSiteId] = useState(defaultSiteId ?? '');
    const clientSites = sites.filter((s) => s.client_id === clientId);

    const chooseClient = (next: string) => {
        setClientId(next);
        if (siteId && !sites.some((s) => s.id === siteId && s.client_id === next)) setSiteId('');
    };

    return (
        <>
            <Field id="client_id" label="Client">
                <select id="client_id" name="client_id" value={clientId} onChange={(event) => chooseClient(event.target.value)} required>
                    <option value="">Choose a client…</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </Field>
            <Field id="site_id" label={siteLabel} hint={clientId && !clientSites.length ? 'This client has no sites yet. Add one on the client page.' : siteHint}>
                <select id="site_id" name="site_id" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
                    <option value="">{noSiteLabel}</option>
                    {clientId
                        ? clientSites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)
                        : clients
                              .filter((c) => sites.some((s) => s.client_id === c.id))
                              .map((c) => (
                                  <optgroup key={c.id} label={c.name}>
                                      {sites.filter((s) => s.client_id === c.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                  </optgroup>
                              ))}
                </select>
            </Field>
        </>
    );
}
