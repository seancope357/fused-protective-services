# SPEC-013 — Free owner alerts over Telegram (replacing Twilio on the owner path)
**Gate:** GO_LIVE.md → B3 · **Surface:** both (api/ + portal + migration)
**Size:** M · **Depends on:** — · **Human blocker:** a bot token + chat ids (2 min in the Telegram app)

> ## ⏸ PARKED 2026-10-07 — resume from branch `feat/telegram-owner-alerts`
>
> Sean's call: camp this and come back to it. The branch holds a **WIP commit that does
> not typecheck** (deliberately committed that way so nothing was lost — see *Where it
> stopped*). `main` is clean and green; nothing here is on `main`.
>
> Decision already made: **Telegram**, chosen over ntfy.sh, Pushover and
> email-to-SMS carrier gateways. Do not re-litigate the channel without new information.

---

## Why

A2P 10DLC brand registration (GO_LIVE **B3**) needs Cameron's EIN and takes business days.
It was the longest pole on the launch path, and the GO_LIVE launch sequence starts with it
on "Day −10".

But look at what SMS is actually used for. There are exactly three rules with an `sms`
channel in `app/src/lib/notifications/templates.ts`:

| Trigger | Audience | Channels |
| :--- | :--- | :--- |
| `lead_unanswered_2h` | **owner** | `['sms']` |
| `proposal_accepted` | **owner** | `['email', 'sms']` |
| `job_reminder_24h` | **client** | `['email', 'sms']` |

The first two are the business paging **itself**. No carrier registration, no consumer
consent, no STOP list is legally required to text your own phone. Only the third is A2P
messaging to a consumer, and that one already sends an email as well.

So routing the two owner rules over Telegram removes 10DLC from the launch critical path
entirely, for free, and costs nothing in capability. `api/intake.mjs`'s emergency alert is
the same case.

**Evidence from production (2026-10-07):** `notifications` holds 166 `lead_unanswered_2h`
rows, every one `status=skipped`, `error=no_sms_recipient` — the owner page has never once
been delivered because Twilio has never been configured.

## Scope

**In**
- A Telegram Bot API transport in `api/_lib/`, same contract as the other transports.
- A `push` notification channel, end to end: types, engine, log, migration, portal Settings.
- The two **owner** rules switch from `sms` to `push`.
- `api/intake.mjs` emergency owner alert switches to push.

**Out — binding**
- **Client-facing SMS stays on the `sms` channel and stays unconfigured.** It must keep
  logging an honest `not_configured` skip. Texting a consumer is exactly what 10DLC
  governs; nothing in this spec routes a client message over a free channel.
- Removing the SMS-consent checkbox or `sms-consent.html`. Sean's standing decision is to
  keep them for a future 10DLC (see *Open decisions*).
- Deleting `api/_lib/sms.mjs`. Twilio stays in place so 10DLC can be switched on later
  with environment variables and no code change.
- Telegram as a *client* channel, inbound Telegram, or two-way chat.

## Design

Telegram Bot API over plain `fetch`, no SDK (invariant 3). One module,
`api/_lib/push.mjs`, mirrored into the portal by `scripts/sync-shared.mjs` like every
other shared transport.

```
TELEGRAM_BOT_TOKEN        from @BotFather
TELEGRAM_ALERT_CHAT_IDS   comma-separated chat ids (Cameron, Sean, or a small group)
```

Three deliberate choices:

1. **A new `push` channel, not a redefined `sms` channel.** Swapping the body of
   `sendSms` would send a *phone number* to Telegram as a `chat_id` on the client
   reminder path — garbage, and it would silently break the one rule that must stay
   honest. A separate channel keeps client SMS correct-by-construction.
2. **No `parse_mode`.** Messages are plain text. Lead names and client notes flow into
   these bodies; Markdown or HTML parse modes would let an underscore or apostrophe in a
   real name break the send or inject formatting. This is a safety property, not an
   oversight — keep it and say why in the code.
3. **`rule.push` falls back to `rule.sms`.** The owner SMS copy is already a short page,
   so no owner rule needs a second template. Smaller diff, one copy to maintain.

## Acceptance

