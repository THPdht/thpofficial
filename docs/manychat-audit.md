# ManyChat audit — THP Instagram automation

Audited 2026-08-05, repaired and verified end to end 2026-08-06. Supersedes `instagram-manychat-handoff.md`, which stays as history.

---

## Who does what

**ManyChat is the product. The site is not the bot.**

ManyChat owns everything a person experiences: the trigger, every word sent, the timing, the
branching, the follow-ups, and the on/off switch. If the site were unreachable, the flow would
still run — it would just have to guess at the one hard question.

The site does exactly two things:

1. **One judgement call.** `POST /api/manychat/qualify`, once per conversation: *is this person
   working, and from a high-income country?* It answers `qualified` or `not_qualified`. It holds
   no state, remembers nobody, sends no messages, and cannot start a conversation.
2. **The memory.** Every decision lands in the `ig_qualifications` table — what they said, what
   was read out of it, which way they went, and why. ManyChat forgets; this doesn't. Ali reads it
   at `/admin` → Instagram.

**One decision, and a receipt for it.** Anything that is not those two things belongs in ManyChat.

There is no site-side off switch, by design. Two systems that can each claim to have stopped the
automation is exactly how "the bot is off but it isn't" happened. **To pause the automation, pause
the flow in ManyChat.**

---

## Account inventory

Pulled from the ManyChat API with `MANYCHAT_API_KEY`. Reproduce with:
`curl -s https://api.manychat.com/fb/page/getInfo -H "Authorization: Bearer $MANYCHAT_API_KEY"`

| | |
|---|---|
| Account | `Thehormoneprophet` (id `fb5357501`) |
| Plan | Pro — **on the trial**, the badge in the sidebar reads `TRIAL` |
| Timezone | Africa/Casablanca |
| Tags | `qualify-open` (93522505) · `qualify-busy` (93587383) |
| Growth tools | **none** |

### Flows

Split in two because Instagram will not let a comment-triggered flow run a whole conversation.

| Flow | Trigger | Status |
|---|---|---|
| `THP-Qualify-Opener` | User comments on Post or Reel (`Post or Reel Comments #2 copy`) | LIVE |
| `THP-Qualify-Full-Step` | **User sends a Direct Message — Default Reply**, every time | LIVE |
| `THP-Qualify.V1` | none — superseded by the two above | DRAFT |

**Why it is built this way.** Meta allows exactly one Private Reply in response to a comment, and
nothing may follow it — no send, no Go To Flow. Setting the node to 24-hour messaging lets you
attach a next step in the editor, but publishing fails ("must be a private message"), and switching
back deletes the connection. So the conversation *has* to restart on a separate trigger once the
person replies, which opens the 24-hour window. The split is correct; Default Reply as the join is
what needs guarding.

### Two tags do the guarding — implemented and verified 2026-08-06

Default Reply fires on *any* DM from *anyone*. Two tags keep the funnel from touching people it
shouldn't, and from running twice on people it should.

| Tag | Added by | Removed by | Purpose |
|---|---|---|---|
| `qualify-open` | Opener, before the Private Reply | all three terminal branches of flow 2 | proves this person commented a keyword |
| `qualify-busy` | flow 2, Actions #1 | all three terminal branches, **and the Opener on entry** | blocks re-entry while a conversation is in progress |

Condition #2, the first step after the trigger, requires **`qualify-open` AND NOT `qualify-busy`**.
Friends, clients and story replies carry neither tag and fall out silently.

**Why `qualify-busy` exists.** AI Step 2 waits inside the flow for the demographic answer. Without
the guard, that answer *also* re-triggers Default Reply from the top, re-entering the flow and
blanking all four fields mid-conversation — two instances racing over the same state.

**Why the Opener removes it.** Someone who abandons mid-conversation would otherwise keep
`qualify-busy` forever and never be able to enter again. The Opener clears it, so commenting a
keyword again always gets them back in. No timer, nothing to drift.

### The bug this replaced — worth understanding before changing anything

Until 2026-08-06 AI Step 1's first task said *"wait for the person's reply about their symptoms."*
But that reply is what triggers flow 2 — it is consumed as the trigger event, so the step waited for
a message that had already arrived and parked forever.

Observed live: a lead wrote *"I got libido problems and I want to optimise it"* and got nothing. He
later sent "Hello"; the parked step woke on **that**, classified him FAN, and sent him the fan
message. A qualified lead dismissed with "appreciate you supporting boss."

The fix: Actions #1 writes `Last Text Input` into `thp_reply`, and AI Step 1 classifies that field
instead of waiting. **Anything that reintroduces a wait into AI Step 1 reintroduces this bug.**

**Stale fields.** Custom fields follow the contact forever, across flows and conversations. Actions
#1 blanks all four on entry, before writing `thp_reply`. Order matters — clear first, then write.

### Custom fields

