# Test 3 (feasibility): AI pulls accurate decisions from Slack

Ran 2026-11-18 03:30 UTC · extraction `claude-sonnet-5-5` via `spotDecisions` (prompt version `f5471e52bf`, eval version `1461dee665`, commit `12ba327`) · judges `claude-opus-5-5` (primary) and `claude-sonnet-5-5` · 50 conversations, 54 tagged decisions · cost $1.34 · 1.4 min

## Verdict

**Right.** The card says we're right if 70% or more of decisions match and reviewers rate the summaries accurate. Both rates are measured against this test's working definition of a decision (see Method and limits), which doesn't settle the team's open question of what counts as one.

| Hypothesis | Result | 95% CI (bootstrap over conversations) | Met at the point estimate | Met with confidence (bootstrap and Wilson lower bounds above 70%) |
|---|---|---|---|---|
| ≥70% of tagged decisions matched | 100% (54/54) | 100%–100% | yes | yes |
| ≥70% of matched summaries rated accurate (4–5 of 5) | 91% (49/54) | 83%–98% | yes | yes |

The two judges agree well enough to trust these ratings (Cohen's κ 1.00 on matching, almost perfect; κ 0.78 on accurate or not, substantial).

## What was measured

| Measure | Value | 95% CI (Wilson) |
|---|---|---|
| Tagged decisions matched (primary judge) | 100% (54/54) | 93%–100% |
| Tagged decisions matched (second judge) | 100% (54/54) | 93%–100% |
| Matched, leaving out decisions settled only in thread replies | 100% (46/46) | 92%–100% |
| Matched by cited message alone (no judge) | 100% (54/54) | 93%–100% |
| Summaries rated accurate (primary judge) | 91% (49/54), mean 4.59/5 | 80%–96% |
| Summaries rated accurate (second judge) | 91% (49/54), mean 4.35/5 | 80%–96% |
| Suggestions that were a tagged decision (precision) | 100% (54/54) | 93%–100% |
| Suggestions the judge called real but no one tagged | 0 | |
| Suggestions raised in the 8 conversations with no decision | 0 | |

Inter-rater agreement between the two judges (the stand-in for agreement between human reviewers):

- Matching a tag to a suggestion: 100% raw agreement, κ = 1.00 (almost perfect), 54 tags.
- Accurate or not: 96% raw agreement, κ = 0.78 (substantial), 54 suggestions.
- The 1–5 scores: quadratic-weighted κ = 0.60 (moderate).

## By kind of decision

| How the decision shows up in Slack | Matched | Rated accurate |
|---|---|---|
| buried: one-line "fyi" among chatter | 9/9 (100%) | 9/9 |
| consensus: agreed by +1s and "sgtm" | 8/8 (100%) | 4/8 |
| explicit: PM states the decision outright | 7/7 (100%) | 7/7 |
| open: discussed, explicitly not decided yet | 6/6 (100%) | 6/6 |
| reaction: approved by ✅ reactions | 7/7 (100%) | 6/7 |
| reversed: decided, then changed a day or two later | 9/9 (100%) | 9/9 |
| threaded: poll whose outcome is only in thread replies | 8/8 (100%) | 8/8 |

Rooted's reader sent Claude 720 of the 814 messages in these channels: it drops bot posts and join messages, reads replies in up to 25 recent threads, and reads text only, not reactions. Extraction latency p50 3.2s, p95 4.6s.

## Misses and inaccurate summaries (primary judge, up to 10)

- Inaccurate (consensus, 3/5) in conv-20: Rooted said "Should we translate the product into Spanish now, or wait for demand data?". Judge: It has the right choice and reason but calls it open, when the +1, sgtm and Kenji's ticket show the team agreed to wait.
- Inaccurate (reaction, 3/5) in conv-27: Rooted said "Should we ship AI summaries as an opt-in beta?". Judge: It gets the choice and the decided status right but wrongly says it was settled by silence, missing the five ✅ approvals and misreading Rosa's earlier 'lgtm' to Aisha as a reply to the proposal.
- Inaccurate (consensus, 3/5) in conv-39: Rooted said "Should we limit API requests to 100 per minute per key?". Judge: It gets the choice and the reason right, but it calls it unclear whether the team settled, even though the +1s, 'sgtm' and the ticket being made show a clear decision.
- Inaccurate (consensus, 3/5) in conv-40: Rooted said "Should we push dark mode to Q2?". Judge: It gets the choice and reason right but wrongly calls it unsettled, even though the +1 and sgtm replies directly followed and Sam moved to make the ticket.
- Inaccurate (consensus, 3/5) in conv-42: Rooted said "Should we move our docs from GitBook to Mintlify?". Judge: It has the right choice and reason, but calls the question open even though Rosa's +1, Ben's 'sgtm' and Kenji's 'I'll make the ticket' came right after the proposal and plainly show agreement.

## Method and limits

- The conversations are synthetic, generated from templates (`ai/evals/slack_corpus.py`, seed fixed) and shaped like Slack API responses: mrkdwn links and mentions, emoji, reactions, giphy, bots, joins, edits, threads, typos and lookalike non-decisions (lunch, sarcasm, personal news, outside news). Their tags are exact by construction, which a hand-tagged set of real messages wouldn't be, and template text is more regular than real chat. Expect real Slack to score lower.
- The tagging rule (a team choice between real alternatives, made or explicitly pending) is this test's working definition only. What counts as a decision is still an open team question.
- The extraction is the production `spotDecisions` task as it stands: up to 3 choices per read, each with a question and a why that says whether the team settled it. Check the prompt version above against `rooted_ai/tasks.py` when comparing reports.
- The judges are LLMs standing in for human reviewers. Their agreement (κ) is reported so the ratings can be weighed; before relying on this for a decision, have two people rate a sample of the same items and compare.
- Intervals: Wilson treats every decision as independent; the bootstrap resamples whole conversations, since decisions in one channel aren't independent. The verdict is "Right" only when both lower bounds clear 70% and the judges agree at least moderately (κ ≥ 0.4).
