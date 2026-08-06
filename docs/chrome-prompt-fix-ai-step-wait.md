# Chrome prompt — stop AI Step 1 waiting for a message that already arrived

Paste into a Chrome-agent session with ManyChat logged in.

---

You are repairing one live ManyChat automation: **app.manychat.com → Automations →
THP-Qualify-Full-Step**. The account is already logged in.

## Hard rules

- **Do not edit any message text.** Not one word, in any Send Message node. You will not open a Send
  Message node at all except to confirm which branch you are standing in.
- **Do not touch any trigger or any keyword**, in either flow.
- **Do not open or modify the External Request action**, its URL, its headers, or its secret value.
  You will add an action *next to* it, never inside it.
- **Do not change any flow's Live / Draft / Stopped status.**
- **Delete nothing** — no node, no flow, no tag, no connection — with exactly one authorised
  exception, named in Step 4. That is the only deletion permitted in this entire task.
- If a step already holds the correct value, leave it untouched and say so in your report.
- Work through the steps in order. **Report after each step before starting the next one.**

## The bug you are fixing

The flow is entered by a Default Reply trigger, which fires when the person replies to the opening
DM. That reply is *consumed as the trigger event*. AI Step 1's first task then says "wait for the
person's reply about their symptoms" — so it waits for a message that has already arrived, and parks
forever. The person's real answer is never classified. When they eventually send a second message,
the parked step wakes on *that* one and misjudges them.

Proven live today: a lead wrote "I got libido problems and I want to optimise it" and got nothing.
He then sent "Hello", and the flow woke on "Hello", classified him as a fan, and dismissed him.

Two changes fix it: read the reply from `Last Text Input` instead of waiting for it, and stop the
flow re-entering itself from the top while it is mid-conversation.

---

## Step 1 — audit and report before changing anything

Open **THP-Qualify-Full-Step** and report:

1. Every node in order from the trigger down, with its label and type.
2. The exact contents of **Actions #1** — every action in it, in order.
3. The exact condition text in **Condition #2** (the tag gate right after the trigger).
4. The full configuration of **AI Step 1** — its Goal text, and every Task in it with its full text
   and which custom field each Task saves to. Number the tasks as ManyChat numbers them.
5. Which Actions node contains the **External Request**, its label, and the list of actions in that
   node in order (name them only — do not open the External Request itself).
6. Confirm that Actions #2, #3 and #4 each contain **Remove Tag → `qualify-open`**.
7. The list of tags that exist on the account — is there already a tag named `qualify-busy`?

Report all of that, then continue.

## Step 2 — create the re-entry guard tag

The account currently has one tag, `qualify-open`. Create a **second tag named exactly**:

```
qualify-busy
```

Create it through the normal tag interface (Settings → Tags, or the "create tag" option inside an Add
Tag action). Creating this one new tag is expressly authorised. Do not create any other tag, and do
not rename or delete `qualify-open`.

Report that it exists.

## Step 3 — guard the entry, and capture the reply

**3a — Condition #2.** Open it. It currently reads `Tag is qualify-open`. Add a **second condition in
the same group, joined by AND**:

```
Tag is not qualify-busy
```

Both must be true to continue. Do not remove or alter the existing `qualify-open` condition. If
ManyChat words this as "Tag" → "is not" → `qualify-busy`, that is the correct shape.

**3b — Actions #1.** This node currently blanks four custom fields on entry. Leave those four blank
actions exactly as they are, and **add two new actions to the same node, both placed after the four
existing ones, in this order**:

1. **Add Tag → `qualify-busy`**
2. **Set Custom Field → `thp_reply`** → value = the system field **Last Text Input**, inserted with
   ManyChat's field-insert picker (the `{}` or `+` button). **Do not type the token as literal
   text** — pick it from the picker so a real token is inserted.

Order matters: the blanking must happen first, then the tag, then `thp_reply` gets its value.
If the actions land in the wrong order, drag them into the order above and say that you did.

Report the full contents of Actions #1 after the change, in order.

## Step 4 — make AI Step 1 classify instead of wait

Open **AI Step 1** (the one whose goal is about classifying the reply as ENGAGED or FAN).

**The one authorised deletion in this task:** delete **only** the task that waits for and captures the
person's reply — the task whose text is about waiting for their symptoms reply and saving it to
`thp_reply`. That task is now redundant, because Actions #1 fills `thp_reply` directly. Delete that
task and nothing else. Do not delete the AI Step, any other task, or any node.

Then set the AI Step's **Goal** to exactly this text:

```
Classify text that has already been received. Do not wait for any new message. Do not send any
message under any circumstances.
```

And set the remaining classification task's text to exactly this:

```
Read the text stored in the custom field thp_reply. Classify it as ENGAGED if it mentions any
symptom, health complaint, or a desire to optimise anything (testosterone, energy, libido, sleep,
mood, training, body composition). Classify it as FAN only if it is pure praise or greeting with no
symptom and no goal at all. Save exactly one word, ENGAGED or FAN, to the custom field
thp_classification. Do not wait for input. Do not send any message.
```

Where the task references `thp_reply`, insert it with the field picker if ManyChat offers one there;
if the task text is plain text only, typing the field name is fine.

Confirm the task still saves to **`thp_classification`**, and that the step is set to send nothing.

**Then report one thing explicitly, before going further:** does this AI Step still show any
"waits for user input" indicator, a wait icon, or wording anywhere in its settings suggesting it will
pause for a reply? Say yes or no. Do not try to fix it if yes — just report it and continue.

## Step 5 — blank the qualification before the request

Find the Actions node that contains the **External Request** (do not open the request). Add one
action to that node:

- **Set Custom Field → `thp_qualification`** → **empty / clear value**

It must sit **above the External Request** in the action list. Drag it there if it lands below, and
say whether you had to.

Reason: if the request ever fails outright, no response is mapped, so the previous run's value would
survive and a returning contact could be routed on stale data.

## Step 6 — release the guard at all three exits

Actions #2, #3 and #4 each already contain **Remove Tag → `qualify-open`**. Leave that action alone.
Add **one** action to each of the three:

- **Remove Tag → `qualify-busy`**

Pick `qualify-busy` from the existing-tags dropdown. Do not create another tag. Do not remove or
change the existing `qualify-open` action in any of them.

## Step 7 — save and report

Save/Update the flow. **Do not change Live/Draft/Stopped state.** Then report:

- the full ordered contents of Actions #1
- the exact text of Condition #2 after the change
- AI Step 1's goal, its remaining tasks, the field it saves to, and your yes/no answer about whether
  it still indicates waiting for input
- the ordered action list of the Actions node holding the External Request
- the contents of Actions #2, #3 and #4
- any validation warning shown after saving
- explicit confirmation that no message text, no trigger, no keyword, no External Request field and
  no flow status was changed, and that the only thing deleted was the single AI Step task named in
  Step 4

---

## Expected end state

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
