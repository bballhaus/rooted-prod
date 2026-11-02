import { buildBrief, describeSourceAccess } from '../../agent/brief';
import { slackCorpus, driveCorpus } from '../../data/slackCorpus';
import { signedInState } from '../../test/render';
import type { AppState, Decision } from '../../types';

function trialDecision(patch: Partial<Decision> = {}): Decision {
  return {
    id: 'd-trial',
    question: 'Should we extend the free trial from 14 to 30 days?',
    notes: 'Trial-to-paid conversion is flat and sales keeps asking for longer trials.',
    links: ['https://example.com/trial-dashboard'],
    constraints: ['Billing changes need two weeks notice'],
    status: 'brief',
    createdAt: '2026-10-27T17:00:00.000Z',
    ...patch,
  };
}

function withDriveConnected(state: AppState): AppState {
  return {
    ...state,
    sources: state.sources.map((s) => (s.type === 'google-drive' ? { ...s, connected: true } : s)),
  };
}

describe('brief agent', () => {
  it('F-06: pulls matching messages only from allowed channels of connected sources', () => {
    const state = signedInState();
    const { items } = buildBrief(trialDecision(), state);
    const slackItems = items.filter((i) => i.origin === 'slack');
    expect(slackItems.length).toBeGreaterThan(0);
    const blockedTexts = slackCorpus
      .filter((m) => ['ch-sales', 'ch-leadership', 'ch-random'].includes(m.channelId))
      .map((m) => m.text);
    for (const item of items) {
      expect(blockedTexts).not.toContain(item.snippet);
      expect(['#sales', '#leadership', '#random']).not.toContain(item.sourceLabel);
    }
    // Drive is disconnected in the seed, so nothing from it.
    expect(items.some((i) => i.origin === 'drive')).toBe(false);
  });

  it('F-06: reads allowed Drive folders once connected, never a blocked folder', () => {
    const state = withDriveConnected(signedInState());
    const decision = trialDecision({ question: 'Should we raise Team pricing or add a paused plan to cut churn?' });
    const { items } = buildBrief(decision, state);
    const drive = items.filter((i) => i.origin === 'drive');
    expect(drive.length).toBeGreaterThan(0);
    const finance = driveCorpus.filter((d) => d.folderId === 'fd-finance').map((d) => d.text);
    for (const item of items) expect(finance).not.toContain(item.snippet);
  });

  it('F-06: a channel the PM blocks later is dropped', () => {
    const state = signedInState();
    state.sources[0].channels = state.sources[0].channels.map((c) =>
      c.id === 'ch-growth' ? { ...c, allowed: false } : c,
    );
    const { items } = buildBrief(trialDecision(), state);
    expect(items.some((i) => i.sourceLabel === '#growth')).toBe(false);
  });

  it('F-06: adds related past decisions and the PM notes and links', () => {
    const decision = trialDecision({ question: 'Should the onboarding checklist add a step for sharing a board?' });
    const { items } = buildBrief(decision, signedInState());
    const past = items.find((i) => i.origin === 'past-decision');
    expect(past?.sourceLabel).toBe('Past decision: Should onboarding use a checklist or a guided tour?');
    expect(past?.snippet).toContain('Ship a 5-step checklist');
    const notes = items.filter((i) => i.origin === 'user-note');
    expect(notes.map((n) => n.snippet)).toContain(decision.notes);
    expect(notes.some((n) => n.link === 'https://example.com/trial-dashboard')).toBe(true);
  });

  it('F-07: groups items by theme', () => {
    const { items } = buildBrief(trialDecision(), signedInState());
    expect(items.every((i) => i.group.length > 0)).toBe(true);
    expect(new Set(items.map((i) => i.group)).size).toBeGreaterThan(1);
  });

  it('F-06: falls back to recent allowed messages when nothing matches', () => {
    const decision = trialDecision({ question: 'Zebra?', notes: '', links: [], constraints: [] });
    const { items } = buildBrief(decision, signedInState());
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.group === 'Recent activity')).toBe(true);
  });

  it('F-06: never returns an empty brief, even with Slack disconnected', () => {
    const state = signedInState();
    state.sources = state.sources.map((s) => ({ ...s, connected: false }));
    const { items, gaps } = buildBrief(trialDecision({ notes: '', links: [] }), state);
    expect(items.length).toBeGreaterThan(0);
    expect(gaps.length).toBeGreaterThanOrEqual(2);
  });

  it('F-09: returns 2 to 4 specific gaps, naming a relevant blocked channel and disconnected Drive', () => {
    const { gaps } = buildBrief(trialDecision(), signedInState());
    expect(gaps.length).toBeGreaterThanOrEqual(2);
    expect(gaps.length).toBeLessThanOrEqual(4);
    const text = gaps.map((g) => g.question).join(' ');
    expect(text).toMatch(/#sales isn't in your allowed channels/);
    expect(text).toMatch(/Google Drive isn't connected/);
  });

  it('F-06: describes which sources were read and which were excluded', () => {
    const access = describeSourceAccess(signedInState());
    expect(access.read).toContain('#growth');
    expect(access.excluded).toContainEqual({ label: '#sales', reason: 'not allowed' });
    expect(access.excluded).toContainEqual({ label: 'Google Drive', reason: 'not connected' });
  });
});
