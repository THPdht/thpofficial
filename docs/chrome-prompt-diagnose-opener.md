# Chrome prompt — diagnose why flow 2 never runs (READ ONLY)

Paste into a Chrome-agent session with ManyChat logged in. This prompt changes **nothing**.

---

You are diagnosing a live ManyChat automation. **This is a read-only task. Do not change, add,
delete, save, or publish anything.** Do not click Save, Publish, Delete, or any Live/Draft/Stopped
toggle. Open panels to read them, then close them with Cancel or the X — never Save.

Symptom: someone comments a keyword, the public reply posts, the opening DM arrives — and when they
reply to that DM, nothing ever comes back. This happens on brand-new Instagram accounts that have
never been in the funnel. Flow 2 (`THP-Qualify-Full-Step`) has one gate right after its trigger:
`Tag is qualify-open`. If the tag is never applied, the flow exits in silence, which is exactly what
we see. Your job is to find out whether the tag is actually being applied.

## Part A — the node order in THP-Qualify-Opener

Open **Automations → THP-Qualify-Opener** and report:

1. Every node in the flow, **in order**, from the trigger to the last node. For each: its type
   (Trigger / Send Message / Actions / Condition) and its label.
2. Where exactly the **Add Tag `qualify-open`** action sits — is it in an Actions node **before** the
   Send Message, or **after** it? This is the single most important thing in this report. Say
   "before" or "after" explicitly.
3. Open the **Send Message** node and report whether it is set to **Private Reply** or to
   **24-hour messaging / standard message**.
4. Report any warning, error, or red/orange badge shown anywhere on the canvas or inside any node.
5. Report the flow's current status (Live / Draft / Paused) — read it, do not change it.

Context you may find useful: Instagram allows exactly one Private Reply in response to a comment,
and **nothing may execute after it**. So an Add Tag action placed after the Private Reply node would
never run, and no new contact would ever receive the tag.

## Part B — did the test contacts actually get tagged?

Go to the **Audience** (or Contacts) tab and search for these two Instagram accounts:

- `luko.only`
- `edwin_baggens`

For **each** one, report:

1. Whether the contact exists in the audience at all.
2. The exact list of **tags** on the contact — specifically, does it have `qualify-open`?
3. The **Last Interaction / last message** shown — did ManyChat record the reply they typed after the
   opening DM, or does it only show the opening DM going out?
4. Open their custom fields and report the values of `thp_reply`, `thp_classification`,
   `thp_demographics`, `thp_qualification` — say "empty" for any that are blank.

If the contact search finds them, also report their **subscriber ID** if it is visible anywhere in
the URL or the contact panel.

## Part C — the trigger on flow 2

Open **THP-Qualify-Full-Step** and report, without changing anything:

1. The exact trigger name and its settings — in particular whether Default Reply is set to fire
   **every time** or **only once**.
2. Whether the trigger shows any restriction, filter, or condition of its own.
3. Whether Condition #2 (`Tag is qualify-open`) is genuinely the **first** step after the trigger, or
   whether something sits between them.

## Report format

Answer Part A, B and C as three separate lists. State plainly anything you could not find or could
not read, rather than guessing. Confirm at the end that you saved nothing and changed nothing.
