# Chrome prompts — stop AI Step 1 waiting for a message that already arrived

**Run these as THREE SEPARATE Chrome-agent sessions.** Start a brand-new Claude session in the
extension for each one, and keep the Chrome window narrow (about half the screen). The first attempt
died at step 45 with `image dimensions exceeds allowed size for many-image requests` — that is the
extension accumulating one screenshot per step, not a ManyChat problem. Short sessions and a small
window avoid it.

Session A does the entry guard. Session B does the AI Step. Session C does the exits.
**Run them in order.** Nothing was applied by the failed attempt — the account still has exactly one
tag, `qualify-open`, so start from A.

---

## The bug being fixed (context for all three sessions)

Flow 2 is entered by a Default Reply trigger, which fires when the person replies to the opening DM.
That reply is consumed as the trigger event. AI Step 1's first task says "wait for the person's reply
about their symptoms" — so it waits for a message that already arrived, and parks forever.

Proven live today: a lead wrote "I got libido problems and I want to optimise it" and got nothing.
He later sent "Hello"; the parked step woke on *that*, classified him a fan, and dismissed him.

---

# SESSION A — entry guard and reply capture

Paste from here to the end of Session A into a fresh Chrome-agent session.

---

You are editing one live ManyChat automation: **app.manychat.com → Automations →
THP-Qualify-Full-Step**. The account is already logged in.

**Hard rules**

- **Do not edit any message text.** Do not open any Send Message node.
- **Do not touch any trigger or keyword.**
- **Do not open or modify the External Request action.**
- **Do not change the flow's Live / Draft / Stopped status.**
- **Delete nothing** — no node, flow, tag, action or connection.
- Do not audit the whole flow. Do only the steps below, then stop and report.
- Take as few screenshots as you can; do not re-screenshot to double-check something you just read.

**Step 1 — create one tag**

The account currently has exactly one tag, `qualify-open`. Create a second tag named exactly:

```
qualify-busy
```

Create it through the normal tag interface (Settings → Tags, or the "create tag" option inside an Add
Tag action). This one new tag is expressly authorised. Create no other tag; do not rename or delete
`qualify-open`.

**Step 2 — guard the entry condition**

Open **Condition #2**, the tag gate immediately after the trigger. It currently reads
`Tag is qualify-open`. Add a **second condition in the same group, joined by AND**:

```
Tag is not qualify-busy
```

Both must be true to continue. Do not remove or alter the existing `qualify-open` condition.

**Step 3 — capture the reply that triggered the flow**

Open **Actions #1** (the node right after Condition #2 that blanks four custom fields). Leave the
four existing blanking actions exactly as they are. **Add two new actions to the same node, both
after the existing four, in this order:**

1. **Add Tag → `qualify-busy`**
2. **Set Custom Field → `thp_reply`** → value = the system field **Last Text Input**, inserted using
   ManyChat's field-insert picker (the `{}` or `+` button). **Do not type it as literal text** — pick
   it from the picker so a real token is inserted.

Order matters: blank first, then the tag, then `thp_reply` gets its value. If they land out of order,
drag them into the order above and say so.

**Step 4 — save and report**

Save/Update. Do not change Live/Draft/Stopped state. Report:

- confirmation the tag `qualify-busy` exists
- the exact text of Condition #2 after the change
- the full ordered contents of Actions #1
- whether the `thp_reply` value shows as an inserted token/pill or as plain text
- any validation warning after saving
- confirmation that no message text, trigger, keyword, External Request field or flow status changed,
  and that nothing was deleted

---

# SESSION B — make AI Step 1 classify instead of wait

Fresh session. Paste from here to the end of Session B.

---

You are editing one live ManyChat automation: **app.manychat.com → Automations →
THP-Qualify-Full-Step**. The account is already logged in.

**Hard rules**

- **Do not edit any message text.** Do not open any Send Message node.
- **Do not touch any trigger or keyword.**
- **Do not open or modify the External Request action.**
- **Do not change the flow's Live / Draft / Stopped status.**
- **Delete nothing except the single item named in Step 2 below.** That is the only deletion
  permitted anywhere in this task.
- Do not audit the whole flow. Do only the steps below, then stop and report.
- Take as few screenshots as you can.

**Step 1 — open the step**

Open **AI Step 1** — the AI Step whose goal is about classifying the person's reply as ENGAGED or
FAN. Do not open AI Step 2 (the demographics one).

**Step 2 — the one authorised deletion**

