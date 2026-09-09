/* ==========================================================================
   CLIENT REVIEWS — THE ONLY HONEST SOURCE FOR THE SCHEMA.ORG RATING
   ==========================================================================
   The structured data used to assert an AggregateRating of 5.0 from 28
   reviews with nothing on the site to back it. Search engines treat
   unverifiable review markup as a policy violation, so the rating now exists
   only when this list does.

   Phase 1 of the operations platform collects reviews after every job
   (`public.reviews`, with the client's permission to publish). To surface them
   here, export the published rows into this array; `aggregateRating()` then
   derives the figure and the head template emits the markup automatically.
   Never type a rating by hand.

   Each entry: { author, company?, rating (1-5), text, date (YYYY-MM-DD) }.
   ========================================================================== */

export const reviews = [];

/** Derives the schema.org AggregateRating, or null when there is nothing to
    claim. A null return removes the block from the JSON-LD entirely. */
export function aggregateRating(list = reviews) {
    const rated = list.filter((r) => Number.isFinite(r.rating) && r.rating >= 1 && r.rating <= 5);
    if (rated.length === 0) return null;
    const sum = rated.reduce((total, r) => total + r.rating, 0);
    return {
        value: (sum / rated.length).toFixed(1),
        count: String(rated.length),
        best: '5'
    };
}
