// What the chat sends to Claude: never context the PM removed or marked wrong,
// never replies quoting a channel they've since turned off, never failed turns.
import { describe, expect, it } from 'vitest';
import { seedState } from '../data/fixtures';
import { reducer } from '../store/store';
import { fakeAi } from '../test/fakeAi';
import type { AppState, ChatMessage } from '../types';
import { askAgent } from './chat';

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
});