Delete **only** the task that waits for and captures the person's reply — the task whose text is
about waiting for their symptoms reply and saving it to `thp_reply`. It is now redundant, because
Actions #1 fills `thp_reply` directly. Delete that task and nothing else. Do not delete the AI Step,
any other task, or any node.

**Step 3 — rewrite the goal**

Set the AI Step's **Goal** to exactly:

```
Classify text that has already been received. Do not wait for any new message. Do not send any
message under any circumstances.
```

**Step 4 — rewrite the remaining task**

Set the remaining classification task's text to exactly:

```
Read the text stored in the custom field thp_reply. Classify it as ENGAGED if it mentions any
symptom, health complaint, or a desire to optimise anything (testosterone, energy, libido, sleep,
mood, training, body composition). Classify it as FAN only if it is pure praise or greeting with no
symptom and no goal at all. Save exactly one word, ENGAGED or FAN, to the custom field
thp_classification. Do not wait for input. Do not send any message.
```

Confirm the task still saves to **`thp_classification`** and that the step sends nothing.

**Step 5 — save and report**

Save/Update. Do not change Live/Draft/Stopped state. Report:

- the step's goal text and every remaining task with its text and save-to field
- **explicitly, yes or no: does this AI Step still show any "waits for user input" indicator, a wait
  icon, or any wording in its settings suggesting it will pause for a reply?** Do not try to fix it
  if yes — just report it.
- any validation warning after saving
- confirmation that the only thing deleted was the single task named in Step 2

---

# SESSION C — blank the qualification, release the guard at the exits

Fresh session. Paste from here to the end of Session C.

---

You are editing one live ManyChat automation: **app.manychat.com → Automations →
THP-Qualify-Full-Step**. The account is already logged in.

**Hard rules**

- **Do not edit any message text.** Do not open any Send Message node.
- **Do not touch any trigger or keyword.**
- **Do not open or modify the External Request action itself** — you will add an action *next to* it
  in the same node, never inside it.
- **Do not change the flow's Live / Draft / Stopped status.**
- **Delete nothing.**
- Do not audit the whole flow. Do only the steps below, then stop and report.
- Take as few screenshots as you can.

**Step 1 — blank the qualification before the request**

Find the Actions node containing the **External Request** (do not open the request). Add one action
to that node:

- **Set Custom Field → `thp_qualification`** → **empty / clear value**

It must sit **above the External Request** in the action list. Drag it there if it lands below, and
say whether you had to.

Reason: if the request ever fails outright, no response is mapped, so the previous run's value would
survive and a returning contact could be routed on stale data.

**Step 2 — release the guard at all three exits**

Three Actions nodes sit at the ends of the three branches — Actions #2 (fan branch), Actions #3
(qualified branch) and Actions #4 (not-qualified branch). Each already contains
**Remove Tag → `qualify-open`**. Leave that action alone in all three.

Add **one** action to each of the three:

- **Remove Tag → `qualify-busy`**

Pick `qualify-busy` from the existing-tags dropdown. Do not create any tag. Do not remove or change
the existing `qualify-open` action in any of them.

**Step 3 — save and report**

Save/Update. Do not change Live/Draft/Stopped state. Report:

- the ordered action list of the node holding the External Request
- the contents of Actions #2, #3 and #4
- whether you had to drag anything into order
- any validation warning after saving
- confirmation that nothing was deleted and no message text, trigger, keyword, External Request field
  or flow status changed

---

## Expected end state, after all three sessions

```
Trigger: Default Reply (every time)
  │
  └─ Condition #2: has tag qualify-open AND does not have tag qualify-busy   ──no──► exit, silent
       │
       ├─ Actions #1: blank thp_classification, thp_demographics,
       │              thp_qualification, thp_reply
       │              → Add Tag qualify-busy
       │              → Set thp_reply = {{Last Text Input}}
       │
       ├─ AI Step 1: classify thp_reply → thp_classification   (no waiting, sends nothing)
       │
       └─ Condition: thp_classification contains ENGAGED
            │
            ├─ YES → Send Message #1 (demographic question)
            │          ├─ AI Step 2 ..... waits, saves thp_demographics
            │          ├─ Actions ....... blank thp_qualification → External Request
            │          └─ Condition #1: thp_qualification is qualified
            │               ├─ YES → Send Message #2 → Actions #3: remove qualify-open + qualify-busy
            │               └─ NO  → Send Message #3 → Actions #4: remove qualify-open + qualify-busy
            │
            └─ NO  → Send Message #4 → Actions #2: remove qualify-open + qualify-busy
```
