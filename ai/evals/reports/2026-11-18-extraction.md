# Test 3 (feasibility): AI pulls accurate decisions from Slack

Ran 2026-11-18 03:37 UTC · extraction `claude-sonnet-5-5` via `spotDecisions` (prompt version `21e645d0be`, eval version `d38c484770`, commit `94279a3`) · judges `claude-opus-5-5` (primary) and `claude-sonnet-5-5` · 50 conversations, 54 tagged decisions · cost $1.31 · 1.4 min

## Verdict

**Right.** The card says we're right if 70% or more of decisions match and reviewers rate the summaries accurate. Both rates are measured against this test's working definition of a decision (see Method and limits), which doesn't settle the team's open question of what counts as one.

| Hypothesis | Result | 95% CI (bootstrap over conversations) | Met at the point estimate | Met with confidence (bootstrap and Wilson lower bounds above 70%) |
|---|---|---|---|---|
| ≥70% of tagged decisions matched | 98% (53/54) | 94%–100% | yes | yes |
| ≥70% of matched summaries rated accurate (4–5 of 5) | 94% (50/53) | 87%–100% | yes | yes |

The two judges agree well enough to trust these ratings (Cohen's κ 1.00 on matching, almost perfect; κ 0.73 on accurate or not, substantial).

## What was measured

| Measure | Value | 95% CI (Wilson) |
|---|---|---|
| Tagged decisions matched (primary judge) | 98% (53/54) | 90%–100% |
| Tagged decisions matched (second judge) | 98% (53/54) | 90%–100% |
| Matched, leaving out decisions settled only in thread replies | 98% (45/46) | 89%–100% |
| Matched by cited message alone (no judge) | 98% (53/54) | 90%–100% |
| Summaries rated accurate (primary judge) | 94% (50/53), mean 4.72/5 | 85%–98% |
| Summaries rated accurate (second judge) | 91% (48/53), mean 4.43/5 | 80%–96% |
| Suggestions that were a tagged decision (precision) | 100% (53/53) | 93%–100% |
| Suggestions the judge called real but no one tagged | 0 | |
| Suggestions raised in the 8 conversations with no decision | 0 | |

Inter-rater agreement between the two judges (the stand-in for agreement between human reviewers):

- Matching a tag to a suggestion: 100% raw agreement, κ = 1.00 (almost perfect), 54 tags.
- Accurate or not: 96% raw agreement, κ = 0.73 (substantial), 53 suggestions.
- The 1–5 scores: quadratic-weighted κ = 0.65 (substantial).

## By kind of decision

| How the decision shows up in Slack | Matched | Rated accurate |
|---|---|---|
| buried: one-line "fyi" among chatter | 9/9 (100%) | 9/9 |
| consensus: agreed by +1s and "sgtm" | 7/8 (88%) | 4/7 |
| explicit: PM states the decision outright | 7/7 (100%) | 7/7 |
| open: discussed, explicitly not decided yet | 6/6 (100%) | 6/6 |
| reaction: approved by ✅ reactions | 7/7 (100%) | 7/7 |
| reversed: decided, then changed a day or two later | 9/9 (100%) | 9/9 |
| threaded: poll whose outcome is only in thread replies | 8/8 (100%) | 8/8 |

Rooted's reader sent Claude 720 of the 814 messages in these channels: it drops bot posts and join messages, reads replies in up to 25 recent threads, and reads text only, not reactions. Extraction latency p50 3.0s, p95 6.2s.

## Misses and inaccurate summaries (primary judge, up to 10)

- Missed (consensus) in conv-20: The team agreed to wait for demand data before translating, because only 4% of signups are from Spanish-speaking countries. Judge: No suggestion addresses the decision to wait for demand data before translating into Spanish.
- Inaccurate (consensus, 3/5) in conv-39: Rooted said "Should we rate limit API requests to 100 per minute per key?". Judge: It gets the choice and the reason right, but it calls the question unsettled when the +1s, the sgtm and Sam's ticket that followed his proposal show the team agreed.
- Inaccurate (consensus, 3/5) in conv-40: Rooted said "Should we push dark mode to Q2 because Q1 is full with the launch?". Judge: It gets the choice and the reason (Q1 is full with the launch) right, but it wrongly treats the decision as not clearly settled, even though Kenji +1'd, Tom said sgtm and Sam closed it by making the ticket.
- Inaccurate (consensus, 3/5) in conv-42: Rooted said "Should we move our docs from GitBook to Mintlify?". Judge: It gets the choice and the reason right but calls the question open, even though the +1, sgtm and 'I'll make the ticket' replies right after Kenji's proposal show the team agreed.

## Method and limits

- The conversations are synthetic, generated from templates (`ai/evals/slack_corpus.py`, seed fixed) and shaped like Slack API responses: mrkdwn links and mentions, emoji, reactions, giphy, bots, joins, edits, threads, typos and lookalike non-decisions (lunch, sarcasm, personal news, outside news). Their tags are exact by construction, which a hand-tagged set of real messages wouldn't be, and template text is more regular than real chat. Expect real Slack to score lower.
- The tagging rule (a team choice between real alternatives, made or explicitly pending) is this test's working definition only. What counts as a decision is still an open team question.
- The extraction is the production `spotDecisions` task as it stands: up to 3 choices per read, each with a question and a why that says whether the team settled it. Check the prompt version above against `rooted_ai/tasks.py` when comparing reports.
- The judges are LLMs standing in for human reviewers. Their agreement (κ) is reported so the ratings can be weighed; before relying on this for a decision, have two people rate a sample of the same items and compare.
- Intervals: Wilson treats every decision as independent; the bootstrap resamples whole conversations, since decisions in one channel aren't independent. The verdict is "Right" only when both lower bounds clear 70% and the judges agree at least moderately (κ ≥ 0.4).
