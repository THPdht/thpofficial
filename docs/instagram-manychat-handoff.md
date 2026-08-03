# Instagram Automation — Full Handoff

**Purpose of this document:** hand the ManyChat side to a fresh agent to build as a standalone product. It records what exists, what was tried, exactly how each attempt failed, and what the ManyChat build must guarantee. Read the failure history before designing anything — every failure below reached real people, and four of them happened in front of the paying client.

**Status as of 2026-08-03:** the site half is built, deployed and tested. The ManyChat half is wired incorrectly and is the current blocker. All automations should be **Stopped** until rebuilt.

---

## 1. The business goal

The Hormone Prophet (THP / Ali Filali) is a men's hormone coach. He posts Instagram reels with a call to action: *"comment THP"*. The automation should:

1. Notice the comment, publicly reply ("check your DM"), and open a DM.
2. Ask what's going on with them — symptoms, or just wanting to optimise.
3. Read their answer:
   - Symptoms or wanting to optimise → send the application link (`thpofficial.com/apply`) and notify Ali.
   - Just a fan, no symptoms → thank them, point at YouTube, stop. (A delayed YouTube nudge is desired but not built.)
   - A question, or anything unclear → say nothing more, notify Ali, let him answer by hand.
4. Never speak to anyone who did **not** comment a keyword.
5. Never pitch an existing paying client or someone who already applied.
6. Never reveal it is automated. Every line is written in Ali's first person and sent from his account.

Active keywords: **THP**, **Identity**, **Psyche**. Only THP is meaningfully configured (see §6).

---

## 2. Architecture as built

Two halves.

**ManyChat** — watches Instagram, receives comments and DMs, sends messages. Holds no logic.

**thpofficial.com** — the decision maker. ManyChat asks it what to say; it answers with text, or with nothing. It also remembers every contact, logs transcripts, recognises clients, and notifies Ali.

Endpoint: `POST https://thpofficial.com/api/manychat/reply`
Auth: header `x-manychat-secret`, value in the project's `.env.local` as `MANYCHAT_WEBHOOK_SECRET`. Wrong or missing → HTTP 401.

### Request the site accepts

It reads whichever of these names are present, so both a hand-built body and ManyChat's own contact payload work:

| Meaning | Accepted keys, in priority order |
|---|---|
| Contact id | `subscriber_id`, `id`, `key`, `user_ns` |
| Instagram handle | `ig_username`, `username`, `user_name` |
| First name | `first_name`, `name` |
| Their message | `message`, `last_input_text`, `last_text_input`, `text` |
| Campaign keyword | `keyword` |
| Optional link override | `resource_url` |

