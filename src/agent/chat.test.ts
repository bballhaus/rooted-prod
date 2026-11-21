// What the chat sends to Claude: never context the PM removed or marked wrong,
// never replies quoting a channel they've since turned off, never failed turns.
import { describe, expect, it } from 'vitest';
import { seedState } from '../data/fixtures';
import { reducer } from '../store/store';
import { fakeAi } from '../test/fakeAi';
import type { AppState, ChatMessage } from '../types';
import { askAgent, withoutIds } from './chat';

const SNIPPET = 'Third admin this week who invited the team, left, and came back two days later unsure what was next.';

const state = (): AppState => seedState();
const sent = (ai: ReturnType<typeof fakeAi>) => ai.run.mock.calls[0][1];

describe('chat payload', () => {
  it('F-08: context the PM removed or marked wrong is never sent', async () => {
    const s = state();
    s.contextItems = s.contextItems.map((c, i) => ({ ...c, flaggedInaccurate: i % 2 === 0, removed: i % 2 === 1 }));
    const ai = fakeAi();
    await askAgent(ai, 'What happened?', { decisionId: 'd-onboarding-checklist' }, s);
    expect(sent(ai).context).toEqual([]);
  });

  it('F-02: after a channel is turned off, replies that quoted it are not sent back as history', async () => {
    const history: ChatMessage[] = [
      { id: 'm1', threadId: 'd-onboarding-checklist', role: 'user', text: 'What did support say?', createdAt: '2026-10-30T10:00:00.000Z' },
      { id: 'm2', threadId: 'd-onboarding-checklist', role: 'agent', text: `Priya (Support) in #customer-feedback: “${SNIPPET}”`, createdAt: '2026-10-30T10:00:01.000Z' },
    ];
    const s1 = reducer({ ...state(), messages: history }, { type: 'setChannelAllowed', sourceId: 'src-slack', channelId: 'ch-support', allowed: false });
    const ai = fakeAi();
    await askAgent(ai, 'And now?', { decisionId: 'd-onboarding-checklist' }, s1, s1.messages);
    expect(JSON.stringify(sent(ai))).not.toContain(SNIPPET);
  });

  it('F-12: a failed turn is not sent as conversation', async () => {
    const history: ChatMessage[] = [
      { id: 'm1', threadId: 'general', role: 'user', text: 'Hi', createdAt: '2026-10-30T10:00:00.000Z' },
      { id: 'm2', threadId: 'general', role: 'agent', text: 'The AI is busy right now.', failed: true, retry: 'Hi', createdAt: '2026-10-30T10:00:01.000Z' },
    ];
    const ai = fakeAi();
    await askAgent(ai, 'Hi', {}, state(), history);
    expect(sent(ai).history).toEqual([{ role: 'user', text: 'Hi' }]);
  });

  it('a very long question is shortened to the service’s limit rather than refused', async () => {
    const ai = fakeAi();
    await askAgent(ai, 'x'.repeat(5000), {}, state());
    expect(sent(ai).question.length).toBeLessThanOrEqual(2000);
    expect(sent(ai).question.endsWith('[shortened]')).toBe(true);
  });

  it('F-12: the decision on screen is sent with its open options and open questions', async () => {
    const s = state();
    s.decisions = [{ ...s.decisions[0], id: 'd-x', status: 'options', chosenOptionId: undefined }, ...s.decisions];
    s.options = [
      ...s.options,
      { id: 'o-a', decisionId: 'd-x', parentId: null, label: 'Annual discount', summary: 'Give 2 months free', pros: ['Cash up front'], cons: [], score: 60, criteria: { effort: 2 }, contextIds: [], state: 'open' },
      { id: 'o-b', decisionId: 'd-x', parentId: null, label: 'Usage add-on', summary: '', pros: [], cons: [], score: 40, contextIds: [], state: 'pruned', pruneReason: 'Too slow' },
    ];
    s.gaps = [...s.gaps, { id: 'g-x', decisionId: 'd-x', question: 'What do customers pay now?' }];
    const ai = fakeAi();
    await askAgent(ai, 'Which option is cheapest to try?', { decisionId: 'd-x' }, s);
    const here = sent(ai).decisions.find((d: { id: string }) => d.id === 'd-x');
    expect(here.inScope).toBe(true);
    expect(here.options.map((o: { option: string }) => o.option)).toEqual(['Annual discount']);
    expect(here.options[0]).toMatchObject({ summary: 'Give 2 months free', pros: ['Cash up front'], ratings: { effort: 2 } });
    expect(here.notTaken).toEqual([{ option: 'Usage add-on', reason: 'Too slow' }]);
    expect(here.openQuestions).toEqual(['What do customers pay now?']);
    // Other decisions stay compact.
    expect(sent(ai).decisions.filter((d: { options?: unknown }) => d.options)).toHaveLength(1);
  });

  it('F-12: decision ids in a reply become the decision’s question', async () => {
    const s = state();
    const ai = fakeAi({ chat: { text: 'See d-onboarding-checklist and (d-onboarding-checklist).', citations: [] } });
    const answer = await askAgent(ai, 'Any related past decisions?', {}, s);
    const q = s.decisions.find((d) => d.id === 'd-onboarding-checklist')!.question;
    // The question keeps its own "?" without a full stop doubled after it.
    expect(answer.text).toBe(`See “${q}” and “${q}”`);
    expect(answer.text).not.toContain('d-onboarding');
  });
});

describe('withoutIds', () => {
  const decisions = [
    { id: 'd-pricing-seats', question: 'Per seat?' },
    { id: 'd-pricing-seats-v2', question: 'Per seat, again?' },
  ] as AppState['decisions'];

  it('replaces the longest matching id, with any quotes or backticks around it', () => {
    expect(withoutIds('`d-pricing-seats-v2` then "d-pricing-seats".', { decisions })).toBe(
      '“Per seat, again?” then “Per seat?”',
    );
  });

  it('leaves words that only contain an id alone', () => {
    expect(withoutIds('xd-pricing-seats and d-pricing-seats-v3', { decisions })).toBe('xd-pricing-seats and d-pricing-seats-v3');
  });
});
