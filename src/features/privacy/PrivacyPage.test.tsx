import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { seedState } from '../../data/fixtures';
import { renderApp, signedInState } from '../../test/render';

describe('Privacy and your data', () => {
  it('F-02: can be read before signing in, and says what is read, what goes to Claude and where data lives', () => {
    renderApp('/privacy', { ...seedState(), user: null });
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy and your data' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'What Rooted reads' })).toHaveTextContent('only from the channels you check');
    expect(screen.getByRole('region', { name: 'What Rooted reads' })).toHaveTextContent('Private channels, direct messages');
    expect(screen.getByRole('region', { name: 'What goes to Claude' })).toHaveTextContent('Anthropic');
    expect(screen.getByRole('region', { name: 'Where your data lives' })).toHaveTextContent('saved in this browser');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin');
  });

  it('F-23: signed in, it links to the controls in settings', () => {
    renderApp('/privacy');
    const controls = screen.getByRole('region', { name: 'What you control' });
    expect(within(controls).getByRole('link', { name: 'Manage sources' })).toHaveAttribute('href', '/settings#settings-sources');
    expect(within(controls).getByRole('link', { name: 'Delete your data' })).toHaveAttribute('href', '/settings#settings-data');
  });

  it('the footer and the sign-in page link to it', () => {
    renderApp('/settings', signedInState());
    const footer = screen.getByRole('navigation', { name: 'Help and support' });
    expect(within(footer).getByRole('link', { name: 'Privacy and your data' })).toHaveAttribute('href', '/privacy');
  });

  it('the sign-in page links to it', () => {
    renderApp('/signin', { ...seedState(), user: null });
    expect(screen.getByRole('link', { name: 'How Rooted handles your data' })).toHaveAttribute('href', '/privacy');
  });
});
