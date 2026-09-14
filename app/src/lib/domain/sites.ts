/* A quote's or job's site must belong to its client. The site's address, access
   notes and tax rate flow into the brief and the invoice, so another client's
   site on a job is wrong data sent to the wrong people. One pure rule, applied
   by every action that saves a site, with the words the owner reads. */

/** Why this site cannot go with this client, or null when it can. `site` is
    undefined when no lookup was needed (no site chosen) and null when the
    lookup found nothing. */
export function siteClientProblem(siteId: string | null | undefined, clientId: string, site: { client_id: string } | null | undefined): string | null {
    if (!siteId) return null;
    if (!clientId) return 'Choose a client before choosing a site.';
    if (!site) return 'That site no longer exists. Choose another site, or none.';
    if (site.client_id !== clientId) return "That site belongs to a different client. Choose one of this client's sites, or none.";
    return null;
}
