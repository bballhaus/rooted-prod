# Test 3 (feasibility): AI pulls accurate decisions from Slack

Ran 2026-11-18 01:31 UTC · extraction `claude-sonnet-5-5` via `spotDecisions` (prompt version `77ca572b7f`, commit `a562323`) · judges `claude-opus-5-5` (primary) and `claude-sonnet-5-5` · 50 conversations, 54 tagged decisions · cost $1.28 · 1.5 min

## Verdict

**Not yet.** The card says we're right if 70% or more of decisions match and reviewers rate the summaries accurate. Both rates are measured against this test's working definition of a decision (see Method and limits), which doesn't settle the team's open question of what counts as one.

| Hypothesis | Result | 95% CI (bootstrap over conversations) | Met at the point estimate | Met with confidence (CI above 70%) |
|---|---|---|---|---|
| ≥70% of tagged decisions matched | 100% (54/54) | 100%–100% | yes | yes |
| ≥70% of matched summaries rated accurate (4–5 of 5) | 67% (36/54) | 54%–80% | no | no |

The two judges agree too little to fully trust these ratings (Cohen's κ 1.00 on matching, almost perfect; κ 0.37 on accurate or not, fair).

## What was measured

| Measure | Value | 95% CI (Wilson) |
|---|---|---|
| Tagged decisions matched (primary judge) | 100% (54/54) | 93%–100% |
| Tagged decisions matched (second judge) | 100% (54/54) | 93%–100% |
| Matched, leaving out decisions settled only in thread replies | 100% (46/46) | 92%–100% |
| Matched by cited message alone (no judge) | 100% (54/54) | 93%–100% |
| Summaries rated accurate (primary judge) | 67% (36/54), mean 4.09/5 | 53%–78% |
| Summaries rated accurate (second judge) | 41% (22/54), mean 3.37/5 | 29%–54% |
| Suggestions that were a tagged decision (precision) | 100% (54/54) | 93%–100% |
| Suggestions the judge called real but no one tagged | 0 | |
| Suggestions raised in the 8 conversations with no decision | 0 | |

Inter-rater agreement between the two judges (the stand-in for agreement between human reviewers):

- Matching a tag to a suggestion: 100% raw agreement, κ = 1.00 (almost perfect), 54 tags.
- Accurate or not: 67% raw agreement, κ = 0.37 (fair), 54 suggestions.
- The 1–5 scores: quadratic-weighted κ = 0.42 (moderate).

## By kind of decision

| How the decision shows up in Slack | Matched | Rated accurate |
|---|---|---|
| buried: one-line "fyi" among chatter | 9/9 (100%) | 8/9 |
| consensus: agreed by +1s and "sgtm" | 8/8 (100%) | 4/8 |
| explicit: PM states the decision outright | 7/7 (100%) | 2/7 |
| open: discussed, explicitly not decided yet | 6/6 (100%) | 6/6 |
| reaction: approved by ✅ reactions | 7/7 (100%) | 7/7 |
| reversed: decided, then changed a day or two later | 9/9 (100%) | 9/9 |
| threaded: poll whose outcome is only in thread replies | 8/8 (100%) | 0/8 |

Rooted's reader sent Claude 688 of the 814 messages in these channels: it drops bot posts and join messages, `conversations.history` doesn't return thread replies, and it reads text only, not reactions. Extraction latency p50 2.6s, p95 5.4s.

## Misses and inaccurate summaries (primary judge, up to 10)

- Inaccurate (explicit, 3/5) in conv-01: Rooted said "Should we move docs to Mintlify or keep GitBook?". Judge: It notes Priya's decision for Mintlify but frames it as contested, citing Dana's objection that came before the decision and ignoring the four checkmark approvals, and it omits the stated reason that GitBook search is bad and shows up in support tickets.
- Inaccurate (consensus, 3/5) in conv-02: Rooted said "Should we start a weekly on-call rotation for incidents?". Judge: It gets the choice and the reason (two weekend incidents) right, but it says no decision is recorded even though Ben and Rosa agreed and Marcus committed to making the ticket, so it treats a decided question as open.
- Inaccurate (threaded, 3/5) in conv-03: Rooted said "Should we pay sales commission on bookings or on cash collected?". Judge: It identifies the right choice but wrongly says no decision is recorded, when Priya closed the thread with the decision to pay commission on cash collected.
- Inaccurate (threaded, 3/5) in conv-05: Rooted said "Should we build a native iOS app or go responsive web first?". Judge: It names the right choice but wrongly claims there was no conclusion, when Priya closed the thread deciding on responsive web first.
- Inaccurate (consensus, 3/5) in conv-06: Rooted said "Should we add a $9 starter plan for small teams?". Judge: It gets the choice and the price-bouncing reason right, but it wrongly says no decision was recorded when the team agreed and Marcus committed to making the ticket.
- Inaccurate (explicit, 3/5) in conv-14: Rooted said "Should SSO stay on Enterprise only, or should we add it to the Team plan?". Judge: It correctly notes that Priya called the decision for Enterprise only, but by saying nothing is recorded and stressing Sam's pushback it implies the question is still open, and it omits her reason that SSO is the main upgrade driver and the 5 checkmark reactions confirming the c…
- Inaccurate (buried, 3/5) in conv-15: Rooted said "Should we limit API usage to 100 requests/min per key, and what other options should we weigh (higher limit, per-customer tiers, throttling instead of hard blocking)?". Judge: It names the right choice and reason, but it frames an already-announced decision as an open question about whether to weigh other options, which garbles the status.
- Inaccurate (threaded, 3/5) in conv-18: Rooted said "Should we sponsor a SaaStr booth or run our own webinar series?". Judge: It identifies the right choice but treats the poll as unresolved, missing that Priya closed it by deciding to run their own webinar series.
- Inaccurate (threaded, 3/5) in conv-19: Rooted said "Should we release weekly or every two weeks?". Judge: It identifies the right release-cadence poll but wrongly says there is no outcome, when Priya concluded in the thread that the team will move to releases every two weeks.
- Inaccurate (explicit, 3/5) in conv-19: Rooted said "Should we hire a full-time designer or keep contractors through Q1?". Judge: It notes Priya's decision to hire but frames it as unsettled because of Ben's objection, which actually came before the decision, and it omits the stated reason that contractor handoffs are slowing projects.

## Method and limits

- The conversations are synthetic, generated from templates (`ai/evals/slack_corpus.py`, seed fixed) and shaped like Slack API responses: mrkdwn links and mentions, emoji, reactions, giphy, bots, joins, edits, threads, typos and lookalike non-decisions (lunch, sarcasm, personal news, outside news). Their tags are exact by construction, which a hand-tagged set of real messages wouldn't be, and template text is more regular than real chat. Expect real Slack to score lower.
- The tagging rule (a team choice between real alternatives, made or explicitly pending) is this test's working definition only. What counts as a decision is still an open team question.
- The extraction is the production `spotDecisions` task as it stands: it asks for "choices the team seems to be facing", up to 3 per read, and isn't asked to say whether or how a choice was settled. Accuracy here checks that anyway, because the card asks whether the summaries are accurate.
- The judges are LLMs standing in for human reviewers. Their agreement (κ) is reported so the ratings can be weighed; before relying on this for a decision, have two people rate a sample of the same items and compare.
- Intervals: Wilson treats every decision as independent; the bootstrap resamples whole conversations, since decisions in one channel aren't independent. The bootstrap is the one to use for the verdict.
