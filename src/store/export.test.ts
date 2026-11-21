import { describe, expect, it } from 'vitest';
import { demoUser, seedState } from '../data/fixtures';
import { decisionsMarkdown } from './export';

describe('decisionsMarkdown', () => {
  it('F-23: exports each decision with its choice, rationale, pruned options with reasons, and outcome', () => {
    const state = { ...seedState(), user: structuredClone(demoUser) };
    const md = decisionsMarkdown(state, new Date('2026-11-21T12:00:00Z'));
    expect(md).toMatch(/^# Decisions from Rooted/);
    expect(md).toContain('Exported Nov 21, 2026.');
    expect(md).toContain('## Should onboarding use a checklist or a guided tour?');
    expect(md).toContain('**Chose:** ');
    expect(md).toContain('**Why:** Interviews showed admins come back to setup over several days');
    expect(md).toContain('**Options not taken:**');
    const pruned = state.options.find((o) => o.decisionId === 'd-onboarding-checklist' && o.state === 'pruned')!;
    expect(md).toContain(`- ${pruned.label}: ${pruned.pruneReason}`);
    expect(md).toMatch(/\*\*Outcome \(.+\):\*\* /);
    // Every decision is in it, newest first.
    expect(md.match(/^## /gm)).toHaveLength(state.decisions.length);
  });

  it('says so when there is nothing to export', () => {
    const md = decisionsMarkdown({ ...seedState(), decisions: [] });
    expect(md).toContain('No decisions yet.');
  });
});
