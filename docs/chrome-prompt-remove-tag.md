# Chrome prompt — remove `qualify-open` at the end of every branch

Paste everything below into a Chrome-agent session with ManyChat already logged in.

---

You are editing one live ManyChat automation. The account is already logged in. Work in
app.manychat.com → Automations → **THP-Qualify-Full-Step**.

## Hard rules

- **Do not delete anything.** No node, no message, no action, no tag, no flow. Never click Delete,
  Trash, Remove node, or Archive on anything that already exists.
- **Do not edit any message text.** Not one word, in any Send Message node.
- **Do not touch the trigger**, its keywords, or any condition.
- **Do not change the flow's Live/Draft/Stopped status.** Leave it exactly as you found it.
- **Do not open or modify the External Request action**, its headers, or its secret value.
- The only thing you are adding is a **Remove Tag** action, three times, in three places.
- If a place already has that action, leave it alone and say so.

## What you are adding and why

The flow is entered by a **Default Reply** trigger, which fires on *any* DM. The only thing stopping
it running for everybody is a Condition that checks the contact has the tag **`qualify-open`**,
which the other flow (THP-Qualify-Opener) applies when someone comments a keyword.

That tag is never removed, so a lead who already finished the funnel and later sends any DM — "thanks
bro" — re-enters the whole flow and gets pitched a second time. Removing the tag at the end of every
path makes the flow run exactly once per person.

## Step 1 — audit first, report before changing anything

Open **THP-Qualify-Full-Step** and report back:

1. The name/label of every **terminal node** — every node that has nothing connected after it.
   Expect roughly three, the ends of these paths:
   - the **qualified** branch (the message with the Telegram link, t.me/THPprotocol)
   - the **not qualified** branch (the message pointing at the course)
   - the **fan** branch (the message that thanks them and points at content)
2. For each of those three endings, say whether an **Actions** node already exists after the Send
   Message, and if so list the actions inside it.
3. Confirm the tag is spelled exactly `qualify-open` where it is referenced in the entry Condition.

Report that list. Then continue.

## Step 2 — add the Remove Tag action, three times

For **each** of the three terminal branches, at the very end of that branch, after the final Send
Message:

- If an **Actions** node already sits at the end of that branch: open it, click **+ Add Action**, and
  add **Remove Tag → `qualify-open`**. Leave every existing action in that node untouched.
- If there is no Actions node at the end: add a new **Actions** step connected after the final Send
  Message, and put a single action in it: **Remove Tag → `qualify-open`**.

Pick the existing tag `qualify-open` from the dropdown. **Do not create a new tag** and do not type a
new tag name — if the dropdown does not offer `qualify-open`, stop and tell me instead of creating
one.

## Step 3 — save and report

Click **Save** (or Publish if that is the only save control — but do **not** change Live/Stopped
state). Then report:

- which of the three branches already had the action and were left alone
- which ones you added it to, and whether you reused an existing Actions node or created a new one
- the exact tag name as it appears in each of the three actions
- any validation warning shown after saving
- confirmation that no message text, condition, trigger, keyword, External Request or flow status was
  changed

---

## Expected end state

```
Condition: has tag qualify-open  ──no──► exit, nothing sent
  │yes
  ├─ ...
  ├─ qualified      → Send Message #2 (Telegram) → Actions: Remove Tag qualify-open
  ├─ not qualified  → Send Message #3 (course)   → Actions: Remove Tag qualify-open
  └─ fan            → Send Message #4 (content)  → Actions: Remove Tag qualify-open
```

After this, a person is pulled into the funnel only by commenting a keyword, and only once per
comment. To go through again they have to comment again — which is the intended behaviour.
