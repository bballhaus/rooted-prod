# 0021: Read replies in Slack threads, not just the channel's top level

- **Status:** decided
- **Date:** 2026-11-17
- **Decided by:** Shirley (PM)
- **Review date:** 2026-12-02
- **Features:** F-03, F-06

## Question

Rooted's Slack reader (0017) only called `conversations.history`, which doesn't return thread replies. Should it read threads too?

## Context

Test 3 in the agent evals (`ai/evals/reports/2026-11-18-extraction-before-fixes.md`) ran Rooted's Slack reader and decision spotting over 50 synthetic channels. Every decision settled in a thread reply was summarized wrongly, 0 of 8, because the reply never reached Claude. Teams often settle things in threads, so the gap would be worse in real Slack. Reading a thread is `conversations.replies`, covered by the `channels:history` scope Rooted already has, in the same public channels the PM allows.

## Options

### Chosen: read the newest replies in the most recently active threads

For each brief or decision spot, read up to 25 threads whose parent is in the messages sent, ranked by their latest reply. From each, read up to 4 pages of 50 replies and keep the newest 50, which is where a thread usually ends up. Cap replies at 200 so a task stays within 600 messages. Each reply carries `replyTo`, the ref of the message it answers. A thread that can't be read is skipped, a rate limit stops thread reads and keeps what was read, and only a revoked token fails the task. Thread replies also sent to the channel, and files shared with a comment, now count as messages from people.

### Pruned: keep reading the top level only

This makes no extra calls, but it leaves out exactly where many decisions are settled. The eval showed the cost.

### Pruned: read every reply in every thread

This is complete, but on a busy channel it means hundreds of rate-limited calls. Slack limits `conversations.replies` the same way it limits `conversations.history` for apps outside its Marketplace (0017).

## Consequences

- **More is read.** Rooted reads more of what teammates write in the allowed channels: replies, not just top-level posts. This widens the open decision on teammate consent (decisions README), which still needs settling before outside testers.
- **Slower.** A brief makes up to 25 more Slack calls, more when a thread runs past one page.
- **Long threads lose their middle.** In a thread longer than 200 replies, only the first 200 are read, and the newest 50 of those are kept.
- **Amends 0017's reading rules.** The same scope and channels apply; 0017's text stays as decided.

## Outcome

Fill this in on the review date: did decisions settled in threads start showing up correctly, and did Slack rate limits get in the way?