**Critical:** any value that still contains `{{` or `}}` is treated as **missing**. ManyChat sends raw tokens when a field has no value (e.g. `last_input_text` for someone who has only ever commented, never DM'd). This is normal ManyChat behaviour, not a misconfiguration.

**Critical:** the presence of `keyword` is how the site distinguishes "this person answered a call to action" from "this person just messaged us". The comment automation must send it. The DM automation must **not**.

### Response the site returns

ManyChat v2 dynamic block format:

```json
{
  "version": "v2",
  "content": {
    "messages": [ { "type": "text", "text": "..." } ],
    "actions": [
      { "action": "set_field_value", "field_name": "thp_reply", "value": "..." },
      { "action": "add_tag", "tag_name": "needs-human" }
    ]
  },
  "reply": "all messages joined by blank lines"
}
```

- `content.messages` is **empty** whenever the site wants silence. This is the normal, frequent case.
- `reply` is a convenience mirror of the same text, empty when silent.
- Tags used: `needs-human` (Ali should take over), `yt-nudge` (not a fit; hook for a delayed YouTube follow-up).
- Instagram DMs use **bare URLs in text**, never URL buttons — Meta rejects button payloads on IG far more often, and a rejected button fails the whole send.

---

## 3. Complete decision table

Evaluated strictly in this order. The first match wins. `stage` is stored per contact.

| # | Condition | Result |
|---|---|---|
| 1 | Global `bot_enabled = false` | **Silence** |
| 2 | `bot_paused` on this contact | **Silence** |
| 3 | `test_mode` on and handle not in `test_usernames` | **Silence** + notify Ali |
| 4 | Handle belongs to an existing client or past applicant | **Silence** + tag `needs-human` + pause thread + notify |
| 5 | No usable message and stage is past first contact | **Silence** |
| 6 | No `keyword` and stage is `new`/`organic` (never answered a CTA) | **Silence** + notify Ali. Stage → `organic` |
| 7 | Stage `new`/`organic` **with** a keyword | **Opener sent.** Stage → `link_sent` |
| 8 | Has a keyword but stage is past `link_sent` (commented again) | Resend the campaign link if one exists, else **silence** + notify |
| 9 | Stage `link_sent`, campaign has no link, message present | **AI classifies the reply** → see below |
| 10 | Anything else | Email regex → capture as lead; otherwise classify → hand to Ali |

### Step 9 — the only judgement call in the system

An AI call classifies the reply into one of five buckets. **It never writes any text.** Every outgoing message is a fixed string from the database.

| Classification | Result |
|---|---|
| `symptoms` | Application pitch + link. Stage → `lead`. Notify Ali with their words. |
| `optimizing` | Same as symptoms. |
| `not_a_fit` | Thanks + YouTube line. Tag `yt-nudge`. Stage → `closed`. |
| `question` | Holding line ("give me a bit"), pause thread, notify Ali. |
| `other` / AI error / no API key | **Silence**, pause thread, notify Ali. |

Failure always falls toward silence and a human, never toward a pitch. A mistimed sales pitch is the expensive mistake.

Daily cap: 10 AI-classified messages per contact per day, then quiet until tomorrow (does **not** permanently mute).

### Stages

`new` → `organic` (messaged without ever commenting) → `link_sent` (opener sent) → `lead` (pitched) / `closed` (not a fit) / `applied` / `client`.

---

## 4. Data model (Supabase, project `mzqguefjrsvpgycutanu`)

Schema file: `docs/instagram-schema.sql`. All tables have RLS enabled with **no policies** — service-role access only, since they hold lead emails.

- **`ig_campaigns`** — one row per keyword, *not* per post. `keyword`, `resource_url` (optional), `dm_copy`, `post_url`, `active`.
- **`ig_contacts`** — one row per ManyChat subscriber. `subscriber_id` (PK), `ig_username`, `first_name`, `email`, `keyword`, `stage`, `bot_paused`, `turns_today`, `turns_date`, `holding_sent_at`.
- **`ig_conversations`** — full transcript, `role` = `user`/`bot`, plus `intent` and `keyword` for attribution.
- **`ig_settings`** — single row. `bot_enabled`, `test_mode` (**defaults true**), `test_usernames`, and the four editable messages: `opener_copy`, `apply_copy`, `not_a_fit_copy`, `holding_copy`.

Blank message field → built-in default. `{link}` in `apply_copy` marks where the application URL goes; if absent the link is appended on its own line.

### Admin UI — `thpofficial.com/admin` → Instagram tab

Test mode toggle + allowlist; the four Messages; Campaigns; Leads; full Inbox; global bot on/off; per-contact pause. Edits take effect on the next message with no deploy.

---

## 5. Failure history — read this before designing

Every one of these reached real people.

### Failure 1 — the letter "T" matched every comment
**Setup:** trigger was *"comment **contains** T"* on **all** posts.
**Result:** "T" appears inside "great", "thanks", "this". Nearly every comment on every post triggered a public reply and a DM to strangers.
**Fix:** keyword renamed to `THP`. Trigger still uses "contains" on all posts by the owner's explicit choice — he posts CTAs sporadically and doesn't want to touch ManyChat each time. `THP` doesn't appear inside ordinary English words, so this is acceptable. **A future keyword must be checked against this.**

### Failure 2 — every DM was treated as a new lead
**Cause:** the site fell back to a default opener whenever it didn't recognise a keyword, so the Default Reply automation (which fires on *every* DM) made friends and existing conversations look like fresh leads. Ali's friends were asked about their symptoms.
**Fix:** absence of `keyword` on a first message now means "did not answer a CTA" → total silence. This is why the DM automation must never send a keyword.

### Failure 3 — admin notifications never worked, silently
**Causes, all three at once:** the admin login never registered the service worker, so subscribing awaited `serviceWorker.ready` forever with no error; the toggle hid itself once the browser reported permission granted, leaving no way to retry; and every notification shared one tag so bursts collapsed into one.
**Also:** the installed home-screen app opens `/dashboard` (client view) and an installed PWA has no address bar, so the admin could never reach `/admin` — the only page that can register him. iOS only delivers web push to an installed app.
**Fix:** `/admin` now has its own manifest and installs as a separate "THP Admin" app; SW registers on the login path; toggle stays visible; a **Send test notification** button reports how many admin devices are registered.
**Still outstanding:** 2 admin devices registered, **neither is Ali's phone**.

### Failure 4 — "bot off" did not stop messages *(the current blocker)*
**What happened:** 2026-08-03 12:09 UTC. `bot_enabled = false`, `test_mode = true`, allowlist = one handle. A contact (`rolandforsterfit`) mid-conversation with Ali received the opener from **the previous day**.
**Proven from the database:** the site logged his incoming message and returned **no bot message**. The site behaved correctly.
**Root cause — the thing the ManyChat rebuild must fix:** the flow was *External Request → map `$.reply` into custom field `thp_reply` → Send Message containing `{{thp_reply}}`*. **ManyChat does not clear a custom field when the mapped value is empty — it leaves the previous value in place.** The Send Message step then fired unconditionally and re-sent a day-old message.
**Consequence:** the site's kill switch could never stop ManyChat. Only stopping the automation could.
**Partial fix applied:** the site now explicitly sets `thp_reply` on **every** response, empty included, so the field can never hold a stale value. This is a mitigation, not the real fix.

### Other confirmed bugs, all fixed
- A client commenting a keyword was asked about symptoms then sold the coaching they already pay for — no client lookup existed.
- A recognised client's thread received a holding line every 24 hours, forever.
- The admin thread button read "Bot paused" while the bot was **active**.
- Empty or media-only messages produced a confusing DM **and** permanently muted that contact.
- One Anthropic API error permanently muted a contact.
- Duplicate Instagram handles in the database made the client lookup error out and silently disable itself.
- Handles stored with a leading `@` never matched.
- `/api/generate-onboarding-protocol` accepted an email and payload from **anyone**, overwriting a client's entire 40-field intake. Now requires admin, a signed-in token, or the account password.

---

## 6. Known gaps in the current ManyChat setup

1. **`"keyword": "THP"` is hardcoded** in the comment automation's body. Comments of *Identity* or *Psyche* therefore report as THP. All three get the same opener and attribution is wrong. The keyword should reflect what was actually commented.
2. **Only THP has a campaign row.** Identity and Psyche fall back to the default opener (they work, but with no distinct copy).
3. The DM automation stored one contact as `{{ig_username}}`, i.e. it can send unresolved tokens. The site now discards these.
4. The account is on a **ManyChat Pro trial**. External Request and Dynamic Block are Pro features — everything stops when the trial ends.

---

## 7. What the ManyChat build must guarantee

**Requirement 1 — silence must be possible.** When the site returns zero messages, the contact must receive nothing. This is the requirement the current build fails.

Recommended: replace *External Request → Send Message* with a **Dynamic Block** inside a Send Message step. A Dynamic Block sends exactly what the server returns and nothing when the server returns nothing. It removes the `thp_reply` field entirely.

If Dynamic Block cannot carry custom headers/body in the current UI, the fallback is External Request + a **Condition** step that only sends when `thp_reply` is non-empty. The site already blanks that field on every response, so the condition is reliable.

**Requirement 2 — two separate automations:**
- *Comment trigger* — sends `keyword`.
- *Default Reply / any DM* — sends **no** `keyword`.
The site's protection for friends, clients and strangers depends entirely on this distinction.

**Requirement 3 — body fields must be inserted, not typed.** Use the `{+} Add a Field` picker. The Preview panel must show real values. A typed field name is sent literally.

**Requirement 4 — the public comment reply** is configured on the trigger ("Reply in comments"), not by the site.

**Requirement 5 — the YouTube nudge**, if built, must live in ManyChat: the site can only respond to an incoming message, never start a conversation. Trigger it off the `yt-nudge` tag. **Instagram blocks DMs more than 24 hours after the person's last message** — use ~20 hours, not 2 days, unless using the Human Agent tag.

**Requirement 6 — rate and policy limits:** Instagram private replies are capped around 750/hour. The account must remain Business or Creator, with *Settings → Messages → Connected Tools → Allow Access to Messages* enabled.

---

## 8. Test checklist — must all pass before going live

Run with `test_mode` on and only a test handle allowlisted.

1. Comment the keyword from an allowlisted account → opener arrives, public comment reply appears.
2. Reply with symptoms → application link arrives.
3. Fresh contact, reply "no symptoms, I just like your content" → YouTube line, **no** application link.
4. Fresh contact, reply with a question → holding line, then silence on every following message.
5. **DM the account from an account that never commented → absolutely nothing arrives.** This is Failure 2 and 4's test.
6. With `bot_enabled = false`, comment the keyword → **nothing arrives.** This is Failure 4's test and the one that has never passed.
7. Comment from an account belonging to an existing client → nothing arrives.
8. Send a photo or a reaction with no text → nothing arrives, thread not muted.
9. Ali receives push notifications for steps 2, 4, 5 and 7.

Only after 1–9 pass: empty `test_usernames`, set `test_mode = false`, set `bot_enabled = true`.

---

## 9. Current live state

- Bot: **off**. Test mode: **on**. Allowlist: one handle.
- 16 contacts recorded; 12 real people received the opener on 2026-08-02, Ali replied to them by hand.
- No contacts are muted.
- Client recognition covers 5 of 43 portal accounts. Clients can now add their own Instagram handle from their dashboard, which grows this over time.
- Site code is committed and deployed. Latest commits: `b84d0ac`, `62dbf40`, `dbd430e`, `59c80cd`.

## 10. Open items

- Rebuild both ManyChat automations per §7.
- Ali to install `thpofficial.com/admin` to his home screen and enable notifications; confirm with the test button.
- Decide the ManyChat plan before the Pro trial ends.
- Add campaign rows and distinct copy for Identity and Psyche, and stop hardcoding the keyword.
- Build the `yt-nudge` follow-up (needs a YouTube URL).
