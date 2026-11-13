import { describe, expect, it } from 'vitest';
import { briefSource, describeSourceAccess, gatherBrief, sampleMessages } from '../../agent/brief';
import { emptyWorkspaceState, seedState } from '../../data/fixtures';
import { fakeAi } from '../../test/fakeAi';
import type { AppState, Decision } from '../../types';

const decision: Decision = {
  id: 'd-new',
  question: 'Should onboarding add a setup checklist?',
  notes: 'Admins drop off after inviting teammates.',
  links: [],
  constraints: [],
  status: 'framing',
  createdAt: '2026-10-28T00:00:00.000Z',
};

const withDecision = (s: AppState): AppState => ({ ...s, decisions: [decision, ...s.decisions] });
const sources = (s: AppState) => new Set(sampleMessages(s).map((m) => m.source));

describe('brief agent', () => {
  it('F-06: sends sample messages only from allowed channels of connected sources', () => {
    const s = seedState();
    const read = sources(s);
    for (const c of s.sources.find((x) => x.type === 'slack')!.channels) {
      expect(read.has(c.name)).toBe(c.allowed);
    }
    // Drive is disconnected in the sample workspace, so none of it is sent.
    expect([...read].some((label) => label.startsWith('Drive:'))).toBe(false);
  });

  it('F-06: reads allowed Drive folders once connected, never a blocked folder', () => {
    const s = seedState();
    s.sources = s.sources.map((x) => (x.type === 'google-drive' ? { ...x, connected: true } : x));
    const refs = sampleMessages(s).filter((m) => m.ref.startsWith('drive:'));
    expect(refs.length).toBeGreaterThan(0);
    const blocked = s.sources.find((x) => x.type === 'google-drive')!.channels.filter((c) => !c.allowed).map((c) => c.id);
    expect(refs.every((m) => !blocked.some((id) => m.ref.includes(id)))).toBe(true);
  });

  it('F-06: a channel the PM blocks later is no longer sent', () => {
    const s = seedState();
    const slack = s.sources.find((x) => x.type === 'slack')!;
    const channel = slack.channels.find((c) => c.allowed)!;
    channel.allowed = false;
    expect(sources(s).has(channel.name)).toBe(false);
  });

  it('F-06: a live Slack is read on the server: only the allowed channel ids go, never message text', async () => {
    const s = withDecision(emptyWorkspaceState());
    s.sources = s.sources.map((x) =>
      x.type === 'slack'
        ? { ...x, connected: true, channels: [{ id: 'C1', name: '#pricing', memberCount: 4, allowed: true }, { id: 'C2', name: '#random', memberCount: 9, allowed: false }] }
        : x,
    );
    expect(briefSource(s)).toEqual({ kind: 'slack', channelIds: ['C1'] });
    const ai = fakeAi();
    await gatherBrief(ai, decision, s);
    const payload = ai.run.mock.calls[0][1];
    expect(payload.source).toEqual({ kind: 'slack', channelIds: ['C1'] });
    expect(payload.messages).toEqual([]);
  });

  it('F-06, F-07: maps what Claude picked to grouped context items, and its gaps to gaps', async () => {
    const s = withDecision(seedState());
    const ai = fakeAi({
      brief: {
        items: [
          { kind: 'message', ref: 'C1:1.0', group: 'Customer signal', source: '#pricing', author: 'Sam', date: '2026-11-01', text: 'Seats confuse buyers', link: 'https://acme.slack.com/archives/C1/p10' },
          { kind: 'message', ref: 'drive:dr-1', group: 'Research', source: 'Drive: Interview notes', author: null, date: '2026-10-01', text: 'Setup takes days' },
          { kind: 'past-decision', ref: 'd-pricing-seats', group: 'History', source: 'Past decision: Charge per seat?', date: '2026-09-18', text: 'Per workspace' },
        ],
        gaps: ['What completion rate would make this worth it?'],
      },
    });
    const { items, gaps } = await gatherBrief(ai, decision, s);
    expect(items.map((i) => [i.origin, i.group, i.sourceLabel])).toEqual([
      ['slack', 'Customer signal', '#pricing'],
      ['drive', 'Research', 'Drive: Interview notes'],
      ['past-decision', 'History', 'Past decision: Charge per seat?'],
      // The PM's own notes come along as theirs, not as Claude's pick.
      ['user-note', 'Your notes', 'Your framing notes'],
    ]);
    expect(items[0]).toMatchObject({ id: 'd-new-C1:1.0', decisionId: 'd-new', link: 'https://acme.slack.com/archives/C1/p10', removed: false });
    expect(gaps).toEqual([{ id: 'd-new-gap-1', decisionId: 'd-new', question: 'What completion rate would make this worth it?' }]);
    // Past decisions are sent, but never the decision being framed.
    expect(ai.run.mock.calls[0][1].pastDecisions.every((d: { id: string }) => d.id !== 'd-new')).toBe(true);
  });

  it('F-06: describes which sources were read and which were excluded, and why', () => {
    const access = describeSourceAccess(seedState());
    expect(access.read).toContain('#product');
    expect(access.read).toContain('Your past decisions');
    expect(access.excluded).toContainEqual({ label: '#sales', reason: 'not allowed' });
    expect(access.excluded).toContainEqual({ label: 'Google Drive', reason: 'not connected' });
    expect(describeSourceAccess(emptyWorkspaceState()).excluded).toContainEqual({ label: 'Google Drive', reason: 'not available yet' });
  });
});
