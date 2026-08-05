# ManyChat audit — THP Instagram automation

Audited 2026-08-05. Supersedes `instagram-manychat-handoff.md`, which stays as history.

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
| Tags | **none** |
| Growth tools | **none** |

### Flows

Split in two because Instagram will not let a comment-triggered flow run a whole conversation.

| Flow | Trigger | Status |
|---|---|---|
| `THP-Qualify-Opener` | User comments on Post or Reel (`Post or Reel Comments #2 copy`) | LIVE |
| `THP-Qualify-Full-Step` | **User sends a Direct Message — Default Reply** | LIVE |
| `THP-Qualify.V1` | none — superseded by the two above | DRAFT |

**The Default Reply trigger is the problem.** Two consequences, both seen live:

1. **It catches everyone.** Default Reply fires on *any* DM from *anyone* — a friend, a existing
   client, someone replying to a story. All of them get pulled into the qualification funnel. The
   whole point of the keyword trigger was that automation only ever touches people who comment a
   keyword; Default Reply quietly undoes that.
2. **It does not reliably re-fire.** A contact who has already been through it gets silence on a
   second run. Observed 2026-08-05: the opener sent, the reply arrived (`last_input_text` updated),
   and AI Step 1 never ran — `thp_reply` still held the previous conversation's answer.

**The fix:** end `THP-Qualify-Opener` with a **Go To Flow** action pointing at
`THP-Qualify-Full-Step`, and remove the Default Reply trigger from flow 2. Chaining becomes
deterministic and only keyword commenters ever enter it.

**Stale fields.** Custom fields follow the contact forever, across flows and conversations. A
returning contact starts with the previous run's `thp_reply`, `thp_classification`,
`thp_demographics` and `thp_qualification` still populated. Blank all four at the start of flow 2.

### Custom fields

| Field | Written by | Read by |
|---|---|---|
| `thp_classification` | AI Step 1 | Condition (contains `ENGAGED`) |
| `thp_demographics` | AI Step 2 | External Request body |
| `thp_qualification` | External Request response mapping (`$.status`) | Condition #1 (`is qualified`) |
| `thp_reply` | **AI Step 1** — stores the raw symptom reply | nothing reads it. **Do not delete** — the AI Step writes to it |

---

## The flow

```
User comments on Post or Reel  (trigger: "Post or Reel Comments #2")
  │
  ├─ Send Message ......... asks for symptoms / optimisation goal
  │
  ├─ AI Step .............. classifies the reply → thp_classification
  │
  └─ Condition: thp_classification contains ENGAGED
       │
       ├─ YES → Send Message #1 ... asks age / country / work / student / married
       │          │
       │          ├─ AI Step ...... saves the answer → thp_demographics
       │          │
       │          ├─ Actions ...... External Request → the site   ◄── the only site call
       │          │
       │          └─ Condition #1: thp_qualification is qualified
       │               ├─ YES → Send Message #2 ... Telegram, book a call (t.me/THPprotocol)
       │               └─ NO  → Send Message #3 ... the course
       │
       └─ NO  → Send Message #4 ... fan branch: thanks, here's the content
```

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

**AI Step 1 — classify the symptom reply**

> Goal: Wait for the person's reply about their symptoms/goals. Classify their reply as ENGAGED if
> they mention symptoms or wanting to optimize (e.g. testosterone, energy, health goals), or FAN if
> they are just a fan/not actually interested. Branch the conversation based on this classification.

- Task 1 — wait and capture, send nothing → **saves `thp_reply`**
- Task 2 — classify strictly `ENGAGED` or `FAN`, send nothing → **saves `thp_classification`**
- Context: names it an Instagram comment-to-DM funnel about testosterone/health optimisation.

**AI Step 2 — capture the demographic answer**

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

## Open items

1. **The flow is DRAFT.** Nothing runs until Set Live.
2. **The account is on the Pro trial.** External Request and the AI Steps are Pro features — when
   the trial ends they stop, and `thp_qualification` will be left empty, which falls to the course
   branch.
3. **Send Message #4** (fan branch) still contains a `REPLACE_WITH_YOUR_YOUTUBE` placeholder.
4. Fan branch and not-qualified branch both need the YouTube **and** Skool
   (`skool.com/theorder/classroom`) links, in their own wording.
5. **Blank `thp_qualification` before the External Request.** ManyChat does not clear a mapped
   field when a request fails outright — no response means no mapping, so the *previous* value
   survives. A returning contact who qualified once would be sent to Telegram again on a failed
   call. The site always answers with a status, so a reachable endpoint always overwrites; this
   covers the case where the endpoint is unreachable (trial expired, network, rate limit). Add a
   Set Custom Field action, `thp_qualification` → empty, immediately before the request.
6. Keyword substring matching — see the trigger section above.

## Site-side state as of this audit

- `/api/manychat/qualify` — live, verified against production.
- `/api/manychat/log` — admin-only GET, feeds the panel.
- `/api/manychat/reply` and `/api/manychat/admin` — **deleted.** They served the retired bot and
  could still have sent DMs to real followers.
- `ig_campaigns`, `ig_contacts`, `ig_conversations` — tables kept; they hold real leads and
  transcripts. Nothing reads them any more.
- `/admin` → Instagram is now a read-only decision log with no controls on it.
