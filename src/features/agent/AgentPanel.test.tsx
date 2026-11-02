import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateOptions } from '../../agent/options';
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
  it('F-12: the corner launcher opens the chat; answers cite decisions and say they are samples', async () => {
    const { user } = renderApp('/');
    await user.click(screen.getByRole('button', { name: 'Ask Rooted' }));
    expect(screen.queryByRole('button', { name: 'Ask Rooted' })).not.toBeInTheDocument();
    await user.type(within(panel()).getByLabelText('Ask Rooted'), 'Why did we choose the checklist?{Enter}');
    const log = within(panel()).getByRole('log');
    expect(within(log).getByText('Why did we choose the checklist?')).toBeInTheDocument();
    expect(await within(log).findByText(/chose “Setup checklist”/, {}, WAIT)).toBeInTheDocument();
    expect(within(log).getByText('Sample answer')).toBeInTheDocument();
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
    await within(log).findByText(/passed their review date/, {}, WAIT);
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
    expect(await within(panel()).findByText(/Rafael Ortiz \(Head of product\)/, {}, WAIT)).toBeInTheDocument();
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
    state.options = [...state.options, ...generateOptions(trial, state.contextItems, [])];
    const { user } = renderApp('/decisions/d-trial/work', state);
    const options = screen.getByRole('region', { name: 'Options' });
    await user.click(within(options).getByRole('button', { name: 'Talk it through Usage limit' }));
    expect(within(panel()).getByText('Talking through “Usage limit”')).toBeInTheDocument();
    await user.click(within(panel()).getByRole('button', { name: 'What could make this wrong?' }));
    expect(await within(panel()).findByText(/What could make “Usage limit” the wrong call/, {}, WAIT)).toBeInTheDocument();
    expect(stored().messages[0].threadId).toMatch(/^d-trial:/);
  });
});