| Field | Written by | Read by |
|---|---|---|
| `thp_classification` | AI Step 1 | Condition (contains `ENGAGED`) |
| `thp_demographics` | AI Step 2 | External Request body |
| `thp_qualification` | External Request response mapping (`$.status`) | Condition #1 (`is qualified`) |
| `thp_reply` | **Actions #1** — `Set User Field` from `{{Last Text Input}}` | **AI Step 1** classifies it |

---

## The flow

```
FLOW 1 — THP-Qualify-Opener   (trigger: comment on any Post or Reel contains a keyword)
  └─ Actions ... Add Tag qualify-open · Remove Tag qualify-busy
       └─ Send Message (PRIVATE REPLY) ... asks for symptoms / optimisation goal
          nothing may follow a Private Reply — the flow ends here by Meta's rule

FLOW 2 — THP-Qualify-Full-Step   (trigger: Default Reply, every time)
  │
  └─ Condition #2: has qualify-open AND NOT qualify-busy      ──no──► exit, silent
       │
       ├─ Actions #1 ... blank all four fields
       │                 → Add Tag qualify-busy
       │                 → Set thp_reply = {{Last Text Input}}   ◄── the symptom reply
       │
       ├─ AI Step 1 .... classifies thp_reply → thp_classification   (never waits, never sends)
       │
       └─ Condition: thp_classification contains ENGAGED
            │
            ├─ YES → Send Message #1 ... asks age / country / work / student / married
            │          │
            │          ├─ AI Step 2 .... waits for the answer → thp_demographics
            │          │
            │          ├─ Actions ...... blank thp_qualification → External Request → the site
            │          │                 ◄── the only site call
            │          │
            │          └─ Condition #1: thp_qualification is qualified
            │               ├─ YES → Send Message #2 (Telegram, t.me/THPprotocol)
            │               │          └─ Actions #3 ... remove both tags
            │               │                            assign to Ali · Notify Assignees (e-mail)
            │               └─ NO  → Send Message #3 (the course)
            │                          └─ Actions #4 ... remove both tags
            │
            └─ NO  → Send Message #4 (fan: YouTube @THPDIGITAL + Skool)
                       └─ Actions #2 ... remove both tags
```

**Ali is notified only on the qualified branch.** Actions #3 assigns the conversation to Ali Filali
and fires `Notify Assignees` by e-mail: *"QUALIFIED lead on Instagram: {{Username}}"*, with the
View-in-Inbox button on. Nothing notifies him on the other two branches, by design.

### The one call to the site

```
POST https://thpofficial.com/api/manychat/qualify
Headers: Content-Type: application/json
         x-manychat-secret: <MANYCHAT_WEBHOOK_SECRET from .env.local>
Body:    { "demographics": {{thp_demographics}},
           "subscriber_id": {{Contact Id}},
           "ig_username":   {{Username}} }
Response mapping: $.status → thp_qualification
```

Verified 2026-08-05: URL, both headers and all three pills resolve correctly in ManyChat's preview
(`subscriber_id: "912071791"`, `ig_username: "tazimanian"`).

**Reply is always `{"status":"qualified"}` or `{"status":"not_qualified"}`, HTTP 200.** The only
non-200 is `401` for a bad secret. Empty input, a raw `{{token}}`, a model outage, a timeout or any
unhandled error all answer `not_qualified` — sending a stranger to Ali's personal Telegram costs
more than sending a good lead to the course.

### The rule

`qualified` requires **both**: the person is **working** (not a student, not unemployed) **and**
their country is **high-income** — US, Canada, UK, Ireland, Western Europe, Scandinavia, Australia,
New Zealand, and the Gulf states (UAE, Qatar, Saudi, Kuwait, Bahrain, Oman).

Age and marital status are recorded but **do not affect the outcome**. Anything the person did not
clearly state stays `unknown`, and `unknown` fails the rule.

Claude extracts the facts; the rule itself is one line of code in the route, so it can be read and
cannot drift.

---

## The trigger — `Post or Reel Comments #2`

- **Scope:** All Posts or Reels
- **Match:** *Comments **include** these Keywords* — `Brain`, `Ego`, `Balls`, `Dome`
- **Public comment reply**, rotated: "sup boss! check your dm" / "bossman check your dm" /
  "just texted you on dm" / "brotha check your dm"

**`include` is substring matching, not whole-word.** The comment only has to *contain* the keyword:

| keyword | also fires on |
|---|---|
| `Ego` | Di**ego**, L**ego**, cat**ego**ry, ju**ego**, lu**ego** |
| `Dome` | **dome**stic, **Dome**nic |
| `Balls` | foot**balls**, basket**balls** |
| `Brain` | **brain**s, **brain**y, no-**brain**er (harmless — same intent) |

This is a milder version of the failure where the keyword `T` matched every comment containing
"great" or "thanks". `Diego` is the realistic one — someone tagging a friend by name gets pulled
into the funnel. ManyChat offers exact matching per keyword, which costs nothing in workflow but
means `Brain 🔥` no longer fires. Trade-off, not a bug — decide per keyword.

## The AI Steps

