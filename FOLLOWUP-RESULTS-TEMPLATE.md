# Follow-up results: <stack> slice

Copy to `FOLLOWUP-RESULTS.md` on your branch. Mark every item measured, not measured (with a reason), or inferred.

## Corrections to RESULTS.md

(None, or list each earlier statement that turned out to be wrong and what is right.)

## F1. Memory, same method

Metric used per OS (exact command or API):

| Point | Linux PSS (MB) | Linux RSS (MB) | Windows private WS (MB) | Windows total WS (MB) | macOS footprint (MB) | macOS RSS (MB) |
| ----- | -------------- | -------------- | ----------------------- | --------------------- | -------------------- | -------------- |
| P0 Overview, 5 s |  |  |  |  |  |  |
| P1 Transactions, 5 s |  |  |  |  |  |  |
| P2 after scroll 1 |  |  |  |  |  |  |
| P3 after scroll 2 |  |  |  |  |  |  |
| P4 after scroll 3 + 60 s idle |  |  |  |  |  |  |
| P5 after soak |  |  |  |  |  |  |

Against the 400 MB G2 limit, per metric: pass or fail.

With accessibility forced on (Electron required; Avalonia if testable): same table or the points that changed.

Growth over the soak (P3 to P5), and whether it levels off:

## F2. macOS

What was tried, what ran, what did not and why. Cold start, memory, screenshots, G3 parts that ran, network observation and its confidence.

## F3. Platform accessibility

Per OS: table of element, role, name, value, state, notes. Link raw dumps. Plain-words answer: could a screen-reader user find a transaction, read description, amount and category, and know which row is selected? What is missing? Stretch screen-reader run, if attempted.

## Stack-specific items

One subsection per item from your prompt, with evidence.

## Effort

Active time, number of prompts or corrections for this follow-up.

## Not measured

Everything you could not do, and why.
