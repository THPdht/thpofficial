# Build spec — send delays, and the nudge they create

Status: **site side done and deployed. ManyChat side not yet built.**
Flow: `THP-Qualify-Full-Step`. Pause it before editing; re-enable when finished.

---

## Why

Every bot reply currently lands the instant the person finishes typing, which reads as a machine.
Putting a Smart Delay in front of each Send Message fixes that but opens a window where the bot owes
a reply and hasn't sent it. Anything typed in that window is dropped today: `qualify-busy` fails the
tag gate, and there is no `qualify-done` yet for the follow-up path to catch.

## The idea that keeps it to five nodes

Do **not** tag around each delay. Set `qualify-holding` once at the start and remove it only for the
one moment we genuinely expect a message — while AI Step 2 waits for the demographic answer.

| Holding | When | A message arriving means |
|---|---|---|
| ON | everywhere the bot owes a reply | a nudge → log `during_delay`, no push |
| OFF | between the demographic question and their answer | the answer → AI Step 2 consumes it |

This cannot misfire on a demographics answer, which is what a naive "notify while busy" rule would
do on every single conversation.

## Delays

| Before | Length |
|---|---|
| Send Message #1 (demographic question) | 3 min |
| Send Message #2 (Telegram) | 4 min |
| Send Message #3 (course) | 4 min |
| Send Message #4 (fan) | 4 min |

The opener is a Private Reply and is left alone — Meta's rules around it are what forced the
two-flow split, and it is the one part that has never failed.

## Tags

`qualify-holding` = **93610547** (already created).
Others: `qualify-open` 93522505 · `qualify-busy` 93587383 · `qualify-done` 93591201.

---

## Steps

Safe first (no rewiring), risky second.

### 1. Tag edits — no new nodes

- **Actions #1** — add `Add Tag qualify-holding` (order within the node does not matter).
- **Actions node holding the qualify External Request** — add `Add Tag qualify-holding`.
  This re-arms it after AI Step 2 has finished waiting.
- **Actions #2, #3, #4** (the three exits) — add `Remove Tag qualify-holding`.

### 2. New node: turn holding off while AI Step 2 waits

Insert between **Send Message #1** and **AI Step 2**:

- Actions node, single action: `Remove Tag qualify-holding`

### 3. Four Smart Delays

Insert a Smart Delay immediately before each Send Message, per the table above:

- Condition (`thp_classification contains ENGAGED`) **YES** → Delay 3 min → Send Message #1
- Condition **NO** → Delay 4 min → Send Message #4
- Condition #1 (`thp_qualification is qualified`) **YES** → Delay 4 min → Send Message #2
- Condition #1 **NO** → Delay 4 min → Send Message #3

To insert: open the source node, remove its Next Step link, Choose Next Step → Smart Delay, then
drag the delay's Next Step connector onto the original Send Message.

### 4. The nudge branch

On **Condition #2**'s `If not` path, add another condition group **after** the existing
`has qualify-done` one:

- Condition: `Tag is qualify-holding`
- Yes → Actions node → External Request:

```
POST https://thpofficial.com/api/manychat/followup
Headers: Content-Type: application/json
         x-manychat-secret: <MANYCHAT_WEBHOOK_SECRET>   ← paste by hand
Body:    { "subscriber_id": {{Contact Id}},
           "ig_username":   {{Username}},
           "message":       {{Last Text Input}},
           "kind":          "during_delay" }
No response mapping.
```

`kind: "during_delay"` is a literal string, not a token. It is what suppresses the push.

---

## Expected end state

```
Condition #2: qualify-open AND NOT qualify-busy
  ├─ no ─► has qualify-done?  → yes → Actions #5 → /followup            (pushes Ali)
  │        └─ no → has qualify-holding? → yes → Actions → /followup     (kind=during_delay,
  │                 └─ no → exit, silent                                 logs only, no push)
  └─ yes ─► Actions #1 (… Add Tag qualify-holding … classify)
              └─ Condition: ENGAGED
                   ├─ yes → Delay 3m → SM#1 → Actions(Remove qualify-holding) → AI Step 2
                   │          └─ Actions(Add qualify-holding · blank · qualify) → Condition #1
                   │               ├─ yes → Delay 4m → SM#2 → Actions #3 (remove all holding/busy/open, add done)
                   │               └─ no  → Delay 4m → SM#3 → Actions #4 (same)
                   └─ no  → Delay 4m → SM#4 → Actions #2 (same)
```

## Migration still to run

```sql
alter table public.ig_followups
  add column if not exists kind text not null default 'followup';
```

Until it is run, both the write and the read fall back to the old shape — follow-ups are still
recorded, they just aren't labelled, and the panel shows them all under "Waiting on you".

## After building

Re-enable the trigger, then reset a test account and run one conversation, sending an extra "?"
during a delay. Expect: the reply arrives on time, and the "?" appears in `/admin` under
**Sent while waiting** with no push to Ali.