**AI Step 1 — classify the symptom reply** (rewritten 2026-08-06 — it must never wait)

> Goal: Classify text that has already been received. Do not wait for a new message. Never send a
> message.

- One task — classify strictly `ENGAGED` or `FAN` → **saves `thp_classification`**. The task text
  ends: *"The text to classify is already stored in the field thp_reply. Do not wait for any
  input."*
- The old Task 1 (wait for and capture the reply into `thp_reply`) was **deleted**. `thp_reply` is
  now filled by Actions #1 instead. Do not put a waiting task back into this step.
- Context: names it an Instagram comment-to-DM funnel about testosterone/health optimisation.

**AI Step 2 — capture the demographic answer** (unchanged; it is correct to wait here, because
`qualify-busy` stops the answer re-triggering the flow)

> Goal: Wait for the person's reply to the demographic question. Save whatever response they type
> directly to custom fields. Do NOT generate or send any text response yourself under any
> circumstances.

- One task — wait, save verbatim, never prompt for missing details → **saves `thp_demographics`**

Both steps are configured to write only, never to speak. That matters: the site's qualifier reads
`thp_demographics` raw, and an AI Step that "helpfully" rewrote the answer would change what gets
judged.

## Not verified word for word

- The exact wording of Send Message #1, #2, #3 and #4 (read from canvas screenshots, truncated).

---

## Proven end to end — 2026-08-06

Two real conversations, both from a first-reply symptom sentence, both logged with a real
`subscriber_id` in `ig_qualifications`:

| Contact | What they typed | Result |
|---|---|---|
| `luko.only` | "I'm from Florida and I'm 36, I work with life insurance and I'm happily married" | `qualified` — no stated disqualifier |
| `edwin_baggens` | "I am 20 years from Malaysia and I am single but i train everyday" | `not_qualified` — country: Malaysia (other) |

Both finished with **no tags left on the contact**, so both exits fired cleanly and both accounts
were immediately reusable.

## Resetting a test account

A contact is "used" only by its two tags and four custom fields. Wipe both and the funnel treats
them as new — no fresh Instagram account needed. Needs `MANYCHAT_API_KEY` from `.env.local`.

```bash
SID=<subscriber_id>
H="Authorization: Bearer $MANYCHAT_API_KEY"; J="Content-Type: application/json"
# tags: qualify-open=93522505  qualify-busy=93587383
for TAG in 93522505 93587383; do
  curl -s -X POST https://api.manychat.com/fb/subscriber/removeTag -H "$H" -H "$J" \
    -d "{\"subscriber_id\":$SID,\"tag_id\":$TAG}"; done
# fields: thp_reply thp_classification thp_demographics thp_qualification
for F in 14833057 14840025 14840104 14840127; do
  curl -s -X POST https://api.manychat.com/fb/subscriber/setCustomField -H "$H" -H "$J" \
    -d "{\"subscriber_id\":$SID,\"field_id\":$F,\"field_value\":null}"; done
```

Known subscriber ids: `luko.only` 590456933 · `edwin_baggens` 184188618 · `tazimanian` 912071791.
`findByName` is broken for Instagram contacts — it returns 0 results even for a contact that reads
fine by id. Get new ids from the Audience tab URL.

## Open items

1. **Keyword substring matching.** `include` matches substrings: `Ego` fires on **Diego**, Lego,
   category; `Dome` on domestic. Someone tagging a friend named Diego gets pulled into the funnel.
   Exact matching is available per keyword but would stop `Brain 🔥` firing. **Decision 2026-08-06:
   keep the keywords as they are.** Revisit if it misfires at real volume.
2. **The account is on the Pro trial**, card on file, set to auto-upgrade. External Request and both
   AI Steps are Pro features. If that charge ever fails they stop silently, `thp_qualification`
   stays empty, and every lead falls to the course branch with no error.
3. **The fan branch has not been retested since the AI Step 1 rewrite.** Qualified and not-qualified
   both pass. A pure-fan reply is the untested path — and it is the one that misfired on the client.
4. **A reply arriving more than 24 hours after the opener** cannot be answered; Instagram closes the
   messaging window and flow 2 can send nothing.
5. **The endpoint fails closed.** Timeout, model outage, unreachable host — all answer
   `not_qualified`, so a good lead gets the course instead of Ali's Telegram. Deliberate: a stranger
   in Ali's personal Telegram costs more than a good lead getting the course. Visible in the log —
   the `reason` column shows the failure rather than a real country.

## Site-side state as of this audit

- `/api/manychat/qualify` — live, verified against production.
- `/api/manychat/log` — admin-only GET, feeds the panel.
- `/api/manychat/reply` and `/api/manychat/admin` — **deleted.** They served the retired bot and
  could still have sent DMs to real followers.
- `ig_campaigns`, `ig_contacts`, `ig_conversations` — tables kept; they hold real leads and
  transcripts. Nothing reads them any more.
- `/admin` → Instagram is now a read-only decision log with no controls on it.
