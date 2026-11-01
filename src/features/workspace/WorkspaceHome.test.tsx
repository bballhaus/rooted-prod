import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { demoState, seedState } from '../../data/fixtures';
import { demoUser } from '../../data/fixtures';
import { renderApp } from '../../test/render';

const emptyState = () => ({ ...seedState(), user: structuredClone(demoUser), decisions: [], options: [], contextItems: [] });

function inspector() {
  return within(screen.getByRole('complementary', { name: 'Decision detail' }));
}

describe('WorkspaceHome causal map', () => {
  it('shows the decision map, counts and a legend', () => {
    renderApp('/', demoState());
    expect(screen.getByRole('heading', { level: 1, name: /decision map/i })).toBeInTheDocument();

    const map = screen.getByRole('region', { name: 'Decision map' });
    // Every decision is a node button labelled with its question.
    expect(within(map).getByRole('button', { name: /How should we define activation/ })).toBeInTheDocument();
    expect(within(map).getByRole('button', { name: /How do we drive expansion revenue/ })).toBeInTheDocument();

    // Counts match the planted forest: 6 decided, 2 in progress, 3 directions.
    const decided = screen.getByText('Decided').closest('.wk-stat') as HTMLElement;
    expect(within(decided).getByText('6')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'How to read the map' })).toBeInTheDocument();
  });

  it('selecting a decided node reveals its reasoning, outcome and a link to the record', async () => {
    const { user } = renderApp('/', demoState());
    await user.click(screen.getByRole('button', { name: /How should we define activation/ }));

    const panel = inspector();
    expect(panel.getByRole('heading', { name: /How should we define activation/ })).toBeInTheDocument();
    expect(panel.getByText(/strongest predictor/)).toBeInTheDocument();
    expect(panel.getByText(/north-star activation metric/)).toBeInTheDocument();
    expect(panel.getByRole('link', { name: /Open the record/ })).toHaveAttribute(
      'href',
      '/decisions/d-activation-metric',
    );
  });

  it('a speculative direction can be explored from the map', async () => {
    const { user } = renderApp('/', demoState());
    await user.click(screen.getByRole('button', { name: /Move the Team plan to usage-based pricing/ }));

    const panel = inspector();
    expect(panel.getByText('Direction')).toBeInTheDocument();
    expect(panel.getByText(/Possible paths/)).toBeInTheDocument();
    expect(panel.getByRole('link', { name: /Explore this direction/ })).toHaveAttribute(
      'href',
      '/decisions/d-future-usage-pricing/options',
    );
  });

  it('builds-on lets you walk back to the decisions a call grew from', async () => {
    const { user } = renderApp('/', demoState());
    await user.click(screen.getByRole('button', { name: /How do we drive expansion revenue/ }));

    const panel = inspector();
    // The expansion decision built on the pricing call; follow the link back.
    await user.click(panel.getByRole('button', { name: /Charge per seat or per workspace/ }));
    expect(inspector().getByRole('heading', { name: /Charge per seat or per workspace/ })).toBeInTheDocument();
  });

  it('with no decisions, offers to frame the first one or load the demo', () => {
    renderApp('/', emptyState());
    expect(screen.getByRole('heading', { name: 'Start with one decision.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Frame your first decision/ })).toHaveAttribute('href', '/decisions/new');
    expect(screen.getAllByRole('button', { name: /Explore the demo/ }).length).toBeGreaterThan(0);
  });
});
