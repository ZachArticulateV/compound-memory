# Catch up on this chat

Summarize what changed in this conversation since the last message the user
wrote. Notifications and subagent reports are not their messages. Assume they
remember their last message and nothing after it.

Keep this read-only: gather from what you already have and from the current
state of each PR, CI run, or agent the chat touched.

## Write the reply

Keep it under 150 words, not counting pictures and action items. The action
items are never cut to fit: when there are many, the reply grows by them.

1. **One opening sentence:** how many things need the user, or that nothing
   does. If nothing happened and nothing waits, say so and stop.
2. **What happened,** pictures first when they help: screenshots the work
   produced, or a small diagram of how a change works or how PRs depend on
   each other (six boxes at most, plain labels). A status list is not a
   picture; a Markdown table is not a picture. Use a picture only where the
   host renders it. A visible change with no capture says "No screenshot yet"
   and describes what changed.
3. **One short line per thing the user asked for:** what came of it, and
   whether it is done, running, failed, or not checked. Write each line as you
   would say it: "Search was slow from a missing index", not "Search: done".
   Each line stays true read alone, and names a bug fixed on the way. Never
   mark done what still waits on the user.
4. **At most three lines** that change what the user knows or must do, then one
   line for any work left that you can do yourself.
5. **Action items:** every call still waiting on the user, including one
   raised before their last message and not yet answered. Per item: its link
   or number, what it changes for users, the evidence for your pick, its risk
   (say "low" and why when it is low), and your pick. Items that share one
   call go under that call, riskiest first. Say what waiting costs only when
   it costs more than delay. Write "unknown" for what you do not know. The
   reply alone must be enough to decide; a count or a link does not stand in
   for an item.
6. **A choice between options** goes after the action items: each option with
   what it gets the user and what it costs.

Never give a fact twice. When space runs out, cut from what happened; never
from the action items. Never invent a number or picture a screen you did not
capture. A check reported as passed is one you saw pass on the current code;
a stale or unchecked one is named as such.
