import { describe, expect, it } from 'vitest';
import { loadPositions, POS_KEY, savePositions } from './positions';

describe('saved map positions', () => {
  it('F-17: keeps each scope’s arrangement separate', () => {
    savePositions('own:everyone', { 'd-a': { x: 10, y: 20 } });
    savePositions('demo:everyone', { 'd-a': { x: 300, y: 400 } });
    expect(loadPositions('own:everyone')).toEqual({ 'd-a': { x: 10, y: 20 } });
    expect(loadPositions('demo:everyone')).toEqual({ 'd-a': { x: 300, y: 400 } });
    expect(loadPositions('own:me')).toEqual({});
  });

  it('starts fresh when the saved value is unreadable', () => {
    localStorage.setItem(POS_KEY, '{not json');
    expect(loadPositions('own:everyone')).toEqual({});
  });
});
