import { describe, expect, it } from 'vitest';
import { demoUser, seedState } from '../data/fixtures';
import type { AppState } from '../types';
import { scriptedReply } from './chat';
import { askAgent, suggestTags } from './index';
import { suggestTagsNow } from './tags';

const TODAY = '2026-10-31';
const state = (): AppState => ({ ...seedState(), user: structuredClone(demoUser) });
const ids = (r: { citations: { decisionId: string }[] }) => r.citations.map((c) => c.decisionId);

describe('scripted agent (no LLM configured)', () => {
  it('F-12: explains why a decision went the way it did, with the options not taken, and cites it', () => {
    const r = scriptedReply('Why did we choose the checklist?', {}, state(), TODAY);
    expect(r.text).toMatch(/chose “Setup checklist”/);
    expect(r.text).toMatch(/Passed on “Guided product tour”/);
    expect(ids(r)).toContain('d-onboarding-checklist');
  });

  it('F-12: lists what a teammate decided', () => {
    const r = scriptedReply('What has Rafael decided?', {}, state(), TODAY);
    expect(r.text).toMatch(/Rafael Ortiz/);
    expect(ids(r)).toEqual(expect.arrayContaining(['d-q4-bet', 'd-annual-discount']));
    expect(ids(r)).not.toContain('d-onboarding-checklist');
  });

  it('F-16: lists outcomes that are due', () => {
    const r = scriptedReply('What outcomes are due?', {}, state(), TODAY);
    expect(ids(r)).toEqual(expect.arrayContaining(['d-onboarding-checklist', 'd-digest-cadence']));
  });

  it('lists decisions by tag', () => {
    const r = scriptedReply('show me #pricing decisions', {}, state(), TODAY);
    expect(r.text).toMatch(/tagged #pricing/);
    expect(ids(r)).toContain('d-pricing-seats');
  });

  it('F-12: a tag with regex characters in it does not break answers', () => {
    const s = state();
    s.decisions[0] = { ...s.decisions[0], tags: [{ label: 'c++', origin: 'user' }, { label: 'q4 (draft', origin: 'user' }] };
    expect(() => scriptedReply('Why did we choose the checklist?', {}, s, TODAY)).not.toThrow();
    expect(scriptedReply('anything about c++?', {}, s, TODAY).text).toMatch(/tagged #c\+\+/);
  });

  it('says so when nothing matches instead of making something up', () => {
    const r = scriptedReply('zebra crossings for llamas', {}, state(), TODAY);
    expect(r.text).toMatch(/couldn’t find/);
    expect(r.citations).toEqual([]);
  });

  it('F-12: inside a decision, compares the open options without choosing one', () => {
    const s = state();
    s.options.push(
      { id: 'o-a', decisionId: 'd-trial-card', parentId: null, label: 'Card up front', summary: '', pros: ['Higher intent'], cons: ['Fewer starts'], score: 60, contextIds: [], state: 'open' },
      { id: 'o-b', decisionId: 'd-trial-card', parentId: null, label: 'No card', summary: '', pros: ['More starts'], cons: ['Lower intent'], score: 55, contextIds: [], state: 'open' },
    );
    const r = scriptedReply('Which option should I pick?', { decisionId: 'd-trial-card' }, s, TODAY);
    expect(r.text).toMatch(/I won’t make the call/);
    expect(r.text).toMatch(/Card up front/);
    expect(r.text).toMatch(/No card/);
  });

  it('F-13: scoped to one option, talks about that option only', () => {
    const s = state();
    const r = scriptedReply('What could make this wrong?', { decisionId: 'd-mobile-push', optionId: 'o-mp-email' }, s, TODAY);
    expect(r.text).toMatch(/Email digests first/);
    expect(r.text).toMatch(/enterprise ask/);
    expect(r.text).not.toMatch(/Build push now/);
  });
});

describe('askAgent', () => {
  it('falls back to the scripted agent and marks the answer as a sample when no LLM is configured', async () => {
    const answer = await askAgent('Why did we choose the checklist?', {}, state());
    expect(answer.sample).toBe(true);
    expect(answer.citations[0].decisionId).toBe('d-onboarding-checklist');
  });

  it('suggests tags from the question and skips ones already on the decision', async () => {
    expect(suggestTagsNow('Raise seat prices for annual plans?', '', [], [])).toContain('pricing');
    expect(suggestTagsNow('Raise seat prices for annual plans?', '', ['pricing'], [])).not.toContain('pricing');
    const result = await suggestTags('Should trials send a digest email?', '', [], []);
    expect(result.sample).toBe(true);
    expect(result.tags).toEqual(expect.arrayContaining(['trials', 'notifications']));
  });
});
