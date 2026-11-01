import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { demoState, seedState } from '../../data/fixtures';
import { demoUser } from '../../data/fixtures';
import { renderApp } from '../../test/render';

const emptyState = () => ({ ...seedState(), user: structuredClone(demoUser), decisions: [], options: [], contextItems: [] });

function inspector() {
  return within(screen.getByRole('complementary', { name: 'Decision detail' }));
}

describe('WorkspaceHome decision canvas', () => {
  it('renders a node per decision and the map controls', () => {
    renderApp('/', demoState());
    expect(screen.getByRole('heading', { level: 1, name: /decision map/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /How do we drive expansion revenue/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Graph' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Timeline' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trace' })).toBeInTheDocument();
  });

  it('selecting a decided node reveals its reasoning, outcome and a link to the record', async () => {
    const { user } = renderApp('/', demoState());
    await user.click(screen.getByRole('button', { name: /How should we define activation/ }));

    const panel = inspector();
    expect(panel.getByRole('heading', { name: /How should we define activation/ })).toBeInTheDocument();
    expect(panel.getByText(/strongest predictor/)).toBeInTheDocument();
    expect(panel.getByRole('link', { name: /Open record/ })).toHaveAttribute('href', '/decisions/d-activation-metric');
  });

  it('a speculative direction can be explored from the canvas', async () => {
    const { user } = renderApp('/', demoState());
    await user.click(screen.getByRole('button', { name: /Move the Team plan to usage-based pricing/ }));

    const panel = inspector();
    expect(panel.getByText('Direction')).toBeInTheDocument();
    expect(panel.getByRole('link', { name: /Explore/ })).toHaveAttribute(
      'href',
      '/decisions/d-future-usage-pricing/options',
    );
  });

  it('builds-on lets you walk back to the decisions a call grew from', async () => {
    const { user } = renderApp('/', demoState());
    await user.click(screen.getByRole('button', { name: /How do we drive expansion revenue/ }));
    await user.click(inspector().getByRole('button', { name: /Charge per seat or per workspace/ }));
    expect(inspector().getByRole('heading', { name: /Charge per seat or per workspace/ })).toBeInTheDocument();
  });

  it('a decision can be renamed from the inspector', async () => {
    const { user } = renderApp('/', demoState());
    await user.click(screen.getByRole('button', { name: /Should onboarding use a checklist/ }));
    await user.click(inspector().getByRole('button', { name: /Rename/ }));
    const input = inspector().getByLabelText('Rename decision');
    await user.clear(input);
    await user.type(input, 'Rework onboarding end to end?{Enter}');
    expect(screen.getByRole('button', { name: /Rework onboarding end to end/ })).toBeInTheDocument();
  });

  it('Trace is enabled once a node is selected', async () => {
    const { user } = renderApp('/', demoState());
    expect(screen.getByRole('button', { name: 'Trace' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /How do we drive expansion revenue/ }));
    const trace = screen.getByRole('button', { name: 'Trace' });
    expect(trace).toBeEnabled();
    await user.click(trace);
    expect(trace).toHaveAttribute('aria-pressed', 'true');
  });

  it('the org view adds teammates’ decisions and labels itself as sample data', async () => {
    const { user } = renderApp('/', demoState());
    await user.click(screen.getByRole('button', { name: 'Org' }));
    expect(screen.getByRole('button', { name: /Ship API v2 with breaking changes/ })).toBeInTheDocument();
    expect(screen.getByText(/sample data/i)).toBeInTheDocument();
  });

  it('with no decisions, offers to frame the first one or load the demo', () => {
    renderApp('/', emptyState());
    expect(screen.getByRole('heading', { name: 'Start with one decision.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Frame your first decision/ })).toHaveAttribute('href', '/decisions/new');
    expect(screen.getAllByRole('button', { name: /Explore the demo/ }).length).toBeGreaterThan(0);
  });
});
