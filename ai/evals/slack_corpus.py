"""A synthetic Slack workspace for the extraction test (Test 3).

Fifty channel snapshots shaped like Slack Web API responses
(conversations.history, conversations.replies, users.info), full of what real
group chats carry: emoji, reactions, links in Slack's <url|label> markup,
@mentions, giphy, bots, join messages, typos, edits, threads and banter.
Some hold one or two real team decisions; some hold none, only lookalikes
(lunch, sarcasm, personal news).

Every decision is labelled as it's generated, the stand-in for the
hand-written tags in the test plan. The labelling rule here (a team choice
between real alternatives, either made or explicitly pending) is this test's
working definition only; "what counts as a decision" is still an open team
question (docs/decisions/README.md).

Nothing here is real: Brightline, its people and its links are invented.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

NOW = 1_794_830_400.0  # 2026-11-15 12:00 UTC
SEED = 177

USERS = {
    "U01PRIYA": "Priya Raman",
    "U02MARCUS": "Marcus Lee",
    "U03DANA": "Dana Okafor",
    "U04TOM": "Tom Becker",
    "U05AISHA": "Aisha Khan",
    "U06LEO": "Leo Park",
    "U07SAM": "Sam Ortiz",
    "U08KENJI": "Kenji Watanabe",
    "U09ROSA": "Rosa Delgado",
    "U10BEN": "Ben Fischer",
}
PEOPLE = list(USERS)
PM = "U01PRIYA"

CHANNELS = ["#product", "#eng", "#growth", "#design", "#sales", "#support", "#launch-q1", "#data", "#marketing", "#ops"]


@dataclass(frozen=True)
class Topic:
    id: str
    channel: str
    question: str
    a: str  # the option usually chosen
    b: str
    why_a: str
    why_b: str
    evidence: str


TOPICS = [
    Topic("starter-plan", "#product", "Should we add a cheaper starter plan?", "add a $9 starter plan", "keep Team as the cheapest plan", "small teams keep bouncing on price", "a cheap plan could cannibalize Team", "3 of 5 churn surveys last month said price. <https://docs.example.com/sheets/churn-oct|churn survey sheet>"),
    Topic("sso", "#sales", "Should SSO be Enterprise-only?", "keep SSO on Enterprise only", "add SSO to the Team plan", "it's our main reason to upgrade", "two mid-size prospects asked for it on Team", "4 of the last 5 enterprise deals required SAML"),
    Topic("release-cadence", "#eng", "Should we release weekly or every two weeks?", "move to releases every two weeks", "stay on weekly releases", "QA can't keep up with weekly", "smaller releases are easier to roll back", "we had 2 rollbacks in October, both from rushed QA"),
    Topic("analytics", "#data", "Which analytics tool should we use, PostHog or Amplitude?", "self-host PostHog", "go with Amplitude", "it's way cheaper at our event volume", "Amplitude's charts are better for the sales team", "Amplitude quoted ~$38k/yr for 40M events <https://vendor.example.com/quote/8812|quote pdf>"),
    Topic("sample-data", "#growth", "Should new workspaces start with sample data?", "ship sample data in onboarding", "keep the empty state", "48% stall at connect-a-source", "sample data might confuse people about what's real", "48% of new workspaces stall at step 3 per the funnel"),
    Topic("dark-mode", "#design", "Should we build dark mode this quarter?", "push dark mode to Q2", "build dark mode in Q1", "Q1 is already full with the launch", "it's the #1 request on the feedback board", "dark mode has 212 upvotes on the board"),
    Topic("mobile", "#product", "Should we build a native mobile app or go responsive web first?", "go responsive web first", "build a native iOS app", "70% of mobile sessions are quick checks", "native feels more premium for execs", "mobile is 18% of sessions, mostly under 2 min"),
    Topic("annual-discount", "#sales", "How big should the annual discount be?", "offer 20% off annual", "offer 15% off annual", "competitors are all at 20%", "15% protects margin", "both main competitors list 20% off annual"),
    Topic("support-tool", "#support", "Should we use Intercom or Zendesk for support?", "switch to Intercom", "stay on Zendesk", "in-app chat is where tickets start anyway", "migrating macros is a pain", "62% of tickets start from the in-app widget"),
    Topic("db-migration", "#eng", "Should we move from Heroku Postgres to RDS?", "migrate to RDS in December", "stay on Heroku until after launch", "Heroku bill is up 40% since July", "a migration right before launch is risky", "heroku was $7.8k last month"),
    Topic("launch-date", "#launch-q1", "Should v2 launch on Jan 15 or Feb 1?", "launch on Feb 1", "launch on Jan 15", "docs and billing need two more weeks", "Jan 15 lines up with the conference", "billing migration is ~60% done"),
    Topic("trial-length", "#growth", "Should the free trial be 14 or 30 days?", "keep the 14-day trial", "move to a 30-day trial", "most conversions happen by day 9", "bigger teams need longer to evaluate", "median time to convert is 9 days"),
    Topic("design-hire", "#design", "Should we hire a full-time designer or keep contractors?", "hire a full-time designer", "keep contractors through Q1", "contractor handoffs are slowing every project", "budget is only approved through Q1", "we spent ~$31k on design contractors last quarter"),
    Topic("rate-limits", "#eng", "What rate limit should the public API have?", "limit to 100 requests/min per key", "allow 1,000 requests/min per key", "one customer's script took us down last week", "integrators will hit 100 fast", "the outage on the 3rd was a single key doing 4k req/min"),
    Topic("events", "#marketing", "Should we sponsor SaaStr or run our own webinar series?", "run our own webinar series", "sponsor a SaaStr booth", "webinars cost a fraction and we own the list", "SaaStr gets us in front of buyers in person", "booth quote came back at $45k"),
    Topic("feature-flags", "#eng", "Should we build feature flags in-house or buy LaunchDarkly?", "build simple flags in-house", "buy LaunchDarkly", "we only need on/off per workspace", "in-house flags always grow into a project", "LaunchDarkly is ~$12k/yr at our seat count"),
    Topic("on-call", "#ops", "Should we start a formal on-call rotation?", "start a weekly on-call rotation", "stay best-effort with no rotation", "two incidents sat for hours over the weekend", "the team is only 6 engineers", "incident on Sat took 5h to get noticed"),
    Topic("slack-scope", "#product", "Should the Slack integration read private channels?", "read public channels only", "allow private channels with admin opt-in", "trust matters more than coverage right now", "half the real discussion is in private channels", "security review flagged private-channel access"),
    Topic("ai-summaries", "#product", "Should AI summaries ship as an opt-in beta or to everyone?", "ship AI summaries as an opt-in beta", "ship AI summaries to everyone", "we haven't measured accuracy at scale", "opt-in features barely get used", "internal accuracy check was 78% on 40 threads"),
    Topic("retention", "#data", "Should we keep raw events for 90 days or a year?", "keep raw events for 90 days", "keep raw events for a year", "storage cost doubles with a year", "year-over-year analysis needs it", "S3 + warehouse cost would go from $1.1k to $2.3k/mo"),
    Topic("office", "#ops", "Should we renew the office lease or go remote-first?", "go remote-first and drop the lease", "renew the office lease", "office is under 30% used most days", "onboarding new hires is harder remote", "badge data says 27% average occupancy"),
    Topic("commission", "#sales", "Should sales commission be paid on bookings or on cash collected?", "pay commission on cash collected", "pay commission on bookings", "we got burned by two deals that never paid", "reps hate waiting for cash", "two Q3 deals worth $40k never paid"),
    Topic("onboarding-call", "#support", "Should every new team get a free onboarding call?", "offer onboarding calls only to teams over 10 seats", "offer an onboarding call to every new team", "we can't staff calls for every signup", "calls double activation for small teams too", "we get ~120 new teams a month"),
    Topic("docs-platform", "#eng", "Should we move docs to Mintlify or keep GitBook?", "move docs to Mintlify", "keep GitBook", "search in GitBook is bad and it shows in tickets", "a docs migration is a week we don't have", "14% of support tickets are 'can't find it in docs'"),
    Topic("spanish", "#growth", "Should we translate the app into Spanish this quarter?", "wait for demand data before translating", "translate the app into Spanish in Q1", "only 4% of signups are from Spanish-speaking countries", "LatAm partners keep asking", "4% of signups from ES-speaking countries"),
    Topic("win-back", "#marketing", "Should we send a win-back email sequence to churned users?", "send a 3-email win-back sequence", "skip win-back emails for now", "it's cheap and worked at Rosa's last company", "we haven't fixed the reasons they left", "churned list is ~900 accounts"),
]

NOISE = [
    "lol", "😂😂😂", "brb coffee ☕", "<https://giphy.example.com/gifs/this-is-fine-xyz123|giphy: this is fine>", "anyone else's wifi dying?",
    "happy friday 🎉", "omw", ":eyes:", "lmk if you need anything", "<https://zoom.example.com/j/9876543210|zoom link> for standup",
    "nice!!", "ty", "haha same", "heads up I'm out tomorrow 🏖️", "who's going to the meetup thursday?",
    "```npm run build``` keeps failing on my machine... nvm fixed it", "can you review my PR when you get a sec 🙏",
    "<https://git.example.com/brightline/app/pull/1234|#1234 fix flaky test>", "the coffee machine is broken again 😭", "+1",
    "sry typo'd that", "<!here> pizza in the kitchen 🍕", "🔥🔥🔥", "this meeting could've been an email tbh", "running 5 min late",
    "did anyone see the game last night", "ooh nice", ":pray:", "will do!", "😅", "back", "on it", "thanks all ❤️",
    "<https://news.example.com/2026/11/ai-tools-roundup|interesting read on AI tools>", "who has the figma link for the new icons",
    "&gt; we should sync tmrw\nyes pls", "my calendar is a disaster this week", "ok", "lgtm", "🙌", "same here", "k",
]

DISTRACTORS = [
    "we decided on tacos for lunch 🌮 obviously",
    "should we just rewrite everything in rust lol 🙃",
    "I finally decided to get the standing desk, my back thanks me",
    "what if our mascot was a gecko? jk... unless 👀",
    "<https://news.example.com/acme-sunsets-free-plan|Acme decided to kill their free plan> wild",
    "should we get a foosball table 😂 (not serious)",
    "decided I'm never doing a red-eye again",
    "team vote: pizza or sushi friday? 🍕🍣",
]

BOTS = [
    ("B01DEPLOY", "Deploybot", "✅ app@2.{n}.1 deployed to production by sam"),
    ("B02GITHUB", "GitHub", "PR #{n}23 merged: <https://git.example.com/brightline/app/pull/{n}23|tidy billing webhooks>"),
    ("B03STANDUP", "Standup", "Daily standup summary: 6 updates, 1 blocker. <https://standup.example.com/r/{n}|view>"),
    ("B04JIRA", "Jira", "BL-4{n}2 moved to Done"),
]


@dataclass
class Gold:
    id: str
    topic: str
    question: str
    status: str  # "decided" or "open"
    chosen: str | None
    options: list[str]
    style: str
    key_ts: list[str]  # messages a person would point to
    summary: str  # the human-written tag
    visible_to_reader: bool = True  # False when the outcome is only in thread replies (which Rooted read from 2026-11-18)


@dataclass
class Conversation:
    id: str
    channel_id: str
    channel: str
    messages: list[dict[str, Any]]  # top level, oldest first, as conversations.history holds them
    replies: dict[str, list[dict[str, Any]]] = field(default_factory=dict)  # thread_ts -> conversations.replies
    gold: list[Gold] = field(default_factory=list)
    distractors: int = 0


class _Builder:
    def __init__(self, rng: random.Random, start: float) -> None:
        self.rng = rng
        self.t = start
        self.messages: list[dict[str, Any]] = []
        self.replies: dict[str, list[dict[str, Any]]] = {}

    def _ts(self, gap_min: float = 4.0) -> str:
        self.t += self.rng.uniform(0.5, 2.0) * gap_min * 60
        return f"{self.t:.6f}"

    def say(self, user: str, text: str, *, gap: float = 4.0, reactions: list[tuple[str, int]] | None = None, edited: bool = False) -> str:
        ts = self._ts(gap)
        m: dict[str, Any] = {"type": "message", "user": user, "text": text, "ts": ts, "team": "T0BRIGHT"}
        if reactions:
            m["reactions"] = [{"name": n, "count": c, "users": self.rng.sample(PEOPLE, min(c, len(PEOPLE)))} for n, c in reactions]
        if edited:
            m["edited"] = {"user": user, "ts": f"{self.t + 30:.6f}"}
        self.messages.append(m)
        return ts

    def thread(self, parent_ts: str, user: str, text: str) -> str:
        ts = self._ts(2.0)
        reply = {"type": "message", "user": user, "text": text, "ts": ts, "thread_ts": parent_ts, "parent_user_id": self.messages[-1]["user"]}
        self.replies.setdefault(parent_ts, []).append(reply)
        parent = next(m for m in self.messages if m["ts"] == parent_ts)
        parent["thread_ts"] = parent_ts
        parent["reply_count"] = len(self.replies[parent_ts])
        parent["latest_reply"] = ts
        return ts

    def bot(self) -> None:
        bot_id, name, text = self.rng.choice(BOTS)
        self.messages.append({"type": "message", "subtype": "bot_message", "bot_id": bot_id, "username": name, "text": text.format(n=self.rng.randint(1, 9)), "ts": self._ts()})

    def join(self) -> None:
        user = self.rng.choice(PEOPLE)
        self.messages.append({"type": "message", "subtype": "channel_join", "user": user, "text": f"<@{user}> has joined the channel", "ts": self._ts()})

    def noise(self, n: int) -> None:
        for _ in range(n):
            roll = self.rng.random()
            if roll < 0.12:
                self.bot()
            elif roll < 0.17:
                self.join()
            else:
                text = self.rng.choice(NOISE)
                if self.rng.random() < 0.2:
                    text = f"<@{self.rng.choice(PEOPLE)}> {text}"
                self.say(self.rng.choice(PEOPLE), text, gap=self.rng.uniform(1, 30), reactions=[(self.rng.choice(["joy", "+1", "eyes", "fire"]), self.rng.randint(1, 3))] if self.rng.random() < 0.25 else None)

    def others(self, *exclude: str) -> list[str]:
        pool = [p for p in PEOPLE if p not in exclude]
        self.rng.shuffle(pool)
        return pool


def _lower(q: str) -> str:
    return q[0].lower() + q[1:].rstrip("?")


def _decision(b: _Builder, topic: Topic, style: str, gid: str) -> Gold:
    rng = b.rng
    x, y, z, w = b.others(PM)[:4]
    say = b.say
    opts = [topic.a, topic.b]
    if style == "explicit":
        k1 = say(PM, f"we need to make a call on this: {_lower(topic.question)}? options are {topic.a} or {topic.b}")
        b.noise(rng.randint(0, 2))
        say(x, topic.evidence)
        say(y, f"fwiw I'd rather {topic.b}, {topic.why_b}")
        b.noise(rng.randint(0, 2))
        k2 = say(PM, f"ok decision: we're going to {topic.a}. {topic.why_a.capitalize()}. I'll write it up :white_check_mark:", reactions=[("white_check_mark", rng.randint(2, 5))])
        return Gold(gid, topic.id, topic.question, "decided", topic.a, opts, style, [k1, k2], f"Decided to {topic.a} rather than {topic.b}, because {topic.why_a}.")
    if style == "consensus":
        k1 = say(x, f"I think we should {topic.a} tbh, {topic.why_a}")
        say(y, "+1")
        b.noise(rng.randint(0, 1))
        k2 = say(z, "sgtm :+1:")
        say(x, "cool I'll make the ticket 🎫")
        return Gold(gid, topic.id, topic.question, "decided", topic.a, opts, style, [k1, k2], f"The team agreed to {topic.a}, because {topic.why_a}.")
    if style == "open":
        k1 = say(PM, f"<!here> we have to decide {_lower(topic.question)} by {rng.choice(['friday', 'end of next week', 'the 20th'])}")
        say(x, f"I'd say we {topic.a}: {topic.why_a}")
        b.noise(rng.randint(0, 2))
        say(y, f"hmm I'd rather {topic.b}, {topic.why_b}")
        say(z, topic.evidence)
        k2 = say(PM, "ok let's take it to thursday's sync, no call yet 🤔")
        return Gold(gid, topic.id, topic.question, "open", None, opts, style, [k1, k2], f"Still open: {topic.a} vs {topic.b}; to be settled at Thursday's sync.")
    if style == "reversed":
        k1 = say(PM, f"decision: we'll {topic.b}. {topic.why_b}")
        say(x, "👍")
        b.noise(rng.randint(2, 4))
        b.t += 86400 * rng.uniform(1, 2)
        k2 = say(PM, f"update: scratch that, after {rng.choice(['talking to Leo', 'looking at the numbers again', 'the customer calls'])} we're going to {topic.a} instead. {topic.evidence}", edited=True)
        say(y, "makes sense 👌")
        return Gold(gid, topic.id, topic.question, "decided", topic.a, opts, style, [k1, k2], f"First chose to {topic.b}, then reversed: decided to {topic.a} instead.")
    if style == "threaded":
        k1 = say(PM, f"quick poll: {topic.question} 🅰️ {topic.a} / 🅱️ {topic.b}. reply in thread 🧵")
        b.thread(k1, x, "🅰️")
        b.thread(k1, y, f"A for sure, {topic.why_a}")
        b.thread(k1, z, f"B. {topic.why_b}")
        k2 = b.thread(k1, PM, f"ok votes are in, we'll {topic.a}. thanks all!")
        return Gold(gid, topic.id, topic.question, "decided", topic.a, opts, style, [k1, k2], f"Polled the team; decided to {topic.a}.", visible_to_reader=False)
    if style == "reaction":
        k1 = say(PM, f"proposal: {topic.a} ({topic.why_a}). react ✅ if you're good, otherwise reply here", reactions=[("white_check_mark", rng.randint(4, 6))])
        b.noise(rng.randint(1, 3))
        k2 = say(PM, "ok no objections, it's a go")
        return Gold(gid, topic.id, topic.question, "decided", topic.a, opts, style, [k1, k2], f"Proposed {topic.a}; approved by reactions with no objections.")
    if style == "buried":
        b.noise(rng.randint(2, 4))
        k1 = say(w, f"fyi we're going to {topic.a}: {topic.why_a}. ({topic.evidence})")
        b.noise(rng.randint(2, 4))
        return Gold(gid, topic.id, topic.question, "decided", topic.a, opts, style, [k1], f"Announced in passing: decided to {topic.a}, because {topic.why_a}.")
    raise ValueError(style)


STYLES = ["explicit", "consensus", "open", "reversed", "threaded", "reaction", "buried"]


def build(n: int = 50, seed: int = SEED) -> list[Conversation]:
    """The corpus. Deterministic for a given seed."""
    rng = random.Random(seed)
    # 8 snapshots with no decision, 30 with one, 12 with two.
    plan = [0] * 8 + [1] * 30 + [2] * 12
    plan = (plan * (n // len(plan) + 1))[:n]
    rng.shuffle(plan)
    topics = TOPICS * 4
    rng.shuffle(topics)
    styles = STYLES * 20
    rng.shuffle(styles)
    convs: list[Conversation] = []
    for i, k in enumerate(plan):
        start = NOW - 86400 * rng.uniform(6, 24)
        b = _Builder(rng, start)
        chosen = [topics.pop() for _ in range(k)]
        channel = chosen[0].channel if chosen else rng.choice(["#random", "#general", "#watercooler"])
        gold: list[Gold] = []
        b.noise(rng.randint(2, 5))
        if rng.random() < 0.3:
            b.join()
        distractors = 0
        for j, topic in enumerate(chosen):
            gold.append(_decision(b, topic, styles.pop(), f"g{i:02d}-{j}"))
            b.noise(rng.randint(2, 6))
        for _ in range(2 if k == 0 else rng.choice([0, 0, 1])):
            b.say(rng.choice(PEOPLE), rng.choice(DISTRACTORS), reactions=[("joy", rng.randint(1, 4))])
            distractors += 1
            b.noise(rng.randint(1, 3))
        convs.append(Conversation(f"conv-{i:02d}", f"C{i:02d}BRIGHT", channel, b.messages, b.replies, gold, distractors))
    return convs


# ── Serving it like Slack ────────────────────────────────────────────────


class FakeSlackWorkspace:
    """Answers the Web API calls rooted_ai.slack makes, from one conversation.

    Like the real API, conversations.history returns only top-level messages,
    newest first, and conversations.replies returns a thread, parent first.
    """

    def __init__(self, conv: Conversation) -> None:
        self.conv = conv

    def call(self, method: str, token: str | None = None, **params: Any) -> dict[str, Any]:
        if method == "conversations.list":
            return {"ok": True, "channels": [{"id": self.conv.channel_id, "name": self.conv.channel.lstrip("#"), "is_member": True, "num_members": 9}], "response_metadata": {"next_cursor": ""}}
        if method == "conversations.history":
            oldest = float(params.get("oldest", 0))
            return {"ok": True, "messages": [m for m in reversed(self.conv.messages) if float(m["ts"]) >= oldest], "has_more": False}
        if method == "conversations.replies":
            ts = params.get("ts", "")
            parent = [m for m in self.conv.messages if m["ts"] == ts]
            return {"ok": True, "messages": parent + self.conv.replies.get(ts, [])}  # like Slack: the parent first
        if method == "users.info":
            uid = params.get("user", "")
            return {"ok": True, "user": {"id": uid, "real_name": USERS.get(uid, "Someone"), "name": USERS.get(uid, "someone").split()[0].lower()}}
        return {"ok": True}


def human_view(conv: Conversation) -> list[dict[str, Any]]:
    """What a person scrolling the channel sees: every message, thread replies and reactions included, oldest first."""
    out = []
    for m in conv.messages:
        out.append(_readable(m))
        for reply in conv.replies.get(m["ts"], []):
            out.append({**_readable(reply), "inThreadOf": m["ts"]})
    return out


def _readable(m: dict[str, Any]) -> dict[str, Any]:
    who = USERS.get(m.get("user", ""), m.get("username") or "bot")
    item: dict[str, Any] = {"ts": m["ts"], "author": who, "text": m["text"]}
    if m.get("subtype"):
        item["subtype"] = m["subtype"]
    if m.get("reactions"):
        item["reactions"] = {r["name"]: r["count"] for r in m["reactions"]}
    return item