1. `pushConfigured()` is false with no token and `sendPush` returns `{configured:false, ok:false}` — never throws.
2. A Telegram API rejection returns `{configured:true, ok:false, error:'telegram_<code>'}` and **the bot token never reaches a log line**.
3. `lead_unanswered_2h` and `proposal_accepted` deliver to every id in `TELEGRAM_ALERT_CHAT_IDS`, logged `channel='push'`, `provider='telegram'`.
4. `job_reminder_24h` still logs `channel='sms'`, `status='skipped'`, `error='not_configured'` — the client path is untouched and honest.
5. An owner rule with no chat id configured logs **one** row carrying a dedupe key, not one per hour (the `f814565` regression must not come back).
6. `api/intake.mjs` emergency alert uses push; `notify-log.mjs` records it as `channel='push'`.
7. Portal → Settings → integrations shows a Telegram row with its real configured state.
8. The migration widens the `notifications.channel` CHECK to include `push`; `pnpm test:db` green.
9. Outside production nothing is dispatched and the row still reads `non_production_env` (SPEC-002 holds).

## Test plan

- `app/tests/notifications.test.ts` — push routing for owner rules, the client-SMS skip is unchanged, the no-recipient dedupe key, and the `(none)` fallback.
- A transport unit test with `fetch` stubbed: success, API rejection, network throw, and an assertion that the token appears in no console output.
- `app/tests/db/` — an insert with `channel='push'` succeeds and a bogus channel is still rejected.
- Manual, once a token exists: trigger an emergency intake and watch the phone.

## Files

| File | State on the branch |
| :--- | :--- |
| `api/_lib/push.mjs` | ✅ **written** — transport complete, documented |
| `supabase/migrations/20261007000000_notifications_push_channel.sql` | ✅ **written** — additive CHECK widening, not applied anywhere |
| `app/src/lib/notifications/templates.ts` | ◐ `Channel` widened to include `'push'`, `Rule.push?` added. **Owner rules not yet switched** |
| `app/src/lib/transports.ts` | ❌ must re-export the push transport |
| `app/src/lib/notifications/log.ts` | ❌ `LogInput.channel` still `'email'\|'sms'` — **this is what fails typecheck**; also needs `provider` → `telegram` |
| `app/src/lib/notifications/engine.ts` | ❌ recipient resolution for `push`; a `sendOne` push branch that skips the SMS consent/STOP gates (owner self-notification) |
| `app/src/lib/notifications/index.ts` | ❌ `ownerContacts()` must return push targets; add `sendPush` to `deps` |
| `api/intake.mjs`, `api/_lib/notify-log.mjs` | ❌ emergency alert + its log row |
| `app/src/app/portal/settings/page.tsx` | ❌ integrations row (currently hardcodes `TWILIO_* variables`) |
| `docs/RUNBOOK.md` §3, §9 · `docs/GO_LIVE.md` B3 · `docs/OPEN_QUESTIONS.md` §10 | ❌ 10DLC stops being a launch blocker — say so |

## Where it stopped

Exactly one thing is broken, and it is mechanical: `Channel` in `templates.ts` now
includes `'push'`, but `LogInput` in `log.ts` still declares `channel: 'email' \| 'sms'`,
so `tsc` fails with:

```
Type 'Channel' is not assignable to type '"email" | "sms"'.
  Type '"push"' is not assignable to type '"email" | "sms"'.
```

Resume by widening `LogInput.channel` to `Channel` and working down the Files table.
`app/tests` were green (204 passed) even while typecheck failed, because no rule routes
to `push` yet — so **do not take a green test run as evidence**; run `pnpm typecheck`.

## Open decisions

1. **The client reminder and the SMS-consent checkbox.** Recommendation, and Sean's
   standing choice 2026-10-07: drop client SMS from launch (the email reminder still
   goes), and **keep** the consent checkbox and `sms-consent.html` so a future 10DLC
   needs no re-work. The alternative — removing them to take one page off the attorney's
   desk (GO_LIVE A3) — was offered and not taken. Revisit only if legal review cost
   becomes the blocker.
2. **Who receives the page.** Cameron alone, or Cameron + Sean during the first weeks?
   Recommendation: both at launch, then drop Sean. It is one environment variable.
3. **Group chat vs direct messages.** A single group chat is easier to audit and to add
   people to; direct messages are harder to leak. Recommendation: direct chat ids, because
   lead names and phone numbers appear in the body.
4. **Does Cameron actually have Telegram, with notifications allowed through Do Not
   Disturb?** This is the one real risk in the whole spec — a free channel nobody looks at
   is worse than an SMS. Confirm on his phone before ticking B3.
