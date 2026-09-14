import type { ReactNode } from 'react';

/* One list primitive for every screen (SPEC-012). Below 600px each row is a
   card: the primary cell is the title and its first link is stretched over the
   card, so the whole card is the tap target; every other cell becomes a
   label/value line read from data-label. From 600px it is an ordinary table.

   The explicit ARIA roles are deliberate, not redundant. The phone layout
   changes the display value of table elements, and some browsers (Safari with
   VoiceOver above all) then stop exposing them as a table. Restating the roles
   keeps "row 3 of 12, column Status" available at every width. */

export type Column<T> = {
    key: string;
    /** Column header, and the label beside the value on a phone card. Empty for an actions column. */
    header: string;
    cell: (row: T) => ReactNode;
    /** Exactly one per table: the phone card's title. Put the row's link in this cell. */
    primary?: boolean;
    /** Money and counts: right-aligned, tabular figures. */
    num?: boolean;
    /** Hide below 600px ('phone') or below 1024px ('tablet'). */
    hide?: 'phone' | 'tablet';
    /** Prose (a review, a message body): on a phone card it spans the card,
        left-aligned under its label, instead of a right-aligned value. */
    wide?: boolean;
};

export function DataTable<T>({
    caption,
    columns,
    rows,
    rowKey,
    flush
}: {
    /** Names the table for screen readers; not shown. */
    caption: string;
    columns: Column<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    /** Inside a card that already draws a surface: no second border on tablet/desktop. */
    flush?: boolean;
}) {
    return (
        /* From 600px a wide table may scroll inside this wrapper; a scrollable
           region must be reachable by keyboard (axe scrollable-region-focusable). */
        <div className={`dt-wrap${flush ? ' dt-wrap--flush' : ''}`} role="region" aria-label={caption} tabIndex={0}>
            <table className="dt" role="table">
                <caption>{caption}</caption>
                <thead role="rowgroup">
                    <tr role="row">
                        {columns.map((column) => (
                            <th key={column.key} role="columnheader" scope="col" data-num={column.num || undefined} data-hide={column.hide}>
                                {column.header || <span className="visually-hidden">Actions</span>}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody role="rowgroup">
                    {rows.map((row) => (
                        <tr key={rowKey(row)} role="row">
                            {columns.map((column) => (
                                <td
                                    key={column.key}
                                    role="cell"
                                    data-label={column.header}
                                    data-primary={column.primary || undefined}
                                    data-num={column.num || undefined}
                                    data-hide={column.hide}
                                    data-wide={column.wide || undefined}
                                >
                                    {column.cell(row)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
