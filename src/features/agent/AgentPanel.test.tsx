import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeAi } from '../../test/fakeAi';
import { sampleOptions } from '../../test/options';
import { STORAGE_KEY } from '../../store/store';
import { renderApp, signedInState } from '../../test/render';
import type { AppState, Decision } from '../../types';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-31T12:00:00'));
});
afterEach(() => vi.useRealTimers());

const WAIT = { timeout: 3000 };
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as AppState;
const panel = () => screen.getByRole('complementary', { name: /Rooted/ });

describe('Agent panel', () => {
  it('F-12: the corner launcher opens the chat; Claude’s answers cite decisions as links to the map', async () => {
    const ai = fakeAi({ chat: { text: 'You chose “Setup checklist” for the setup flow.', citations: ['d-onboarding-checklist'] } });
    const { user } = renderApp('/', signedInState(), { ai });
    await user.click(screen.getByRole('button', { name: 'Ask Rooted' }));
    expect(screen.queryByRole('button', { name: 'Ask Rooted' })).not.toBeInTheDocument();
    await user.type(within(panel()).getByLabelText('Ask Rooted'), 'Why did we choose the checklist?{Enter}');
    const log = within(panel()).getByRole('log');
    expect(within(log).getByText('Why did we choose the checklist?')).toBeInTheDocument();
    expect(await within(log).findByText(/chose “Setup checklist”/, {}, WAIT)).toBeInTheDocument();
    expect(within(log).queryByText('Sample answer')).not.toBeInTheDocument();
    const [task, payload] = ai.run.mock.calls[0];
    expect(task).toBe('chat');
    expect(payload.question).toBe('Why did we choose the checklist?');
    expect(payload.decisions.length).toBe(signedInState().decisions.length);
    const cited = within(log).getByRole('list', { name: 'Decisions this answer used' });
    expect(within(cited).getByRole('link', { name: 'Should onboarding use a checklist or a guided tour?' })).toHaveAttribute(
      'href',
      '/?focus=d-onboarding-checklist',
    );
  });

  it('F-08, F-28: every answer can be edited and reported', async () => {
    const { user } = renderApp('/');
    await user.click(screen.getByRole('button', { name: 'Ask Rooted' }));
    await user.click(within(panel()).getByRole('button', { name: 'What outcomes are due?' }));
    const log = within(panel()).getByRole('log');
    await within(log).findByText(/Here’s what I found about “What outcomes are due\?”/, {}, WAIT);
    expect(within(log).getByRole('button', { name: 'Report wrong answer' })).toBeInTheDocument();
    await user.click(within(log).getByRole('button', { name: 'Edit' }));
    const box = within(log).getByLabelText('Edit Rooted’s answer');
    await user.clear(box);
    await user.type(box, 'Two outcomes are due.');
    await user.click(within(log).getByRole('button', { name: 'Save' }));
    expect(within(log).getByText('Two outcomes are due.')).toBeInTheDocument();
    expect(within(log).getByText('Edited')).toBeInTheDocument();
    expect(stored().messages.find((m) => m.role === 'agent')?.edited).toBe(true);
  });

  it('AI search: pressing Enter in the header search asks Rooted', async () => {
    const { user } = renderApp('/');
    await user.type(screen.getByRole('searchbox', { name: 'Search or ask about decisions' }), 'What has Rafael decided?{Enter}');
    expect(await within(panel()).findByText(/Here’s what I found about “What has Rafael decided\?”/, {}, WAIT)).toBeInTheDocument();
  });

  it('F-12: when Claude can’t answer, the chat says why and offers to ask again', async () => {
    const ai = fakeAi({ chat: 'rate_limited' });
    const { user } = renderApp('/', signedInState(), { ai });
    await user.click(screen.getByRole('button', { name: 'Ask Rooted' }));
    await user.type(within(panel()).getByLabelText('Ask Rooted'), 'What is still open?{Enter}');
    const log = within(panel()).getByRole('log');
    expect(await within(log).findByText(/That’s a lot of requests in a few minutes/, {}, WAIT)).toBeInTheDocument();
    // A failed answer isn't an answer: nothing to edit or report, and it isn't sent back as history.
    expect(within(log).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    delete ai.answers.chat;
    await user.click(within(log).getByRole('button', { name: 'Ask again' }));
    expect(await within(log).findByText(/Here’s what I found about “What is still open\?”/, {}, WAIT)).toBeInTheDocument();
    const retried = ai.run.mock.calls[1][1];
    expect(retried.history.some((m: { text: string }) => /lot of requests/.test(m.text))).toBe(false);
  });

  it('starting a new decision from the chat opens the new decision page beside it', async () => {
    const { user } = renderApp('/');
    await user.click(screen.getByRole('button', { name: 'Ask Rooted' }));
    await user.click(within(panel()).getByRole('button', { name: 'Start a new decision' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Frame a decision' })).toBeInTheDocument();
    expect(panel()).toBeInTheDocument();
  });

  it('F-13: "Talk it through" on an option opens a chat about that option', async () => {
    const trial: Decision = {
      id: 'd-trial',
      question: 'Should the trial use a usage limit or a 14-day time limit?',
      notes: '',
      links: [],
      constraints: [],
      status: 'options',
      createdAt: '2026-10-20T17:00:00.000Z',
    };
    const base = signedInState();
    const state = { ...base, decisions: [trial, ...base.decisions] };
    state.options = [...state.options, ...sampleOptions(trial, state.contextItems)];
    const ai = fakeAi();
    const { user } = renderApp('/decisions/d-trial/work', state, { ai });
    const options = screen.getByRole('region', { name: 'Options' });
    await user.click(within(options).getByRole('button', { name: 'Talk it through Usage limit' }));
    expect(within(panel()).getByText('Talking through “Usage limit”')).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: 'What could make this wrong?' }));
    expect(await within(panel()).findByText(/Here’s what I found about “What could make this wrong\?”/, {}, WAIT)).toBeInTheDocument();
    // Claude is told which decision and which option the chat is about.
    expect(ai.run.mock.calls.find(([task]) => task === 'chat')![1].scope).toEqual({
      decisionQuestion: trial.question,
      optionLabel: 'Usage limit',
    });
    expect(stored().messages[0].threadId).toMatch(/^d-trial:/);
  });
});
